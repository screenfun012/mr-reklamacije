# 17 — Object storage migration (attachments → MinIO on Railway)

> Status: DESIGN + RUNBOOK (approved 2026-07-11). Goal: remove the `/data` volume from the
> `api` service so Railway can deploy it **without downtime** (and unlock replicas/scaling),
> while keeping everything on Railway. Attachments move to a MinIO (S3-compatible) service.

## 1. Why

`api` runs a single replica with a persistent `/data` volume (`UPLOAD_DIR=/data/uploads`).
Railway can't attach a volume to two containers at once, so every deploy **stops the old
container before starting the new one** → ~15–20 s outage on every deploy. Railway also blocks
replicas for volume-backed services ("Replicas are not available for attached volumes").

Removing the volume fixes both: zero-downtime deploys **and** the ability to scale out later
(clients + more traffic). Attachments need a new home → a MinIO service on Railway.

## 2. Architecture

- **MinIO service** (Railway, its own volume) exposes the S3 API on the private network
  (`http://minio.railway.internal:9000`). It redeploys rarely, so its volume never blocks the
  frequently-deploying `api`.
- **`api`** gets an S3 storage adapter and **loses its volume**.
- The storage layer is already abstracted (`StorageService`, `apps/api/src/infrastructure/storage/`),
  injected once in `container.ts`. Only the injected implementation + config change.

Nothing changes for the user: same paths, thumbnails, ETag/cache, PDF images, and security.

## 3. The adapter — `S3StorageService`

Implements the existing `StorageService` interface (6 methods: `upload`, `read`, `readStream`,
`delete`, `exists`, `getMetadata`) against S3 using `@aws-sdk/client-s3` (works with MinIO now,
and with R2/S3 unchanged if we ever move). The attachment path builders
(`buildAttachmentStoragePath`, thumbnails) already produce keys that map 1:1 to S3 object keys.

- **Downloads stay streamed through the API** (`readStream` → S3 `GetObject` body stream). We do
  **not** switch to S3 presigned URLs — the current auth + 5-min signed-URL layer stays intact.
- **Selection is config-driven** (`container.ts`): if S3 env vars are set → `S3StorageService`;
  otherwise → `LocalVolumeStorageService`. So **dev and CI keep the local filesystem** (no MinIO
  needed locally; existing attachment tests unchanged — they use `.tmp/test-uploads`).

## 4. Config (env, `apps/api/src/config/env.ts`)

Set all four (endpoint, bucket, keys) together to use S3; set none to use the local volume.
A partial set fails fast at boot so a misconfigured cutover never silently loses uploads.

| Var | Example | Notes |
| --- | --- | --- |
| `S3_ENDPOINT` | `http://minio.railway.internal:9000` | MinIO private URL |
| `S3_BUCKET` | `attachments` | presence selects S3 over local FS |
| `S3_ACCESS_KEY_ID` | *(secret)* | MinIO access key |
| `S3_SECRET_ACCESS_KEY` | *(secret)* | MinIO secret key |
| `S3_REGION` | `us-east-1` | dummy for MinIO |
| `S3_FORCE_PATH_STYLE` | `true` | MinIO needs path-style addressing |

## 5. Migration script (one-off)

`pnpm --filter api migrate-attachments-to-s3` (mirrors the `import-legacy` one-off pattern):
instantiates BOTH `LocalVolumeStorageService` (read) and `S3StorageService` (write), walks the
DB `attachments` rows (+ thumbnails), copies each file from the volume to MinIO under the same
key, verifies size, and reports counts. Dry-run by default; `-- --apply` to write. Idempotent
(skips objects that already exist with matching size).

## 6. Safe cutover runbook — ORDER MATTERS (no data loss)

1. **Nikola:** deploy a **MinIO** service on Railway (template) → it gets its own volume + root
   creds. Create a bucket `attachments` (MinIO console). Note the private endpoint + keys.
2. **Nikola:** add the S3 env vars to the **api** service (endpoint = MinIO private domain; keys
   as secrets). **Do NOT remove the `/data` volume yet.**
3. Deploy `api` with the adapter code. With S3 vars set, the app now writes/reads MinIO — but the
   old files are still only on the volume.
4. **Run the migration** (dry-run → review → `--apply`) as a one-off on `api` (volume still
   attached): copies volume files → MinIO. Verify counts match.
5. **Verify in the browser:** open an existing claim's photos (download + thumbnail), generate a
   PDF (embedded images), upload a new photo. All must work via MinIO.
6. **Only then, Nikola:** remove the `/data` volume from `api` → the next `api` deploy is
   zero-downtime. (This last redeploy still blips because it removes the volume — the final one.)

**Rollback at any step:** the volume + its files are untouched until step 6. To revert, unset the
S3 env vars on `api` and redeploy → it's back on the local volume with all files intact.

## 7. Testing

- `S3StorageService` unit tests (mocked S3 client) covering each method incl. streaming + the
  not-found path.
- Existing attachment integration tests stay on the local filesystem (unchanged).
- Optional later: a MinIO container in the test compose for a real S3-backed integration test.

## 8. Not doing (YAGNI)

- No S3 presigned URLs (keep API-streamed downloads + existing auth).
- No multi-region / CDN now (one region is fine for an internal app; unlocked later since the
  volume no longer blocks replicas).
- Resource limits left as-is (Railway bills by usage, not by the limit; high limits leave room
  for growth at no extra cost).

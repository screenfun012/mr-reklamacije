# 08 — File Storage

All user-uploaded files (images, videos, documents attached to claims) are stored
on a Railway Volume attached to the `api` service.

## Storage layer abstraction

Even though we use Railway volumes now, all storage access goes through the
`StorageService` interface. This allows a drop-in swap to Cloudflare R2
(or AWS S3) in the future without touching business logic.

```ts
// apps/api/src/infrastructure/storage/storage.interface.ts
export interface StorageService {
  upload(opts: UploadOpts): Promise<StoredFile>
  download(path: string): Promise<ReadableStream>
  delete(path: string): Promise<void>
  getSignedUrl(path: string, expiresInSeconds: number): Promise<string>
  exists(path: string): Promise<boolean>
  getMetadata(path: string): Promise<FileMetadata>
}

export interface UploadOpts {
  stream: ReadableStream | Buffer
  path: string
  mimeType: string
  metadata?: Record<string, string>
}

export interface StoredFile {
  path: string
  size: number
  mimeType: string
  checksum: string  // sha256
}
```

Two concrete implementations:
- `VolumeStorageService` — Railway volume (MVP)
- `R2StorageService` — stub for future migration

Swapping uses the DI container, one-line change in `container.ts`.

## Volume mount point

Railway volume mounted at `/data/uploads` inside the `api` container.

## Directory structure

```
/data/uploads/
├── emotive/
│   └── <YYYY>/                # claim_year
│       └── <claim_id>/        # UUID of emotive_claims row
│           ├── <attachment_id>.<ext>       # original file
│           └── _thumb/
│               └── <attachment_id>.jpg     # 400px thumbnail
├── domace/
│   └── <YYYY>/
│       └── <claim_id>/
│           └── ...
└── _temp/                     # for in-progress multi-part uploads, cleaned nightly
```

Example: `/data/uploads/emotive/2026/01932fc0-...-.../01934abc-....jpg`

### Rationale

- Year-first folders keep directories manageable (max ~1000 claims per year)
- Separate `emotive` and `domace` trees — easy to migrate one market to another storage later
- Thumbnails in `_thumb/` sub-folder — cheap to regenerate; not included in backups

## Upload limits

Per claim:
- Max **50 attachments** total
- Max **500 MB** cumulative size

Per file:
- Max size: **25 MB** (configurable in `app_settings`)
- Allowed MIME types:
  - Images: `image/jpeg`, `image/png`, `image/webp`, `image/heic` (auto-converted to JPEG)
  - Videos: `video/mp4`, `video/quicktime` (max 2 min duration, enforced post-upload by ffprobe)
  - Documents: `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (.docx), `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (.xlsx)

## Upload flow

### Client → API

1. Client selects files via drag-drop or file picker on claim detail page
2. Client validates file size + type browser-side; shows preview
3. Client POSTs to `/api/attachments/upload` as `multipart/form-data`:
   ```
   claim_kind: "emotive"
   claim_id: "01932..."
   visibility: "internal" | "client_visible"
   files[]: <binary>
   caption[]: <text>    (one per file, optional)
   ```
4. Server receives, streams to disk (not buffered in memory), validates after write
5. Per file, server:
   - Verifies MIME type matches the file's actual content (magic bytes check)
   - Generates thumbnail (sharp for images, ffmpeg for videos)
   - Computes SHA256 checksum
   - Inserts `attachments` row with storage_path
6. Returns list of attachment metadata

### Progress indication

For large uploads, client uses XHR with `onprogress` to show percent.

### Duplicate detection

If a file with the same SHA256 checksum already exists for the same claim,
skip upload and return the existing attachment metadata.

## Download flow

### Authenticated downloads

```
GET /api/attachments/:id/download
```

1. Auth middleware: user must have `attachments.view_internal` or
   `attachments.view_client_visible` (client only for `client_visible` items)
2. Row-level check: user must have access to the parent claim
3. Server streams file from volume directly

### Signed URLs (optional, for bandwidth optimization)

For clients opening a claim with many images, we generate short-lived signed
URLs (5 min) so the browser can load images via `<img src="...">` without
hitting Node for each request.

```
GET /api/attachments/:id/signed-url
```

Returns: `{ url: "https://api.mrengines.rs/attachments/raw/abc?sig=...&exp=..." }`

The `/attachments/raw/:filename` route verifies signature via HMAC-SHA256 and
streams the file.

## Thumbnail generation

- Images: `sharp` — 400px on longest side, WebP format, saved to `_thumb/`
- Videos: `ffmpeg` — first frame at 10% duration, saved as JPEG, saved to `_thumb/`
- Documents: static placeholder icon served by frontend (no thumbnail generation)

Generated synchronously at upload time. If generation fails, upload still
succeeds and we fall back to serving the original when a thumbnail is requested.

## Backups

Nightly rsync to Synology NAS:

```bash
# scripts/backup-uploads.sh (runs on Synology via cron)
rsync -av --delete \
  --exclude '_temp' \
  --exclude '_thumb' \
  user@railway-volume:/data/uploads/ \
  /volume1/backups/mr-reklamacije/uploads/
```

- Thumbnails not backed up (cheap to regenerate)
- `_temp` not backed up
- Retention: 30 daily snapshots + 12 monthly via Synology snapshot feature

## Cleanup policy

- **Soft-deleted attachments:** file stays on disk for 30 days after `deleted_at`; cron job deletes file + thumb and removes row from DB after that
- **Orphaned files (no DB row):** weekly reconciliation job scans volume, deletes files with no corresponding attachment row
- **_temp folder:** files older than 24 hours deleted nightly
- **Old thumbnails:** if an original file is missing, delete the thumbnail too

All cleanup jobs log to audit_log with `action='cleanup'`.

## Security

- Files served through API, never directly exposed (no public URLs without signing)
- MIME type verified from content, not trusted from upload header
- Virus scanning: out of scope for MVP; can add ClamAV later as pre-insert step
- Path traversal protection: storage path constructed from verified IDs, never from user input
- File serving sets `X-Content-Type-Options: nosniff`, `Content-Disposition: attachment` for downloads
- Image thumbnails served with long cache headers (`Cache-Control: private, max-age=604800`)
- Original files served with short or no cache (fresh authorization check each request)

## Volume capacity planning

Expected usage:
- Avg claim has ~3 attachments, ~2 MB each → 6 MB per claim
- 500 claims/year (rough upper bound based on history: 143 in 2025) → 3 GB/year
- **10 GB volume covers 3 years** of growth; Railway allows resizing without downtime

Start with 10 GB; alert at 70% usage; resize when 80%.

## Migration path to Cloudflare R2 (future)

When/if we migrate:
1. Provision R2 bucket
2. Run one-time rsync of `/data/uploads/` → R2
3. Update `StorageService` binding in container to `R2StorageService`
4. Keep volume for 30 days as fallback
5. Verify no 404s, then remove volume

No application code changes needed; interface is stable.

## Performance

- Uploads: ~20 MB/s (disk-bound)
- Downloads: streamed, ~100 MB/s (network-bound)
- Thumbnail generation: ~200 ms for typical image, ~2 s for video first-frame
- If thumbnail generation becomes a bottleneck, defer it to a background job
  (BullMQ) — not needed for MVP volume

## Error handling

| Error | Response |
|---|---|
| File too large | 413, details include max allowed size |
| Wrong MIME type | 415, details include allowed types |
| Claim attachment limit reached | 409, details include current count |
| Virus detected (future) | 422, file rejected |
| Disk full | 507, alert admin, reject upload |
| Checksum mismatch during verification | 500, log and instruct retry |

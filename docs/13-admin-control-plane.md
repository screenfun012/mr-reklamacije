# 13 — Admin Panel as Central Control Plane

> **Status:** Binding architectural rule. Every feature — current and future —
> must comply. This is not a note or a suggestion; reviewers reject changes
> that violate it.

## Principle

`admin-web` is the **central control plane** of the system. All management of the
system happens there. The other apps are subordinate:

- **admin-web commands** — it owns configuration, governance, and oversight.
- **internal-web obeys** — it consumes the rules and catalogs that admin defines.
- **portal-web reads** — clients only ever see a filtered, read-only slice.

Anything that changes in the admin panel is reflected in the internal app.
The internal app never owns a source of truth that the admin panel cannot see
or control.

## What the admin panel governs

The admin panel is (eventually) the single place to do all of the following.
Not all of it is built yet — see [Roadmap](./12-roadmap.md) — but the data model
and APIs must always leave room for it:

- **Permissions and roles** — assign/revoke permissions, manage role definitions.
- **Custom statuses** — define and edit status/category registries (outcomes,
  channels, types) instead of them being hardcoded.
- **Statistics and reports** — read across all data for dashboards and exports.
- **Audit logs / activity trail** — view who did what, when, to which entity.
- **Record oversight** — review and edit any entry across modules.
- **Catalog management** — CRUD for companies/customers, employees, departments,
  engine types, sources, and similar reference data.
- **Privileged state overrides** — e.g. unarchiving a claim back to `pending`;
  any such override lives behind an admin permission. (Claims themselves carry
  no edit-lock — they're always editable, audit-tracked; there's nothing to
  unlock.)

## Consequence for every future feature (design rule)

Whenever we build a feature in the internal app (or anywhere), it **must leave an
"admin hook"** — the data and rules must be exposable/manageable from the admin
panel later, **without a rewrite**. Concretely, at design time every feature must
satisfy all four of the following:

1. **State changes write audit.**
   Every action that mutates state records who/when/what (actor id, timestamp,
   entity type + id, and a diff for updates) so the admin panel can render the log.
   See [Permissions](./03-permissions.md) and the security rules for the audit
   contract. No state change bypasses audit — admin actions included.

2. **Categories live in a registry, never hardcoded.**
   Anything that is a "category" — statuses, types, channels, outcomes — goes
   through a registry/table, not a hardcoded literal scattered in code. This lets
   the admin panel add/edit/disable entries later. A `const` enum-like union is
   acceptable as the *current* shape only if it is backed by, or trivially
   migratable to, a table the admin panel can own.

3. **Permissions go through the permission system.**
   No ad-hoc role checks. Every gated action maps to a named permission in
   `packages/shared/src/permissions.ts` so the admin panel can grant/revoke it.
   UI hiding and route loaders are convenience only; the API server is the judge.

4. **Catalogs are CRUD-able from admin; internal only reads.**
   Reference data (companies/customers, employees, departments, engine types,
   sources) is owned and edited in the admin panel. The internal app reads these
   catalogs; it does not become a second editing surface for them.

## How to apply this rule during planning

This rule does **not** mean we build the admin panel now — it is built
incrementally. It means every feature must be **designed so the admin panel can
later sit on top of it** with no rework.

When planning any future feature, explicitly answer:

> **"Does this leave the admin panel able to manage it?"**

Use this checklist before writing code:

- [ ] Does every state-changing action write an audit entry (actor, time, entity, diff)?
- [ ] Are all categories/statuses/types backed by a registry the admin panel can own — not hardcoded?
- [ ] Is every gated action expressed as a named permission, not an inline role check?
- [ ] Is reference/catalog data owned by admin (CRUD) with internal as a read-only consumer?
- [ ] Can the resulting data be listed/filtered/edited from an admin endpoint without reshaping the schema?

If any answer is "no", the design is not done — adjust it before implementation.

## Relationship to other docs

- [01 — Architecture](./01-architecture.md): the three frontends and one API.
- [03 — Permissions](./03-permissions.md): the permission catalog and audit contract.
- [04 — Modules](./04-modules.md): module anatomy that carries audit + permissions.
- [12 — Roadmap](./12-roadmap.md): the incremental order in which admin surfaces land.

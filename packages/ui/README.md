# @mr/ui

Shared UI primitives for MR Reklamacije frontends.

## Scope

Only truly shared components. App-specific styling stays in each
frontend (admin-web, internal-web, portal-web).

Phase 0 primitives: Button, Input, Card, Dialog, Toast, Skeleton.

## Tailwind

This package does NOT ship Tailwind config or built CSS. Frontends
configure their own Tailwind and include `packages/ui/src/**/*.tsx`
in their `@source` / `content` paths.

## Usage

```tsx
import { Button, cn } from '@mr/ui'
```

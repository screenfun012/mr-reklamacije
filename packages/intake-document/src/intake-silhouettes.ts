import { IntakeVehicleType } from '@mr/shared'

/**
 * The four vehicle silhouettes, transferred verbatim from `prijem-prototip-v2`'s `SIL` object.
 *
 * NOT redrawn. Every coordinate lives in `viewBox="0 0 340 556"` with the front of the vehicle
 * at the bottom, and the damage-map markers, the defect list and the print all read that same
 * space — a silhouette drawn "close enough" would put every marker in the wrong place.
 *
 * `op` is the fill opacity the prototype gives each path; `'0'` means a stroke-only guide line.
 */
export interface IntakeSilhouettePath {
  d: string
  op: string
}

export const INTAKE_SILHOUETTE_VIEWBOX = '0 0 340 556'

export const INTAKE_SILHOUETTES: Record<IntakeVehicleType, readonly IntakeSilhouettePath[]> = {
  [IntakeVehicleType.Car]: [
    {
      d: 'M170 34 c-31 0 -53 4 -59 12 -6 8 -10 27 -12 45 -14 4 -21 15 -21 31 v296 c0 16 7 27 21 31 2 18 6 37 12 45 6 8 28 12 59 12 s53 -4 59 -12 c6 -8 10 -27 12 -45 14 -4 21 -15 21 -31 v-296 c0 -16 -7 -27 -21 -31 -2 -18 -6 -37 -12 -45 -6 -8 -28 -12 -59 -12 z',
      op: '.03',
    },
    { d: 'M110 128 l12 -32 h96 l12 32 z', op: '.07' },
    { d: 'M110 128 h120 v244 h-120 z', op: '.07' },
    { d: 'M110 372 l12 32 h96 l12 -32 z', op: '.07' },
    { d: 'M100 96 h140 M100 404 h140', op: '0' },
    { d: 'M104 52 h34 v13 h-34 z M202 52 h34 v13 h-34 z', op: '.06' },
    { d: 'M104 474 h34 v13 h-34 z M202 474 h34 v13 h-34 z', op: '.06' },
    { d: 'M152 40 h36 v10 h-36 z M152 490 h36 v10 h-36 z', op: '0' },
    {
      d: 'M72 84 h16 q6 0 6 6 v40 q0 6 -6 6 h-16 q-6 0 -6 -6 v-40 q0 -6 6 -6 z M252 84 h16 q6 0 6 6 v40 q0 6 -6 6 h-16 q-6 0 -6 -6 v-40 q0 -6 6 -6 z',
      op: '.08',
    },
    {
      d: 'M72 404 h16 q6 0 6 6 v40 q0 6 -6 6 h-16 q-6 0 -6 -6 v-40 q0 -6 6 -6 z M252 404 h16 q6 0 6 6 v40 q0 6 -6 6 h-16 q-6 0 -6 -6 v-40 q0 -6 6 -6 z',
      op: '.08',
    },
    { d: 'M79 384 l-15 7 5 9 11 -5 z M261 384 l15 7 -5 9 -11 -5 z', op: '.06' },
  ],
  [IntakeVehicleType.Van]: [
    {
      d: 'M104 30 h132 q14 0 18 12 l8 32 q8 4 8 18 v340 q0 14 -8 18 l-8 32 q-4 12 -18 12 h-132 q-14 0 -18 -12 l-8 -32 q-8 -4 -8 -18 v-340 q0 -14 8 -18 l8 -32 q4 -12 18 -12 z',
      op: '.03',
    },
    { d: 'M78 74 h184', op: '0' },
    { d: 'M170 30 v44', op: '0' },
    { d: 'M84 96 h172 v300 h-172 z', op: '.05' },
    { d: 'M84 396 l10 34 h152 l10 -34 z', op: '.07' },
    { d: 'M94 430 h152 v40 h-152 z', op: '.03' },
    { d: 'M100 36 h30 v15 h-30 z M210 36 h30 v15 h-30 z', op: '.06' },
    { d: 'M100 456 h36 v13 h-36 z M204 456 h36 v13 h-36 z', op: '.06' },
    { d: 'M152 476 h36 v10 h-36 z', op: '0' },
    {
      d: 'M68 108 h16 q6 0 6 6 v42 q0 6 -6 6 h-16 q-6 0 -6 -6 v-42 q0 -6 6 -6 z M256 108 h16 q6 0 6 6 v42 q0 6 -6 6 h-16 q-6 0 -6 -6 v-42 q0 -6 6 -6 z',
      op: '.08',
    },
    {
      d: 'M68 386 h16 q6 0 6 6 v42 q0 6 -6 6 h-16 q-6 0 -6 -6 v-42 q0 -6 6 -6 z M256 386 h16 q6 0 6 6 v42 q0 6 -6 6 h-16 q-6 0 -6 -6 v-42 q0 -6 6 -6 z',
      op: '.08',
    },
    { d: 'M71 378 l-17 7 5 10 12 -5 z M269 378 l17 7 -5 10 -12 -5 z', op: '.06' },
  ],
  [IntakeVehicleType.Pickup]: [
    {
      d: 'M104 34 h132 q14 0 18 12 l6 26 q8 4 8 18 v326 q0 14 -8 18 l-6 28 q-4 12 -18 12 h-132 q-14 0 -18 -12 l-6 -28 q-8 -4 -8 -18 v-326 q0 -14 8 -18 l6 -26 q4 -12 18 -12 z',
      op: '.03',
    },
    { d: 'M86 62 h168 v230 h-168 z', op: '.02' },
    { d: 'M96 74 h148 v206 h-148 z', op: '.06' },
    { d: 'M96 126 h148 M96 178 h148 M96 230 h148', op: '0' },
    { d: 'M92 302 l10 -12 h136 l10 12 z', op: '.07' },
    { d: 'M92 302 h156 v74 h-156 z', op: '.07' },
    { d: 'M92 376 l10 32 h136 l10 -32 z', op: '.07' },
    { d: 'M98 408 h144 v50 h-144 z', op: '.03' },
    { d: 'M92 44 h28 v14 h-28 z M220 44 h28 v14 h-28 z', op: '.06' },
    { d: 'M102 444 h34 v13 h-34 z M204 444 h34 v13 h-34 z', op: '.06' },
    { d: 'M152 464 h36 v10 h-36 z', op: '0' },
    {
      d: 'M68 150 h16 q6 0 6 6 v42 q0 6 -6 6 h-16 q-6 0 -6 -6 v-42 q0 -6 6 -6 z M256 150 h16 q6 0 6 6 v42 q0 6 -6 6 h-16 q-6 0 -6 -6 v-42 q0 -6 6 -6 z',
      op: '.08',
    },
    {
      d: 'M68 376 h16 q6 0 6 6 v42 q0 6 -6 6 h-16 q-6 0 -6 -6 v-42 q0 -6 6 -6 z M256 376 h16 q6 0 6 6 v42 q0 6 -6 6 h-16 q-6 0 -6 -6 v-42 q0 -6 6 -6 z',
      op: '.08',
    },
    { d: 'M78 368 l-16 7 5 10 11 -5 z M262 368 l16 7 -5 10 -11 -5 z', op: '.06' },
  ],
  [IntakeVehicleType.Suv]: [
    {
      d: 'M170 32 c-34 0 -58 4 -64 12 -7 9 -11 28 -13 46 -14 5 -21 16 -21 32 v292 c0 16 7 27 21 32 2 18 6 37 13 46 6 8 30 12 64 12 s58 -4 64 -12 c7 -9 11 -28 13 -46 14 -5 21 -16 21 -32 v-292 c0 -16 -7 -27 -21 -32 -2 -18 -6 -37 -13 -46 -6 -8 -30 -12 -64 -12 z',
      op: '.03',
    },
    { d: 'M86 90 h168 v44 h-168 z', op: '.05' },
    { d: 'M102 168 l10 -34 h116 l10 34 z', op: '.07' },
    { d: 'M102 168 h136 v198 h-136 z', op: '.07' },
    { d: 'M113 168 v198 M227 168 v198', op: '0' },
    { d: 'M102 366 l10 34 h116 l10 -34 z', op: '.07' },
    { d: 'M96 400 h148 v56 h-148 z', op: '.03' },
    { d: 'M98 44 h34 v15 h-34 z M208 44 h34 v15 h-34 z', op: '.06' },
    { d: 'M100 462 h36 v14 h-36 z M204 462 h36 v14 h-36 z', op: '.06' },
    { d: 'M152 38 h36 v10 h-36 z M152 482 h36 v10 h-36 z', op: '0' },
    {
      d: 'M66 100 h18 q7 0 7 7 v48 q0 7 -7 7 h-18 q-7 0 -7 -7 v-48 q0 -7 7 -7 z M256 100 h18 q7 0 7 7 v48 q0 7 -7 7 h-18 q-7 0 -7 -7 v-48 q0 -7 7 -7 z',
      op: '.08',
    },
    {
      d: 'M66 392 h18 q7 0 7 7 v48 q0 7 -7 7 h-18 q-7 0 -7 -7 v-48 q0 -7 7 -7 z M256 392 h18 q7 0 7 7 v48 q0 7 -7 7 h-18 q-7 0 -7 -7 v-48 q0 -7 7 -7 z',
      op: '.08',
    },
    { d: 'M75 380 l-16 7 5 10 12 -5 z M265 380 l16 7 -5 10 -12 -5 z', op: '.06' },
  ],
}

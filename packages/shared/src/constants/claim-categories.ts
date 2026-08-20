/**
 * The one category code the app names out loud: the sidebar's "Mašinska obrada" entry is a
 * link to the claims list filtered by it, and the portal's machining filter reads the same
 * code (Faza 1).
 *
 * Naming a code is not branching on one. Nothing may read this to decide how a claim behaves
 * or how a screen is built — the catalogue stays the only place categories are added, renamed
 * and switched off.
 */
export const MACHINING_CLAIM_CATEGORY_CODE = 'MASINSKA_OBRADA'

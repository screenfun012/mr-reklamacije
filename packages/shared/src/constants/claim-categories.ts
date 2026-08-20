/**
 * The two category codes the app names out loud (Faza 1): the internal sidebar's "Mašinska
 * obrada" entry is a link to the claims list filtered by one of them, and the portal's two
 * service tabs are named after both.
 *
 * Naming a code is not branching on one. Nothing may read these to decide how a claim behaves
 * or how a screen is built — the catalogue stays the only place categories are added, renamed
 * and switched off, and a category named nowhere here still works everywhere: it is filterable
 * in the internal list, counted in statistics, and simply has no tab of its own on the portal.
 */
export const MACHINING_CLAIM_CATEGORY_CODE = 'MASINSKA_OBRADA'

export const ENGINE_OVERHAUL_CLAIM_CATEGORY_CODE = 'REMONT_MOTORA'

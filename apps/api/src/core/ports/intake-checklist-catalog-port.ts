/**
 * The slice of the intake checklist catalog the intake-orders service needs: which codes exist at
 * all. A core port so that module depends on core rather than a sibling module (depcruise
 * `no-sibling-modules`); the container injects the concrete `IntakeChecklistItemsRepository`.
 */
export interface IntakeChecklistCatalogPort {
  /**
   * Every code the catalog has ever held — deactivated and soft-deleted rows included. That is the
   * point: an order may already carry a code the shop has since retired, and refusing a correction
   * to such an order would make a signed document uncorrectable (plan D3).
   */
  listKnownCodes(): Promise<string[]>

  /**
   * How many items a serviser can actually tick right now — active, not soft-deleted.
   *
   * Deliberately NOT `listKnownCodes().length`: that read keeps retired codes on purpose, so a shop
   * that turned every item off would still look full and the signing guard would lock the floor over
   * a mistake nobody on the floor can fix.
   */
  countActiveItems(): Promise<number>
}

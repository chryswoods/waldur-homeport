/**
 * Which accounting a project dashboard should show.
 *
 * Three mutually exclusive answers, because the two systems describe the same
 * money differently and showing both reads as a contradiction:
 *
 * - `award` — an OpenPortal award is attached. Its allocation and usage are
 *   stated figures, so the dashboard can pace against them.
 * - `project` — no award, but the organisation has said its accounting is
 *   OpenPortal's absolute model. The project still has real usage; it just has
 *   no allocation to pace against, so the figures are shown without a pace.
 * - `marketplace` — Waldur's own relative model: a credit balance drawn down
 *   month by month, with the stock balance, aggregate-limit and credit widgets.
 */
export type AccountingMode = 'award' | 'project' | 'marketplace';

export const getAccountingMode = ({
  hasAward,
  openPortalAccountingOnly,
}: {
  hasAward: boolean;
  openPortalAccountingOnly: boolean;
}): AccountingMode => {
  // An award wins over the feature: a project that has one has stated figures
  // to show whatever the organisation has configured.
  if (hasAward) return 'award';
  return openPortalAccountingOnly ? 'project' : 'marketplace';
};

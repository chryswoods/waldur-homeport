import { type ProjectAccountingSummary } from 'waldur-js-client';

export interface ProjectSpend {
  /** Total credit granted to the project over its life. */
  allocation: number;
  /** Everything booked against it, including the current month. */
  usedTotal: number;
  /** Booked this month. */
  currentMonth: number;
  /** Allocation less what has been used. */
  remaining: number;
  /** First day of the window the figures cover. */
  startDate: string;
  endDate: string | null;
}

const toNumber = (value: string | number | null | undefined): number => {
  const n = typeof value === 'number' ? value : parseFloat(value ?? '');
  return Number.isFinite(n) ? n : 0;
};

/**
 * The absolute accounting for a project, from
 * `/api/openportal-accounting-summary/`.
 *
 * Two inputs, because the summary endpoint alone cannot give the balance:
 *
 * - `total_spend` **excludes** the current month; `current_month_spend` is that
 *   month alone. Neither is the total, so they have to be added.
 * - `balanceAtStartOfMonth` is `ProjectCredit.value`, read from
 *   `/api/project-credits/` — the same figure the stock Accounting widget
 *   labels "Balance at start of month". Credit is drawn down when a month is
 *   invoiced rather than as usage accrues, so this month's spend has not come
 *   off it yet.
 *
 * **Not** the endpoint's `total_credits`. That field starts from
 * `ProjectCredit.value` and then *adds back* every credit that arrived as a
 * negative invoice item, so on a project that has accrued compensation it
 * overstates the balance by that whole history — which inflated the allocation
 * here by about half as much again before this was corrected.
 *
 * ## Recovering the allocation
 *
 * `allocation = balanceAtStartOfMonth + total_spend`. This mirrors
 * `waldur_openportal.utils.get_project_credits()`, "the total lifetime credits
 * awarded to the project", and holds because `set_project_credits` writes
 * `ProjectCredit.value = allocation − spend-excluding-the-current-month`, so
 * adding that spend back recovers the allocation. That writer runs for any
 * project with active `RemoteAllocation`s, not only for award-backed ones.
 *
 * The identity does **not** hold for an ordinary Waldur project, whose balance
 * is a genuine ledger drawn down by compensation. That is why nothing here is
 * shown unless `customer.show_openportal_accounting_only` is set — the
 * organisation declaring that its accounting is OpenPortal's absolute model is
 * exactly the condition under which the identity is sound.
 *
 * `remaining` is stated as `allocation − usedTotal`, which reduces to
 * `balanceAtStartOfMonth − current_month_spend` — the figure Waldur's own
 * Accounting widget reports as the estimated end-of-month balance.
 */
export const buildProjectSpend = (
  summary: ProjectAccountingSummary | null | undefined,
  balanceAtStartOfMonth: number | string | null | undefined,
): ProjectSpend | null => {
  if (!summary?.start_date) {
    return null;
  }
  const previousMonths = toNumber(summary.total_spend);
  const currentMonth = toNumber(summary.current_month_spend);

  const allocation = toNumber(balanceAtStartOfMonth) + previousMonths;
  const usedTotal = previousMonths + currentMonth;

  return {
    allocation,
    usedTotal,
    currentMonth,
    remaining: allocation - usedTotal,
    startDate: summary.start_date,
    endDate: summary.end_date,
  };
};

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
 * The endpoint's field names invite two mistakes, so the arithmetic lives here:
 *
 * - `total_spend` **excludes** the current month; `current_month_spend` is that
 *   month alone. Neither is the total, so they have to be added.
 * - `total_credits` is the credit balance at the **start** of the current
 *   month — `ProjectCredit.value`, plus any credit that arrived as a negative
 *   invoice item. Credit is drawn down when a month is invoiced rather than as
 *   usage accrues, so this month's spend has not come off it yet.
 *
 * ## Recovering the allocation
 *
 * `allocation = total_credits + total_spend`. This is not a guess: it is what
 * `waldur_openportal.utils.get_project_credits()` computes, under the name
 * "the total lifetime credits awarded to the project". It holds because
 * `set_project_credits` writes
 * `ProjectCredit.value = allocation − spend-excluding-the-current-month`, so
 * adding that spend back recovers the allocation exactly. That writer runs for
 * any project with active `RemoteAllocation`s, not only for award-backed ones.
 *
 * The identity does **not** hold for an ordinary Waldur project, whose balance
 * is a genuine ledger: there, credit is drawn down by compensation items and
 * `total_credits` already nets them back out, so adding the spend as well
 * double-counts it. That is why nothing here is shown unless
 * `customer.show_openportal_accounting_only` is set — the organisation
 * declaring that its accounting is OpenPortal's absolute model is exactly the
 * condition under which the identity is sound.
 *
 * `remaining` is stated as `allocation − usedTotal`, which reduces to
 * `total_credits − current_month_spend`: the start-of-month balance less what
 * this month has booked against it, and so the same figure Waldur's own
 * accounting reports.
 */
export const buildProjectSpend = (
  summary: ProjectAccountingSummary | null | undefined,
): ProjectSpend | null => {
  if (!summary?.start_date) {
    return null;
  }
  const previousMonths = toNumber(summary.total_spend);
  const currentMonth = toNumber(summary.current_month_spend);
  const balanceAtStartOfMonth = toNumber(summary.total_credits);

  const allocation = balanceAtStartOfMonth + previousMonths;
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

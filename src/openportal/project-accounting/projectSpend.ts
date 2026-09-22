import { type ProjectAccountingSummary } from 'waldur-js-client';

export interface ProjectSpend {
  /** Everything booked against the project, including this month. */
  usedTotal: number;
  /** Booked this month, not yet drawn from the credit balance. */
  currentMonth: number;
  /** Credit left now: the balance the endpoint reports, less this month. */
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
 * The absolute spend figures for a project, from
 * `/api/openportal-accounting-summary/`.
 *
 * The endpoint reports three things, and the arithmetic between them is worth
 * stating because the names do not say it: `total_spend` **excludes** the
 * current month, `current_month_spend` is that month on its own, and
 * `total_credits` is `ProjectCredit.value` — the balance at the start of the
 * current month, since credit is drawn down when the month is invoiced rather
 * than continuously.
 *
 * So the total used is the two spend figures added, and the credit left right
 * now is the balance less what this month has already booked against it.
 *
 * Deliberately absent: the allocation. For a project whose credits OpenPortal
 * sets — `set_project_credits` writes `allocation − spend-excluding-current-
 * month` — it could be recovered as `total_credits + total_spend`. But the same
 * arithmetic on an ordinary Waldur project, whose balance is a genuine ledger
 * drawn down month by month and can be topped up, yields a number that is
 * simply wrong, and nothing in this response distinguishes the two cases. A
 * figure that is right for some projects and quietly wrong for others is worse
 * than no figure, so the cards state what was used and what is left, and leave
 * pacing to projects that carry an award and can state their allocation.
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

  return {
    usedTotal: previousMonths + currentMonth,
    currentMonth,
    remaining: balanceAtStartOfMonth - currentMonth,
    startDate: summary.start_date,
    endDate: summary.end_date,
  };
};

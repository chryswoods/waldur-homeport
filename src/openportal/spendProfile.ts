/**
 * Award spend profiles: dated periods, each with an optional minimum and
 * maximum spend in the award's allocation units.
 *
 * Each entry applies from its `from` date until the day before the next
 * one; the last runs to the award's end. A control an entry leaves out does
 * not apply in its period. Days start at midnight UTC.
 *
 * During a period the award behaves as if it were its cap: the sum of the
 * maximums so far, never more than the award (periods without a maximum count
 * at what was used in them, which only the site knows). When a period ends,
 * a forfeit is charged for what spending fell short of the minimums so far.
 * The award itself never changes.
 */
import { DateTime } from 'luxon';
import type { RemoteProject, SpendProfileEntry } from 'waldur-js-client';

import {
  allocationTotal,
  allocationUnit,
  formatUsage,
} from '@/openportal/allocationUsage';

export type PeriodStatus = 'ended' | 'current' | 'upcoming';

export interface SpendPeriod {
  from: string;
  /** The period's last day; null when the award has no end date. */
  to: string | null;
  minimum: number | null;
  maximum: number | null;
  status: PeriodStatus;
}

/** Today's date in UTC, as the site counts days. */
export const todayUtc = (now: Date = new Date()): string =>
  DateTime.fromJSDate(now).toUTC().toISODate();

/** The day before an ISO date. */
export const dayBefore = (date: string): string =>
  DateTime.fromISO(date, { zone: 'utc' }).minus({ days: 1 }).toISODate();

/** The number in a spend control such as "250 NHR"; null when unset. */
export const amountOf = (control: string | null | undefined): number | null =>
  control == null || control === '' ? null : allocationTotal(control);

/** An amount with the award's units, as the API takes it: "250 NHR". */
export const withUnits = (amount: number, units: string | undefined): string =>
  units ? `${formatUsage(amount)} ${units}` : formatUsage(amount);

export const periodStatus = (
  from: string,
  to: string | null,
  today: string,
): PeriodStatus =>
  from > today ? 'upcoming' : to !== null && to < today ? 'ended' : 'current';

/** The award's allocation as text, e.g. "1000 NHR". */
const awardAllocation = (rp: RemoteProject): string | null =>
  [
    rp.last_sent_details?.allocation,
    rp.award_details?.allocation,
    rp.allocation_string,
    rp.current_allocation,
  ].find((text) => allocationTotal(text) > 0) ?? null;

/** The award a spend profile is drawn against: its size, units and dates. */
export interface AwardTerms {
  total: number;
  units: string | undefined;
  start: string | null;
  end: string | null;
}

export const awardTerms = (rp: RemoteProject): AwardTerms => {
  const allocation = awardAllocation(rp);
  const details =
    rp.award_details ?? rp.last_sent_details ?? rp.last_confirmed_details;
  return {
    total: allocationTotal(allocation),
    units: allocationUnit(allocation),
    start: details?.start_date ?? null,
    end: details?.end_date ?? null,
  };
};

/** The periods of a profile, sorted, each with its last day and status. */
export const spendPeriods = (
  entries: ReadonlyArray<
    Pick<SpendProfileEntry, 'from'> & {
      minimum?: string | number | null;
      maximum?: string | number | null;
    }
  >,
  awardEnd: string | null,
  today: string = todayUtc(),
): SpendPeriod[] => {
  const sorted = [...entries].sort((a, b) => a.from.localeCompare(b.from));
  const asAmount = (value: string | number | null | undefined) =>
    typeof value === 'number' ? value : amountOf(value);
  return sorted.map((entry, i) => {
    const next = sorted[i + 1];
    const to = next ? dayBefore(next.from) : awardEnd;
    return {
      from: entry.from,
      to,
      minimum: asAmount(entry.minimum),
      maximum: asAmount(entry.maximum),
      status: periodStatus(entry.from, to, today),
    };
  });
};

/**
 * The running totals by each period's end: the minimums so far, and the
 * maximums so far as a cap, never more than the award. A period without a
 * maximum has no cap of its own (null).
 */
export const runningTotals = (
  periods: SpendPeriod[],
  awardTotal: number,
): Array<{ minimum: number; cap: number | null }> => {
  let minimum = 0;
  let maximum = 0;
  return periods.map((period) => {
    minimum += period.minimum ?? 0;
    maximum += period.maximum ?? 0;
    return {
      minimum,
      cap:
        period.maximum === null
          ? null
          : awardTotal > 0
            ? Math.min(maximum, awardTotal)
            : maximum,
    };
  });
};

export const SITE_FEATURE_MINIMUMS = 'award_spend_minimums';
export const SITE_FEATURE_MAXIMUMS = 'award_spend_maximums';

/**
 * Which of a profile's controls the site has not said it enforces. A site
 * that has not answered (null features) is warned about only once the
 * profile has a control to enforce.
 */
export const unsupportedControls = (
  entries: ReadonlyArray<{
    minimum?: string | number | null;
    maximum?: string | number | null;
  }> | null,
  siteFeatures: ReadonlyArray<string> | null | undefined,
): { minimums: boolean; maximums: boolean } => {
  const has = (key: 'minimum' | 'maximum') =>
    (entries ?? []).some(
      (e) => e[key] !== null && e[key] !== undefined && e[key] !== '',
    );
  const features = siteFeatures ?? [];
  return {
    minimums: has('minimum') && !features.includes(SITE_FEATURE_MINIMUMS),
    maximums: has('maximum') && !features.includes(SITE_FEATURE_MAXIMUMS),
  };
};

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

import { translate } from '@/i18n';
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
    from?: string | null;
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

/** How long the site's answer about what it supports is trusted. */
const SITE_FEATURES_FRESH_MS = 24 * 60 * 60 * 1000;

/** Whether to ask the site again: never asked, no answer, or a day old. */
export const isSiteSupportStale = (
  siteFeatures: ReadonlyArray<string> | null | undefined,
  checkedAt: string | null | undefined,
  now: Date = new Date(),
): boolean =>
  siteFeatures == null ||
  !checkedAt ||
  now.getTime() - Date.parse(checkedAt) > SITE_FEATURES_FRESH_MS;

/** What the site said it enforces, in words; null if it has not answered. */
export const siteSupportSummary = (
  siteFeatures: ReadonlyArray<string> | null | undefined,
): string | null => {
  if (siteFeatures == null) return null;
  const minimums = siteFeatures.includes(SITE_FEATURE_MINIMUMS);
  const maximums = siteFeatures.includes(SITE_FEATURE_MAXIMUMS);
  if (minimums && maximums) {
    return translate('The site enforces minimums and maximums.');
  }
  if (minimums) {
    return translate('The site enforces minimums, not maximums.');
  }
  if (maximums) {
    return translate('The site enforces maximums, not minimums.');
  }
  return translate('The site has not said it enforces minimums or maximums.');
};

/** The day after an ISO date. */
export const dayAfter = (date: string): string =>
  DateTime.fromISO(date, { zone: 'utc' }).plus({ days: 1 }).toISODate();

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Percentages typed as a list, "10, 20, 30, 40": [] when empty (no control),
 * null when something in it is not a number.
 */
export const parsePercentages = (
  text: string | null | undefined,
): number[] | null => {
  const parts = (text ?? '')
    .split(/[,;\s]+/)
    .map((part) => part.replace(/%$/, ''))
    .filter(Boolean);
  const numbers = parts.map(Number);
  return numbers.some((n) => !Number.isFinite(n)) ? null : numbers;
};

/** Common shapes for n periods, summing to 100. Rising for 4: 10, 20, 30, 40. */
export const percentagePattern = (
  count: number,
  shape: 'equal' | 'rising',
): number[] => {
  if (!count || count < 1) return [];
  const weights = Array.from({ length: count }, (_, i) =>
    shape === 'equal' ? 1 : i + 1,
  );
  const total = weights.reduce((s, w) => s + w, 0);
  const shares = weights.map((w) => round2((w / total) * 100));
  // Rounding left over goes to the last period, so the shares sum to 100.
  shares[count - 1] = round2(
    100 - shares.slice(0, -1).reduce((s, p) => s + p, 0),
  );
  return shares;
};

export const MAX_PATTERN_PERIODS = 24;

export interface PercentagePattern {
  count: number;
  /** Per period; empty for no minimums. */
  minimums: number[];
  /** Per period; empty for no maximums. */
  maximums: number[];
}

/** Why a percentage pattern cannot be applied, or undefined. */
export const patternError = (
  pattern: PercentagePattern,
  window: { start: string | null; end: string | null },
): string | undefined => {
  const { count, minimums, maximums } = pattern;
  if (!Number.isInteger(count) || count < 1 || count > MAX_PATTERN_PERIODS) {
    return translate('Choose between 1 and {max} periods.', {
      max: MAX_PATTERN_PERIODS,
    });
  }
  if (!minimums.length && !maximums.length) {
    return translate('Give the minimum or maximum percentages.');
  }
  for (const list of [minimums, maximums]) {
    if (list.length && list.length !== count) {
      return translate('Give one percentage for each of the {count} periods.', {
        count,
      });
    }
    if (list.some((p) => p < 0 || p > 100)) {
      return translate('Percentages are between 0 and 100.');
    }
    if (round2(list.reduce((s, p) => s + p, 0)) > 100) {
      return translate('The percentages add up to more than 100.');
    }
  }
  if (
    minimums.length &&
    maximums.length &&
    minimums.some((minimum, i) => minimum > maximums[i])
  ) {
    return translate('A minimum is more than its maximum.');
  }
  if (!window.start || !window.end) {
    return translate('The award has no end date to divide up to.');
  }
  const days =
    DateTime.fromISO(window.end, { zone: 'utc' }).diff(
      DateTime.fromISO(window.start, { zone: 'utc' }),
      'days',
    ).days + 1;
  if (days < count) {
    return translate('There are fewer days left than periods.');
  }
  return undefined;
};

/**
 * Equal-length periods from `start` to `end`, each with the given share of
 * the award as its minimum and maximum, in the award's units.
 */
export const periodsFromPercentages = (
  pattern: PercentagePattern,
  window: { start: string; end: string },
  awardTotal: number,
): Array<{ from: string; minimum: number | null; maximum: number | null }> => {
  const start = DateTime.fromISO(window.start, { zone: 'utc' });
  const days =
    DateTime.fromISO(window.end, { zone: 'utc' }).diff(start, 'days').days + 1;
  const amount = (list: number[], i: number) =>
    list.length ? round2((list[i] / 100) * awardTotal) : null;
  return Array.from({ length: pattern.count }, (_, i) => ({
    from: start
      .plus({ days: Math.floor((i * days) / pattern.count) })
      .toISODate(),
    minimum: amount(pattern.minimums, i),
    maximum: amount(pattern.maximums, i),
  }));
};

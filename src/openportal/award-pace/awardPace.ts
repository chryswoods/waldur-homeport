import { DateTime } from 'luxon';

import { formatISODate, parseDate } from '@/core/dateUtils';

/**
 * How long a project gets before it can be told it is behind.
 *
 * An award is typically granted, attached within a day, and first looked at
 * some days later — and it may be embargoed before any of that. Measured
 * strictly, a project is behind from its second day, so the first thing a team
 * would ever see is a warning about a gap they had no chance to close. The
 * figures stay honest throughout; only the verdict waits.
 */
const SETTLING_IN_DAYS = 14;

/**
 * The settling-in period never takes more than this much of the award, so a
 * short award is not half over before it can report anything.
 */
const SETTLING_IN_MAX_FRACTION = 0.25;

/**
 * How far from the ideal line counts as off it. Below this the difference is
 * not worth a team's attention, and on a long award a few percent is a normal
 * week.
 */
const PACE_TOLERANCE = 0.05;

export type AwardPaceStatus =
  'settling' | 'behind' | 'on-track' | 'ahead' | 'exhausted' | 'ended';

export interface AwardPaceInput {
  /** Award window. Both are needed; these are the dates the funder set. */
  startDate: string | null | undefined;
  endDate: string | null | undefined;
  allocationCredits: number | null | undefined;
  usageCredits: number | null | undefined;
}

export interface AwardPace {
  startDate: string;
  endDate: string;
  allocation: number;
  used: number;
  remaining: number;
  totalDays: number;
  elapsedDays: number;
  remainingDays: number;
  /** Where the award is in its window, 0–1. */
  elapsedFraction: number;
  /** How much of the allocation is gone, 0 upwards — over 1 when overspent. */
  usedFraction: number;
  /**
   * Spend per day *from today* that uses up what is left by the end date. This
   * is the number a team can act on — what the whole allocation averaged over
   * the whole window would have needed is history once any of it has gone.
   * Null on the last day, when there are no days left to spread it over.
   */
  requiredPerDay: number | null;
  /** The same figure over the whole window, for reference. */
  requiredPerDayOverall: number;
  /** Spend per day so far, over the elapsed part of the window. */
  actualPerDay: number;
  /** Where the current rate lands by the end date. */
  projectedTotal: number;
  /** Positive when the current rate overspends, negative when it underspends. */
  projectedDifference: number;
  /**
   * When the allocation runs out at the current rate — null when that falls
   * after the award ends, because it does not then happen: the award closes
   * first and the rest is lost rather than spent.
   */
  exhaustionDate: string | null;
  status: AwardPaceStatus;
}

const daysBetween = (from: DateTime, to: DateTime): number =>
  Math.round(to.startOf('day').diff(from.startOf('day'), 'days').days);

/**
 * How an award is tracking against its own window: what it should have spent by
 * now, what it has, and where the current rate lands.
 *
 * Deliberately about the *award*, not about this project's share of it. Usage
 * is summed by the backend over the award's attachment windows and keyed by the
 * award's own identifier, so an award that has moved between projects reports
 * the same total to each — which is right for "is this award on track" and
 * would be wrong under any label that said "your project has spent".
 *
 * Returns null when there is nothing to pace: no window, a window that does not
 * run forwards, or no allocation to measure against. A pace card built on a
 * guessed window is worse than none.
 */
export const buildAwardPace = (
  input: AwardPaceInput,
  today: Date = new Date(),
): AwardPace | null => {
  const allocation = Number(input.allocationCredits);
  if (!input.startDate || !input.endDate || !Number.isFinite(allocation)) {
    return null;
  }
  if (allocation <= 0) {
    return null;
  }

  const start = parseDate(input.startDate).startOf('day');
  const end = parseDate(input.endDate).startOf('day');
  const now = parseDate(today).startOf('day');
  if (!start.isValid || !end.isValid) {
    return null;
  }

  const totalDays = daysBetween(start, end);
  if (totalDays <= 0) {
    return null;
  }

  const used = Math.max(0, Number(input.usageCredits) || 0);
  const elapsedDays = Math.min(Math.max(daysBetween(start, now), 0), totalDays);
  const remainingDays = totalDays - elapsedDays;

  const elapsedFraction = elapsedDays / totalDays;
  const usedFraction = used / allocation;
  const requiredPerDayOverall = allocation / totalDays;
  const actualPerDay = elapsedDays > 0 ? used / elapsedDays : 0;
  const projectedTotal = actualPerDay * totalDays;

  const remaining = allocation - used;
  const requiredPerDay =
    remainingDays > 0 ? Math.max(0, remaining) / remainingDays : null;

  const runsOutOn =
    actualPerDay > 0 && remaining > 0
      ? now.plus({ days: remaining / actualPerDay })
      : null;
  // A run-out date past the end of the award is not an event: the award closes
  // first, and the balance still sitting there is lost rather than spent. Shown
  // anyway it contradicts the unused figure beside it.
  const exhaustionDate =
    runsOutOn && runsOutOn <= end ? formatISODate(runsOutOn) : null;

  // Capped so a short award is not most of the way through before it can say
  // anything, and floored at nothing for an award shorter than that.
  const settlingDays = Math.min(
    SETTLING_IN_DAYS,
    Math.floor(totalDays * SETTLING_IN_MAX_FRACTION),
  );

  const delta = usedFraction - elapsedFraction;
  const status: AwardPaceStatus =
    now >= end
      ? 'ended'
      : used >= allocation
        ? 'exhausted'
        : elapsedDays < settlingDays
          ? 'settling'
          : delta < -PACE_TOLERANCE
            ? 'behind'
            : delta > PACE_TOLERANCE
              ? 'ahead'
              : 'on-track';

  return {
    startDate: formatISODate(start),
    endDate: formatISODate(end),
    allocation,
    used,
    remaining,
    totalDays,
    elapsedDays,
    remainingDays,
    elapsedFraction,
    usedFraction,
    requiredPerDay,
    requiredPerDayOverall,
    actualPerDay,
    projectedTotal,
    projectedDifference: projectedTotal - allocation,
    exhaustionDate,
    status,
  };
};

export interface AwardWindow {
  startDate: string | null;
  endDate: string | null;
}

/**
 * The window to pace an award against.
 *
 * `details.start_date` and `details.end_date` are the funder's own dates, and
 * both are nullable — the serializer calls them proposed dates. Where one is
 * missing, fall back to something the portal knows for certain:
 *
 * - start → the day the award was first attached to a project. Usage is only
 *   counted from attachment anyway, so this never starts the clock before
 *   there was anything to count.
 * - end → the project's own end date, which for an award-backed project is set
 *   from the award.
 *
 * An end date is the one thing with no substitute: without it there is no
 * window, no required rate and no pace, so the caller hides the card.
 */
export const resolveAwardWindow = (
  awardStart: string | null | undefined,
  awardEnd: string | null | undefined,
  firstAttachedAt: string | null | undefined,
  projectEndDate: string | null | undefined,
): AwardWindow => ({
  startDate:
    awardStart ||
    (firstAttachedAt ? formatISODate(parseDate(firstAttachedAt)) : null),
  endDate: awardEnd || projectEndDate || null,
});

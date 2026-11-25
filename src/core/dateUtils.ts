import { DateTime, ToRelativeUnit } from 'luxon';

import { ENV } from '@/core/config';

type DateInput = DateTime | Date | string | number | number[];

type DateFormatter = (date: DateInput) => string;

export const parseDate = (value: DateInput) => {
  if (value instanceof DateTime) {
    return value;
  } else if (typeof value === 'undefined' || value === null) {
    return DateTime.now();
  } else if (typeof value === 'string') {
    // Parse ISO string while preserving original timezone info
    // If no timezone is specified, use local timezone as fallback
    const parsed = DateTime.fromISO(value);
    return parsed.isValid
      ? parsed
      : DateTime.fromISO(value, { zone: DateTime.local().zone });
  } else if (value instanceof Date) {
    return DateTime.fromJSDate(value);
  } else if (typeof value === 'number') {
    return DateTime.fromMillis(value);
  } else if (value instanceof Array) {
    return DateTime.fromObject({
      year: value[0],
      month: value[1] + 1, // convert 0-based to 1-based
      day: value[2],
      hour: value[3],
      minute: value[4],
      second: value[5],
      millisecond: value[6],
    });
  }
};

// Date order is pinned, not taken from the locale, which puts the month first
// in English. Month names stay localised. A deployment may choose its own
// order and clock through its translation domain (see DOMAIN_DATE_FORMATS).
// Fully numeric dates (formatISODate, the date pickers) stay ISO everywhere.

interface DisplayFormats {
  /** 26 Feb 2027 */
  date: string;
  /** 26 February 2027 (MMMM: see formatMediumDateTime) */
  longDate: string;
  /** The time in a date and time: 14:00 */
  time: string;
  /** A time on its own: 14:00 */
  clock: string;
}

const DAY_FIRST: DisplayFormats = {
  date: 'd LLL yyyy',
  longDate: 'd MMMM yyyy',
  // As the locale writes it.
  time: 't',
  clock: 'T',
};

/** Feb 26, 2027, 2:00 PM */
const MONTH_FIRST_12_HOUR: DisplayFormats = {
  date: 'LLL d, yyyy',
  longDate: 'MMMM d, yyyy',
  time: 'h:mm a',
  clock: 'h:mm a',
};

/** Display formats by `TRANSLATION_DOMAIN`; others are day first. */
export const DOMAIN_DATE_FORMATS: Record<string, DisplayFormats> = {
  airrportal: MONTH_FIRST_12_HOUR,
};

const displayFormats = (): DisplayFormats =>
  DOMAIN_DATE_FORMATS[ENV.plugins?.WALDUR_CORE?.TRANSLATION_DOMAIN] ??
  DAY_FIRST;

const dateTimeFormat = () => {
  const { date, time } = displayFormats();
  return `${date}, ${time}`;
};

/** @example 2027-02-26 */
export const formatISODate: DateFormatter = (date) =>
  parseDate(date).toISODate();

/** @example 26 Feb 2027 (AIRR: Feb 26, 2027) */
export const formatDate: DateFormatter = (date) =>
  parseDate(date).toFormat(displayFormats().date);

/** @example 26 February 2027 (AIRR: February 26, 2027) */
export const formatLongDate: DateFormatter = (date) =>
  parseDate(date).toFormat(displayFormats().longDate);

/** @example 26 Feb 2027, 14:00 (AIRR: Feb 26, 2027, 2:00 PM) */
export const formatDateTime: DateFormatter = (date) =>
  parseDate(date).toFormat(dateTimeFormat());

/** @example 26 February 2027, 14:00 (AIRR: February 26, 2027, 2:00 PM) */
export const formatLongDateTime: DateFormatter = (date) => {
  const { longDate, time } = displayFormats();
  return parseDate(date).toFormat(`${longDate}, ${time}`);
};

/**
 * The viewer's offset from UTC at that moment: summer time included, so a
 * date in July and one in December may differ.
 * @example GMT+7, GMT+5:30, GMT
 */
export const formatZoneOffset: DateFormatter = (date) => {
  const local = parseDate(date).toLocal();
  return local.offset === 0 ? 'GMT' : `GMT${local.toFormat('Z')}`;
};

/**
 * A date and time in the viewer's time zone, saying which: for deadlines
 * read by people in several countries.
 * @example 13 Nov 2026, 17:00 (GMT+7)
 */
export const formatDateTimeWithZone: DateFormatter = (date) =>
  `${formatDateTime(parseDate(date).toLocal())} (${formatZoneOffset(date)})`;

/** @example 14:21 (AIRR: 2:21 PM) */
export const formatTime: DateFormatter = (date) =>
  parseDate(date).toFormat(displayFormats().clock);

// Luxon picks the display unit (years/months/days/...) from the un-rounded
// diff, then rounds the number within that unit. That means a value like
// 11.8 months (raw years diff 0.98, below the years bucket's own >=1
// threshold) never crosses into "years" — it prints "in 12 months" instead
// of "in 1 year". After Luxon picks a bucket, check whether the rounded
// count reaches that unit's exact conversion into the next one up and, if
// so, carry it over — the same rollover you'd want when rounding 59.6
// seconds to "1 minute" rather than "60 seconds".
const RELATIVE_UNITS: ToRelativeUnit[] = [
  'years',
  'months',
  'days',
  'hours',
  'minutes',
  'seconds',
];

const CARRY_THRESHOLDS: Partial<
  Record<ToRelativeUnit, [ToRelativeUnit, number]>
> = {
  months: ['years', 12],
  hours: ['days', 24],
  minutes: ['hours', 60],
  seconds: ['minutes', 60],
};

/** A calendar date carries no time, so `2026-09-10` is the whole of that day
 *  rather than the instant it begins. Measuring it from the current *instant*
 *  loses most of today: a date nine days out reads as "in 8 days" for all but
 *  the first moments of the morning. Whole days are therefore measured between
 *  start-of-day and start-of-day, and only sub-day units are dropped with them
 *  — a date has no hours to report. Timestamps keep instant precision. */
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const WHOLE_DAY_UNITS: ToRelativeUnit[] = ['years', 'months', 'days'];

export const formatRelative: DateFormatter = (date) => {
  const target = parseDate(date);
  const isWholeDay = typeof date === 'string' && DATE_ONLY_PATTERN.test(date);
  const now = isWholeDay
    ? DateTime.fromObject({}, { zone: target.zone }).startOf('day')
    : DateTime.fromObject({}, { zone: target.zone });
  const units = isWholeDay ? WHOLE_DAY_UNITS : RELATIVE_UNITS;

  for (const [index, unit] of units.entries()) {
    const rawCount = target.diff(now, unit).get(unit);
    const isLastUnit = index === units.length - 1;

    if (Math.abs(rawCount) >= 1 || isLastUnit) {
      const carry = CARRY_THRESHOLDS[unit];
      const crossesIntoNextUnit =
        carry && Math.abs(Math.round(rawCount)) >= carry[1];
      const displayUnit = crossesIntoNextUnit ? carry[0] : unit;

      // A whole day that rounds to zero is today, and "in 0 days" is worse
      // than the hours count it replaced. `toRelativeCalendar` is the call that
      // words it — `toRelative` has no `numeric` option to pass through, it
      // always formats numerically. Only this case uses it: applying it
      // generally would render every "in 1 day" as "tomorrow" across the app.
      if (isWholeDay && displayUnit === 'days' && Math.round(rawCount) === 0) {
        return target.toRelativeCalendar({ base: now, unit: 'days' });
      }
      // `base` matters as much as the loop above: without it Luxon measures
      // from the real current instant, so the unit would be chosen from one
      // reference and the number rendered from another.
      return target.toRelative({
        base: now,
        unit: displayUnit,
        rounding: 'round',
      });
    }
  }

  return target.toRelative({ base: now, rounding: 'round' });
};

/* ── End dates are exclusive ──────────────────────────────────────────────────
 *
 * Waldur ends access *at* an end date, not after it: Project.is_expired is
 * `effective_end_date <= today`, so on the date itself the project is already
 * over and the resources are gone. The last day anyone can actually use it is
 * therefore the day before.
 *
 * Users read "ends 30 Sep" as "I have until the 30th" and lose a day of work
 * to it, so anything counting down to an end date counts to the last usable
 * day instead, and any sentence phrased as "active until" names that day
 * rather than the end date.
 */

/** The last day access is available for an (exclusive) end date. */
export const lastAccessDate = (endDate: DateInput): DateTime =>
  parseDate(endDate).startOf('day').minus({ days: 1 });

/**
 * Whole days from today to the last day of access.
 * 0 means today is the last day; negative means access has already ended.
 */
export const daysUntilAccessEnds = (endDate: DateInput): number =>
  Math.round(
    lastAccessDate(endDate).diff(
      DateTime.now().setZone(parseDate(endDate).zone).startOf('day'),
      'days',
    ).days,
  );

/**
 * Countdown to the last day of access, e.g. "in 13 days" for an end date 14
 * days out. Formatted as a whole day so it is measured start-of-day to
 * start-of-day rather than from the current instant.
 */
export const formatRelativeEndDate: DateFormatter = (endDate) =>
  formatRelative(lastAccessDate(endDate).toISODate());

export const formatRelativeWithHour: DateFormatter = (date) => {
  const dateDiff = parseDate(date).diffNow(['hours', 'minutes']);

  if (dateDiff.hours > 24) {
    return parseDate(date).toRelative();
  } else {
    const hours = dateDiff.hours;
    const minutes = dateDiff.minutes;

    if (hours > 0 && minutes > 0) {
      return `${hours} hours ${minutes.toFixed(0)} minutes`;
    } else if (hours > 0) {
      return `${hours} hours`;
    } else {
      return `${minutes.toFixed(0)} minutes`;
    }
  }
};

// MMMM, not LLLL: the format form carries the right grammatical case when the
// day precedes the month (fi heinäkuuta, ru июля, lt liepos). Identical in
// English. The abbreviated formatters keep LLL — MMM degrades to a bare number
// in Finnish and Czech, which is the thing this file exists to avoid.
/** @example 22 July 2024, 14:00 GMT+2 */
export const formatMediumDateTime: DateFormatter = (date) => {
  const { longDate, time } = displayFormats();
  return parseDate(date).toFormat(`${longDate}, ${time} ZZZZ`);
};

/** @example 22 Jul 2024, 14:00 */
export const formatShortDateTime: DateFormatter = (date) =>
  parseDate(date).toFormat(dateTimeFormat());

/** @example 2024-07-22T14:00 */
export const formatISOWithoutZone: DateFormatter = (date) =>
  parseDate(date).toFormat("yyyy-MM-dd'T'T");

/** @example July 2022 */
export const formatMonth: DateFormatter = (date) =>
  parseDate(date).toFormat('MMMM yyyy');

export const calculateMonthsDifference = (
  startDate: string,
  endDate: string,
): number => {
  const start = DateTime.fromISO(startDate);
  const end = DateTime.fromISO(endDate);

  return Math.round(end.diff(start, 'months').months);
};

export const formatUptime = (date) => {
  const start = parseDate(date);
  const now = DateTime.now();
  const diff = now.diff(start, ['days', 'hours', 'minutes']).toObject();

  const days = Math.floor(diff.days || 0);
  const hours = Math.floor(diff.hours || 0);
  const minutes = Math.floor(diff.minutes || 0);

  if (days > 1000) {
    return `${days}d`;
  } else if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  } else if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  } else {
    return `${minutes}m`;
  }
};

import { describe, expect, it } from 'vitest';

import {
  parsePercentages,
  patternError,
  percentagePattern,
  periodsFromPercentages,
  runningTotals,
  spendPeriods,
  todayUtc,
  unsupportedControls,
  withUnits,
} from './spendProfile';

const PROFILE = [
  { from: '2026-07-01', minimum: '100 NHR', maximum: '300 NHR' },
  { from: '2026-01-01', minimum: '250 NHR', maximum: '250 NHR' },
  { from: '2026-10-01' },
];

describe('spend profile periods', () => {
  it('runs each period to the day before the next, the last to the award end', () => {
    const periods = spendPeriods(PROFILE, '2026-12-31', '2026-08-15');
    expect(periods.map((p) => [p.from, p.to])).toEqual([
      ['2026-01-01', '2026-06-30'],
      ['2026-07-01', '2026-09-30'],
      ['2026-10-01', '2026-12-31'],
    ]);
  });

  it('tells ended, current and upcoming periods apart', () => {
    const periods = spendPeriods(PROFILE, '2026-12-31', '2026-08-15');
    expect(periods.map((p) => p.status)).toEqual([
      'ended',
      'current',
      'upcoming',
    ]);
    // A period's first and last days both belong to it.
    expect(spendPeriods(PROFILE, '2026-12-31', '2026-07-01')[1].status).toBe(
      'current',
    );
    expect(spendPeriods(PROFILE, '2026-12-31', '2026-09-30')[1].status).toBe(
      'current',
    );
  });

  it('reads amounts from "250 NHR" and leaves unset controls null', () => {
    const [first, , last] = spendPeriods(PROFILE, '2026-12-31', '2026-08-15');
    expect(first).toMatchObject({ minimum: 250, maximum: 250 });
    expect(last).toMatchObject({ minimum: null, maximum: null });
  });

  it('sums minimums and caps by maximums so far, never above the award', () => {
    const periods = spendPeriods(PROFILE, '2026-12-31', '2026-08-15');
    expect(runningTotals(periods, 500)).toEqual([
      { minimum: 250, cap: 250 },
      { minimum: 350, cap: 500 },
      // No maximum of its own: no cap.
      { minimum: 350, cap: null },
    ]);
  });

  it('counts days in UTC', () => {
    expect(todayUtc(new Date('2026-03-31T23:30:00-02:00'))).toBe('2026-04-01');
  });

  it('writes amounts with the award units', () => {
    expect(withUnits(250, 'NHR')).toBe('250 NHR');
    expect(withUnits(12.5, undefined)).toBe('12.5');
  });
});

// A period that only marks a date, with no controls.
const NO_CONTROLS = [{ from: '2026-01-01' }];

describe('controls the site has not said it enforces', () => {
  it('warns of each control the profile uses and the site lacks', () => {
    expect(unsupportedControls(PROFILE, [])).toEqual({
      minimums: true,
      maximums: true,
    });
    expect(unsupportedControls(PROFILE, ['award_spend_minimums'])).toEqual({
      minimums: false,
      maximums: true,
    });
    expect(
      unsupportedControls(PROFILE, [
        'award_spend_minimums',
        'award_spend_maximums',
      ]),
    ).toEqual({ minimums: false, maximums: false });
  });

  it('says nothing for a profile without controls, even unasked', () => {
    expect(unsupportedControls(null, null)).toEqual({
      minimums: false,
      maximums: false,
    });
    expect(unsupportedControls(NO_CONTROLS, null)).toEqual({
      minimums: false,
      maximums: false,
    });
  });
});

describe('spend profiles from percentages', () => {
  const YEAR = { start: '2027-01-01', end: '2027-12-31' };

  it('reads a list of percentages', () => {
    expect(parsePercentages('10, 20, 30%, 40')).toEqual([10, 20, 30, 40]);
    expect(parsePercentages('')).toEqual([]);
    expect(parsePercentages('10, twenty')).toBeNull();
  });

  it('offers equal and rising shapes that add up to 100', () => {
    expect(percentagePattern(4, 'rising')).toEqual([10, 20, 30, 40]);
    expect(percentagePattern(4, 'equal')).toEqual([25, 25, 25, 25]);
    expect(percentagePattern(3, 'equal')).toEqual([33.33, 33.33, 33.34]);
  });

  it('divides the award into equal periods with their shares', () => {
    expect(
      periodsFromPercentages(
        { count: 4, minimums: [10, 20, 30, 40], maximums: [10, 20, 30, 40] },
        YEAR,
        10000,
      ),
    ).toEqual([
      { from: '2027-01-01', minimum: 1000, maximum: 1000 },
      { from: '2027-04-02', minimum: 2000, maximum: 2000 },
      { from: '2027-07-02', minimum: 3000, maximum: 3000 },
      { from: '2027-10-01', minimum: 4000, maximum: 4000 },
    ]);
  });

  it('leaves a control out when no percentages are given for it', () => {
    const [first] = periodsFromPercentages(
      { count: 2, minimums: [], maximums: [50, 50] },
      YEAR,
      10000,
    );
    expect(first).toEqual({ from: '2027-01-01', minimum: null, maximum: 5000 });
  });

  it('says what is wrong with a pattern', () => {
    const check = (count, minimums, maximums, window = YEAR) =>
      patternError({ count, minimums, maximums }, window);
    expect(check(4, [10, 20, 30, 40], [10, 20, 30, 40])).toBeUndefined();
    expect(check(0, [], [100])).toBe('Choose between 1 and 24 periods.');
    expect(check(4, [], [])).toBe('Give the minimum or maximum percentages.');
    expect(check(4, [10, 20, 30], [])).toBe(
      'Give one percentage for each of the 4 periods.',
    );
    expect(check(2, [], [60, 60])).toBe(
      'The percentages add up to more than 100.',
    );
    expect(check(2, [60, 10], [50, 50])).toBe(
      'A minimum is more than its maximum.',
    );
    expect(check(2, [], [50, 50], { start: '2027-01-01', end: null })).toBe(
      'The award has no end date to divide up to.',
    );
  });
});

import { describe, expect, it } from 'vitest';

import { buildAwardPace, resolveAwardWindow } from './awardPace';

// Local midnight rather than a UTC instant: the window is measured in whole
// calendar days in the reader's own zone.
const on = (year: number, month: number, day: number) =>
  new Date(year, month - 1, day);

const award = {
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  allocationCredits: 53750,
  usageCredits: 0,
};

describe('buildAwardPace', () => {
  it('measures the window in calendar days', () => {
    const pace = buildAwardPace(award, on(2026, 7, 1))!;

    expect(pace.totalDays).toBe(364);
    expect(pace.elapsedDays).toBe(181);
    expect(pace.remainingDays).toBe(183);
  });

  it('derives the rate the allocation has to be spent at', () => {
    const pace = buildAwardPace(award, on(2026, 7, 1))!;

    expect(pace.requiredPerDay).toBeCloseTo(53750 / 364, 2);
  });

  it('measures the actual rate over the elapsed window, not the whole one', () => {
    const pace = buildAwardPace(
      { ...award, usageCredits: 18100 },
      on(2026, 7, 1),
    )!;

    expect(pace.actualPerDay).toBeCloseTo(18100 / 181, 2);
    // Half the window gone at that rate lands close to the allocation.
    expect(pace.projectedTotal).toBeCloseTo((18100 / 181) * 364, 0);
  });

  it('reports on-track when spend keeps up with the window', () => {
    // Half the window, half the allocation.
    const pace = buildAwardPace(
      { ...award, usageCredits: 26875 },
      on(2026, 7, 1),
    )!;

    expect(pace.status).toBe('on-track');
    expect(Math.abs(pace.projectedDifference)).toBeLessThan(500);
  });

  // Use it or lose it: an award that is not being spent is the case worth
  // warning about, so this is the status that has to fire reliably.
  it('reports behind when spend falls off the line', () => {
    const pace = buildAwardPace(
      { ...award, usageCredits: 10000 },
      on(2026, 7, 1),
    )!;

    expect(pace.status).toBe('behind');
    expect(pace.projectedDifference).toBeLessThan(0);
  });

  it('reports ahead when spend runs in front of it', () => {
    const pace = buildAwardPace(
      { ...award, usageCredits: 40000 },
      on(2026, 7, 1),
    )!;

    expect(pace.status).toBe('ahead');
    expect(pace.exhaustionDate).not.toBeNull();
    expect(pace.exhaustionDate! < pace.endDate).toBe(true);
  });

  it('reports the allocation exhausted rather than merely ahead', () => {
    const pace = buildAwardPace(
      { ...award, usageCredits: 53750 },
      on(2026, 7, 1),
    )!;

    expect(pace.status).toBe('exhausted');
    expect(pace.exhaustionDate).toBeNull();
  });

  it('reports the award ended once past its end date', () => {
    const pace = buildAwardPace(
      { ...award, usageCredits: 10000 },
      on(2027, 1, 5),
    )!;

    expect(pace.status).toBe('ended');
    expect(pace.elapsedDays).toBe(pace.totalDays);
  });
});

// A team that has just been given an award has had no chance to spend
// anything. Told strictly, they would be behind on day two, and the first thing
// they ever saw would be a warning about a gap they could not have closed.
describe('the settling-in period', () => {
  it('withholds the verdict over the first days of an award', () => {
    const pace = buildAwardPace(award, on(2026, 1, 8))!;

    expect(pace.status).toBe('settling');
  });

  it('starts reporting once the award has had time to get going', () => {
    const pace = buildAwardPace(award, on(2026, 1, 20))!;

    expect(pace.status).toBe('behind');
  });

  it('still reports the figures honestly while it waits', () => {
    // Only the verdict is held back; the numbers are the real ones throughout,
    // so nothing on the card contradicts what it later starts saying.
    const pace = buildAwardPace(
      { ...award, usageCredits: 100 },
      on(2026, 1, 8),
    )!;

    expect(pace.used).toBe(100);
    expect(pace.elapsedDays).toBe(7);
    expect(pace.actualPerDay).toBeCloseTo(100 / 7, 2);
  });

  // Fourteen days of a three-week award would be most of it.
  it('shrinks to a quarter of a short award', () => {
    const short = {
      ...award,
      startDate: '2026-01-01',
      endDate: '2026-01-21',
      usageCredits: 0,
    };

    expect(buildAwardPace(short, on(2026, 1, 4))!.status).toBe('settling');
    expect(buildAwardPace(short, on(2026, 1, 10))!.status).toBe('behind');
  });
});

describe('when there is nothing to pace', () => {
  it.each([
    ['no start date', { startDate: null }],
    ['no end date', { endDate: null }],
    ['no allocation', { allocationCredits: null }],
    ['a zero allocation', { allocationCredits: 0 }],
    ['a window that does not run forwards', { endDate: '2025-12-31' }],
    ['a window of one day', { startDate: '2026-01-01', endDate: '2026-01-01' }],
  ])('returns nothing for %s', (_label, override) => {
    expect(
      buildAwardPace({ ...award, ...override }, on(2026, 7, 1)),
    ).toBeNull();
  });
});

describe('resolveAwardWindow', () => {
  it("prefers the funder's own dates", () => {
    expect(
      resolveAwardWindow(
        '2026-01-01',
        '2026-12-31',
        '2026-02-01T09:00:00Z',
        '2027-01-01',
      ),
    ).toEqual({ startDate: '2026-01-01', endDate: '2026-12-31' });
  });

  it('falls back to the first attachment and the project end date', () => {
    expect(
      resolveAwardWindow(null, null, '2026-02-01T09:00:00Z', '2027-01-01'),
    ).toEqual({ startDate: '2026-02-01', endDate: '2027-01-01' });
  });

  it('leaves the end date null when nothing supplies one', () => {
    expect(
      resolveAwardWindow('2026-01-01', null, null, null).endDate,
    ).toBeNull();
  });
});

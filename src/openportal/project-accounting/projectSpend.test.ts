import { describe, expect, it } from 'vitest';

import { buildProjectSpend } from './projectSpend';

const summary = (overrides = {}): any => ({
  start_date: '2026-01-01',
  end_date: '2026-12-31',
  // Inflated by every credit that ever arrived as a negative invoice item, so
  // deliberately not the balance. Set high here to keep it out of the sums.
  total_credits: '999999.00',
  total_spend: '400.00',
  current_month_spend: '150.00',
  ...overrides,
});

describe('buildProjectSpend', () => {
  it('adds the current month to the earlier months for the total used', () => {
    // total_spend excludes the current month, so neither figure is the total.
    expect(buildProjectSpend(summary(), 1000)?.usedTotal).toBe(550);
  });

  // Mirrors waldur_openportal.utils.get_project_credits: the start-of-month
  // balance plus the spend already taken off it is the allocation, because
  // set_project_credits wrote value = allocation - that spend.
  it('recovers the allocation from the balance and the spend taken off it', () => {
    expect(buildProjectSpend(summary(), 1000)?.allocation).toBe(1400);
  });

  // The summary's total_credits starts from ProjectCredit.value and then adds
  // back every credit that arrived as a negative invoice item, so on a project
  // with compensation history it overstates the balance badly. Using it here
  // inflated one real project's allocation from ~289k to ~432k.
  it('ignores the summary total_credits in favour of the real balance', () => {
    const spend = buildProjectSpend(
      summary({ total_credits: '287979.34' }),
      1000,
    );
    expect(spend?.allocation).toBe(1400);
  });

  it('keeps remaining consistent with allocation less usage', () => {
    const spend = buildProjectSpend(summary(), 1000)!;
    expect(spend.remaining).toBe(spend.allocation - spend.usedTotal);
    // Which is also the start-of-month balance less this month's spend -- the
    // estimated end-of-month balance the stock Accounting widget reports.
    expect(spend.remaining).toBe(1000 - 150);
  });

  // The figures from the project that surfaced the bug.
  it('reproduces a real project', () => {
    const spend = buildProjectSpend(
      summary({ total_spend: '144024.64', current_month_spend: '5412.48' }),
      '145170.59',
    )!;
    expect(spend.usedTotal).toBeCloseTo(149437.12, 2);
    expect(spend.allocation).toBeCloseTo(289195.23, 2);
    expect(spend.remaining).toBeCloseTo(139758.11, 2);
  });

  it('accepts the balance as the decimal string the API sends', () => {
    expect(buildProjectSpend(summary(), '1000.00')?.allocation).toBe(1400);
  });

  it('carries the window through', () => {
    const spend = buildProjectSpend(summary(), 1000);
    expect(spend?.startDate).toBe('2026-01-01');
    expect(spend?.endDate).toBe('2026-12-31');
  });

  it('accepts a project with no end date', () => {
    expect(
      buildProjectSpend(summary({ end_date: null }), 1000)?.endDate,
    ).toBeNull();
  });

  it('returns null without a start date, so the caller shows nothing', () => {
    expect(buildProjectSpend(summary({ start_date: null }), 1000)).toBeNull();
    expect(buildProjectSpend(null, 1000)).toBeNull();
    expect(buildProjectSpend(undefined, 1000)).toBeNull();
  });

  // A project with no ProjectCredit row at all: the spend is still real, the
  // allocation is just the spend, and the bar reads full rather than NaN.
  it('treats a missing balance as zero rather than NaN', () => {
    const spend = buildProjectSpend(summary(), null)!;
    expect(spend.allocation).toBe(400);
    expect(spend.usedTotal).toBe(550);
    expect(spend.remaining).toBe(-150);
  });
});

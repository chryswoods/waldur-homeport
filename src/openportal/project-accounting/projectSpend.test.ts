import { describe, expect, it } from 'vitest';

import { buildProjectSpend } from './projectSpend';

const summary = (overrides = {}): any => ({
  start_date: '2026-01-01',
  end_date: '2026-12-31',
  total_credits: '1000.00',
  total_spend: '400.00',
  current_month_spend: '150.00',
  ...overrides,
});

describe('buildProjectSpend', () => {
  it('adds the current month to the earlier months for the total used', () => {
    // total_spend excludes the current month, so neither figure is the total.
    expect(buildProjectSpend(summary())?.usedTotal).toBe(550);
  });

  // Mirrors waldur_openportal.utils.get_project_credits: the start-of-month
  // balance plus the spend already taken off it is the allocation, because
  // set_project_credits wrote value = allocation - that spend.
  it('recovers the allocation from the balance and the spend taken off it', () => {
    expect(buildProjectSpend(summary())?.allocation).toBe(1400);
  });

  it('keeps remaining consistent with allocation less usage', () => {
    const spend = buildProjectSpend(summary())!;
    expect(spend.remaining).toBe(spend.allocation - spend.usedTotal);
    // Which is also the start-of-month balance less this month's spend, the
    // figure Waldur's own accounting reports.
    expect(spend.remaining).toBe(1000 - 150);
  });

  it('carries the window through', () => {
    const spend = buildProjectSpend(summary());
    expect(spend?.startDate).toBe('2026-01-01');
    expect(spend?.endDate).toBe('2026-12-31');
  });

  it('accepts a project with no end date', () => {
    expect(buildProjectSpend(summary({ end_date: null }))?.endDate).toBeNull();
  });

  it('returns null without a start date, so the caller shows nothing', () => {
    expect(buildProjectSpend(summary({ start_date: null }))).toBeNull();
    expect(buildProjectSpend(null)).toBeNull();
    expect(buildProjectSpend(undefined)).toBeNull();
  });

  it('treats unparseable figures as zero rather than NaN', () => {
    const spend = buildProjectSpend(
      summary({ total_spend: '', current_month_spend: null }),
    );
    expect(spend?.usedTotal).toBe(0);
    expect(spend?.currentMonth).toBe(0);
    expect(spend?.allocation).toBe(1000);
  });
});

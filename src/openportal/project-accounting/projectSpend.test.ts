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

  it('takes the current month off the balance for what is left', () => {
    // total_credits is the balance at the start of the month: credit is drawn
    // down when the month is invoiced, not as usage accrues.
    expect(buildProjectSpend(summary())?.remaining).toBe(850);
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
    expect(spend?.remaining).toBe(1000);
  });
});

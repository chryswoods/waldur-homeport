import { describe, expect, it } from 'vitest';

import { buildMonthlyUsage, consumptionTotal } from './monthlyUsage';

const invoice = (year: number, month: number, incurred: number) =>
  ({ year, month, incurred, compensation: 0, price: incurred }) as any;

const today = new Date(2026, 8, 18); // 18 Sep 2026

describe('buildMonthlyUsage', () => {
  // The bug this replaces: the stock chart plots `compensation`, which under
  // award accounting is zero every month because OpenPortal sets the balance
  // directly and writes no compensation items.
  it('reads usage, not credit compensation', () => {
    const months = buildMonthlyUsage(
      [{ year: 2026, month: 7, incurred: 16800, compensation: 0 } as any],
      '2026-06-01',
      '2026-08-31',
      today,
    );

    expect(months.map((m) => m.value)).toEqual([0, 16800, 0]);
  });

  // A fixed frame, so the bars march across it as the award runs rather than
  // the axis rescaling every month.
  it('spans the award window, not the months that have invoices', () => {
    const months = buildMonthlyUsage(
      [invoice(2026, 7, 100)],
      '2026-04-01',
      '2026-09-30',
      today,
    );

    expect(months).toHaveLength(6);
    expect(months[0].key).toBe('2026-04');
    expect(months[5].key).toBe('2026-09');
  });

  it('marks months beyond today as still to come', () => {
    const months = buildMonthlyUsage([], '2026-08-01', '2026-11-30', today);

    expect(months.map((m) => m.isFuture)).toEqual([false, false, true, true]);
  });

  it('tells an empty month from one with no invoice at all', () => {
    const months = buildMonthlyUsage(
      [invoice(2026, 8, 0)],
      '2026-08-01',
      '2026-09-30',
      today,
    );

    expect(months[0].hasInvoice).toBe(true);
    expect(months[1].hasInvoice).toBe(false);
  });

  it.each([
    ['a window that runs backwards', '2026-09-01', '2026-04-01'],
    ['an unparseable start', 'not-a-date', '2026-09-01'],
  ])('returns nothing for %s', (_label, start, end) => {
    expect(buildMonthlyUsage([], start, end, today)).toEqual([]);
  });

  it('sums the window', () => {
    const months = buildMonthlyUsage(
      [invoice(2026, 7, 100), invoice(2026, 8, 250)],
      '2026-07-01',
      '2026-09-30',
      today,
    );

    expect(consumptionTotal(months)).toBe(350);
  });
});

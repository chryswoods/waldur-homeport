import { DateTime } from 'luxon';
import { type InvoiceCost } from 'waldur-js-client';

import { parseDate } from '@/core/dateUtils';

export interface ConsumptionMonth {
  /** "YYYY-MM", for keying and tests. */
  key: string;
  /** Axis label, e.g. "Sep 26". */
  label: string;
  /** Usage booked that month, gross of any credit compensation. */
  value: number;
  /** False when the award window covers a month with no invoice at all. */
  hasInvoice: boolean;
  isFuture: boolean;
}

/**
 * Monthly usage across an award's whole window.
 *
 * Reads `incurred` -- the sum of the positively-priced invoice items, i.e. what
 * was actually used -- rather than `compensation`, which is what the credit was
 * drawn down by. Under award accounting the two are not the same: OpenPortal
 * sets the credit balance directly and writes no compensation items, so a chart
 * keyed on compensation is flat zero for every month while the project is
 * plainly consuming.
 *
 * The axis spans the award's own window rather than the months that happen to
 * have invoices, so the bars march across a fixed frame as the award runs and
 * an empty month reads as an empty month rather than being absent.
 */
export const buildAwardConsumption = (
  invoices: InvoiceCost[],
  startDate: string,
  endDate: string,
  today: Date = new Date(),
): ConsumptionMonth[] => {
  const start = parseDate(startDate).startOf('month');
  const end = parseDate(endDate).startOf('month');
  if (!start.isValid || !end.isValid || end < start) {
    return [];
  }

  const byKey = new Map(
    invoices.map((invoice) => [
      `${invoice.year}-${String(invoice.month).padStart(2, '0')}`,
      invoice,
    ]),
  );
  const thisMonth = parseDate(today).startOf('month');

  const months: ConsumptionMonth[] = [];
  for (let cursor = start; cursor <= end; cursor = cursor.plus({ months: 1 })) {
    const key = cursor.toFormat('yyyy-MM');
    const invoice = byKey.get(key);
    months.push({
      key,
      label: cursor.toFormat('LLL yy'),
      value: Math.max(0, Number(invoice?.incurred ?? 0)),
      hasInvoice: invoice !== undefined,
      isFuture: cursor > thisMonth,
    });
  }
  return months;
};

export const consumptionTotal = (months: ConsumptionMonth[]): number =>
  months.reduce((sum, month) => sum + month.value, 0);

/** Exported for the chart's own use; kept here so the axis and the bars agree. */
export const monthLabel = (month: DateTime): string => month.toFormat('LLL yy');

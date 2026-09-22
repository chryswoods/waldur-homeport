import { useQuery } from '@tanstack/react-query';
import { FC, useMemo } from 'react';
import { invoiceItemsCostsList } from 'waldur-js-client';

import { generateBrandColors } from 'waldur-design-tokens';

import { SHORT_STALE_TIME } from '@/core/constants';
import { EChart } from '@/core/EChart';
import { defaultCurrency } from '@/core/formatCurrency';
import { getBrandColor } from '@/core/utils';
import { getChartThemeColors } from '@/dashboard/chartColors';
import { WidgetCard } from '@/dashboard/WidgetCard';
import { translate } from '@/i18n';

import { buildMonthlyUsage } from './monthlyUsage';

interface Props {
  projectUuid: string;
  /** First day of the window to plot, e.g. the award's or the project's start. */
  startDate: string;
  endDate: string;
  className?: string;
}

/**
 * Monthly usage over a window.
 *
 * Replaces the stock credit consumption chart wherever OpenPortal owns the
 * accounting. That chart plots the credit compensation per month, which for an
 * award-backed project is flat zero — OpenPortal sets the credit balance
 * directly and writes no compensation items. This plots what was used instead,
 * which is the figure the chart was always understood to show.
 *
 * The window is a parameter rather than an award, so the same chart serves a
 * project whose budget comes from an award and one whose OpenPortal resources
 * are accounted for over the project's own dates.
 *
 * One request. The per-month usage is already aggregated by
 * /api/invoice-items/costs/, so nothing here needs the OpenPortal usage reports.
 */
export const MonthlyUsageChart: FC<Props> = ({
  projectUuid,
  startDate,
  endDate,
  className,
}) => {
  const { data: invoices } = useQuery({
    queryKey: ['award-consumption', projectUuid],
    queryFn: () =>
      invoiceItemsCostsList({
        // Generous enough to cover an award window in one page; the endpoint
        // returns one row per month and awards do not run for decades.
        query: { project_uuid: projectUuid, page: 1, page_size: 60 },
      }).then((response) => response.data ?? []),
    enabled: Boolean(projectUuid),
    staleTime: SHORT_STALE_TIME,
    refetchOnWindowFocus: false,
  });

  const months = useMemo(
    () => (invoices ? buildMonthlyUsage(invoices, startDate, endDate) : []),
    [invoices, startDate, endDate],
  );

  const options = useMemo(() => {
    if (months.length === 0) return null;
    const brandColors = generateBrandColors(getBrandColor());
    const c = getChartThemeColors();
    return {
      grid: { left: 70, right: 20, top: 30, bottom: 40 },
      tooltip: {
        // Bounded to the chart so a tooltip near the edge of the
        // viewport is not drawn half off-screen.
        confine: true,
        trigger: 'axis',
        valueFormatter: (value: number) => defaultCurrency(value),
      },
      xAxis: { type: 'category', data: months.map((month) => month.label) },
      yAxis: {
        type: 'value',
        name: translate('Used'),
        // Currency labels are wide and the card is short: at the default
        // density they stacked into an unreadable block down the axis.
        splitNumber: 3,
        axisLabel: { formatter: (value: number) => defaultCurrency(value) },
      },
      series: [
        {
          name: translate('Used'),
          type: 'bar',
          // A month still to come is drawn in the track colour rather than
          // left out, so the frame stays the award's whole window and the
          // bars visibly march across it.
          data: months.map((month) => ({
            value: month.value,
            itemStyle: {
              color: month.isFuture ? c.track : brandColors[300],
            },
          })),
        },
      ],
    };
  }, [months]);

  if (!options) {
    return null;
  }

  return (
    // No total in the subtitle: this sits beside a card that states it
    // already.
    <WidgetCard cardTitle={translate('Monthly usage')} className={className}>
      <div className="separator mt-4 mb-4" />
      {/* The same height as the credit chart this replaces, so the card
          matches the one beside it rather than setting its own. */}
      <EChart options={options} height="130px" />
    </WidgetCard>
  );
};

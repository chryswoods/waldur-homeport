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

import { buildAwardConsumption, consumptionTotal } from './awardConsumption';
import { type AwardPace } from './awardPace';

interface Props {
  projectUuid: string;
  pace: AwardPace;
}

/**
 * Monthly usage over the award's window.
 *
 * Replaces the stock credit consumption chart for award-backed projects, which
 * plots the credit compensation per month and is therefore flat zero for every
 * one of them: OpenPortal sets the credit balance directly and writes no
 * compensation items. This plots what was used instead, which is the figure the
 * chart was always understood to show.
 *
 * One request. The per-month usage is already aggregated by
 * /api/invoice-items/costs/, so nothing here needs the OpenPortal usage reports.
 */
export const AwardConsumptionChart: FC<Props> = ({ projectUuid, pace }) => {
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
    () =>
      invoices
        ? buildAwardConsumption(invoices, pace.startDate, pace.endDate)
        : [],
    [invoices, pace.startDate, pace.endDate],
  );

  const options = useMemo(() => {
    if (months.length === 0) return null;
    const brandColors = generateBrandColors(getBrandColor());
    const c = getChartThemeColors();
    return {
      grid: { left: 70, right: 20, top: 30, bottom: 40 },
      tooltip: {
        trigger: 'axis',
        valueFormatter: (value: number) => defaultCurrency(value),
      },
      xAxis: { type: 'category', data: months.map((month) => month.label) },
      yAxis: {
        type: 'value',
        name: translate('Used'),
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
    <WidgetCard
      cardTitle={translate('Monthly usage')}
      className="mb-5"
      title={translate('{total} used across the award so far', {
        total: defaultCurrency(consumptionTotal(months)),
      })}
    >
      <div className="separator mt-4 mb-5" />
      <EChart options={options} height="320px" />
    </WidgetCard>
  );
};

import { FC } from 'react';
import type { SpendPeriodProgress, SpendProgress } from 'waldur-js-client';

import { AlertItem } from 'waldur-ui';

import { formatDate } from '@/core/dateUtils';
import { Panel } from '@/core/Panel';
import { translate } from '@/i18n';
import { formatUsage } from '@/openportal/allocationUsage';
import { PeriodStatusBadge } from '@/openportal/remote-projects/SpendProfileTable';
import Table from '@/table/Table';
import { useTable } from '@/table/useTable';
import { renderFieldOrDash } from '@/table/utils';

/** An amount in the award's units: "250 NHR". */
const inUnits = (amount: number, units: string | null) =>
  units ? `${formatUsage(amount)} ${units}` : formatUsage(amount);

const currentPeriod = (progress: SpendProgress) =>
  progress.periods.find((period) => period.status === 'current') ?? null;

/** The day after a period's last: when the next period, or nothing, starts. */
const dayAfter = (date: string) => {
  // Kept in UTC, as the site counts days.
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
};

export interface SpendNowMessages {
  /** How much more may be spent this period, or that the cap is reached. */
  headroom: string | null;
  /** How much more must be spent this period to avoid a forfeit. */
  minimum: string | null;
}

/** What the current period allows and asks for, in words. */
export const spendNowMessages = (
  progress: SpendProgress | null | undefined,
): SpendNowMessages => {
  const period = progress ? currentPeriod(progress) : null;
  if (!period) {
    return { headroom: null, minimum: null };
  }
  const units = progress.units;
  const by = period.to ? formatDate(period.to) : null;
  let headroom: string | null = null;
  if (period.headroom !== null) {
    headroom =
      period.headroom > 0
        ? by
          ? translate('Can spend up to {amount} more by {date}.', {
              amount: inUnits(period.headroom, units),
              date: by,
            })
          : translate('Can spend up to {amount} more.', {
              amount: inUnits(period.headroom, units),
            })
        : period.to
          ? translate(
              "This period's cap is reached: jobs will be held until {date}.",
              { date: formatDate(dayAfter(period.to)) },
            )
          : translate(
              "This period's cap is reached: jobs will be held until the next period.",
            );
  }
  let minimum: string | null = null;
  const shortfall =
    period.cumulative_minimum !== null
      ? period.cumulative_minimum - (period.cumulative_spend ?? 0)
      : 0;
  if (shortfall > 0) {
    minimum = by
      ? translate('Spend at least {amount} by {date} to avoid a forfeit.', {
          amount: inUnits(shortfall, units),
          date: by,
        })
      : translate('Spend at least {amount} to avoid a forfeit.', {
          amount: inUnits(shortfall, units),
        });
  }
  return { headroom, minimum };
};

/** The current period in a line or two, for the award card. */
export const SpendNow: FC<{ progress: SpendProgress | null | undefined }> = ({
  progress,
}) => {
  const { headroom, minimum } = spendNowMessages(progress);
  if (!headroom && !minimum) {
    return null;
  }
  const capReached = currentPeriod(progress)?.headroom <= 0;
  return (
    <div data-testid="spend-now">
      <div className="fs-6 text-muted fw-bold mb-1">
        {translate('This period')}
      </div>
      {headroom && (
        <div className={capReached ? 'text-danger fw-semibold' : undefined}>
          {headroom}
        </div>
      )}
      {minimum && <div className="text-warning fw-semibold">{minimum}</div>}
    </div>
  );
};

/** A forfeit as the charge it is: "109 NHR, charged on 30 Jun 2026". */
export const forfeitText = (
  period: Pick<SpendPeriodProgress, 'forfeit' | 'to'>,
  units: string | null,
): string | null => {
  if (period.forfeit === null) return null;
  if (period.forfeit <= 0) return translate('None');
  return period.to
    ? translate('{amount}, charged on {date}', {
        amount: inUnits(period.forfeit, units),
        date: formatDate(period.to),
      })
    : inUnits(period.forfeit, units);
};

const PeriodsTable: FC<{ progress: SpendProgress; scope: string }> = ({
  progress,
  scope,
}) => {
  const tableProps = useTable<SpendPeriodProgress>({
    table: `spend-progress-${scope}`,
    fetchData: () =>
      Promise.resolve({
        rows: progress.periods,
        resultCount: progress.periods.length,
      }),
  });
  const units = progress.units;
  const amount = (value: number | null) =>
    value === null ? renderFieldOrDash(null) : inUnits(value, units);
  return (
    <Table<SpendPeriodProgress>
      {...tableProps}
      columns={[
        {
          title: translate('Period'),
          render: ({ row }) => (
            <>
              {formatDate(row.from)} –{' '}
              {row.to ? formatDate(row.to) : renderFieldOrDash(null)}
            </>
          ),
        },
        {
          title: translate('Minimum'),
          render: ({ row }) => <>{renderFieldOrDash(row.minimum)}</>,
        },
        {
          title: translate('Maximum'),
          render: ({ row }) => <>{renderFieldOrDash(row.maximum)}</>,
        },
        {
          title: translate('Spent'),
          render: ({ row }) => <>{amount(row.spend)}</>,
        },
        {
          title: translate('Cap'),
          render: ({ row }) => <>{amount(row.cap)}</>,
        },
        {
          title: translate('Forfeit'),
          render: ({ row }) => (
            <>{renderFieldOrDash(forfeitText(row, units))}</>
          ),
        },
        {
          title: translate('Status'),
          render: ({ row }) => <PeriodStatusBadge status={row.status} />,
        },
      ]}
      rowClass={({ row }) => (row.status === 'current' ? 'table-active' : '')}
      verboseName={translate('periods')}
      hideTitle
      hasActionBar={false}
      placeholderHasRetry={false}
      minHeight="auto"
    />
  );
};

/**
 * The award's spend profile, period by period: what each allows, what has
 * been spent, and any forfeit charged. Hidden for an award without one.
 */
export const SpendProgressPanel: FC<{
  progress: SpendProgress | null | undefined;
  scope: string;
  className?: string;
}> = ({ progress, scope, className }) => {
  if (!progress) {
    return null;
  }
  const { headroom, minimum } = spendNowMessages(progress);
  const capReached = currentPeriod(progress)?.headroom <= 0;
  return (
    <Panel
      title={translate('Spend profile')}
      subtitle={translate(
        'The award total is unchanged. Each period may cap spending, and a period that ends below its minimum is charged a forfeit for the shortfall. Spending more in one period counts towards the next.',
      )}
      cardBordered
      className={className}
    >
      {(headroom || minimum) && (
        <AlertItem
          variant={capReached ? 'error' : minimum ? 'warning' : 'info'}
          className="mb-5"
          title={headroom ?? minimum}
          body={headroom && minimum ? minimum : undefined}
          data-testid="spend-progress-now"
        />
      )}
      <PeriodsTable
        key={JSON.stringify(progress.periods)}
        progress={progress}
        scope={scope}
      />
    </Panel>
  );
};

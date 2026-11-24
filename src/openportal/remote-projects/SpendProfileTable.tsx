import { FC } from 'react';
import type { SpendProfileEntry } from 'waldur-js-client';

import { Badge } from 'waldur-ui';

import { formatDate } from '@/core/dateUtils';
import { translate } from '@/i18n';
import {
  PeriodStatus,
  SpendPeriod,
  spendPeriods,
  withUnits,
} from '@/openportal/spendProfile';
import Table from '@/table/Table';
import { useTable } from '@/table/useTable';
import { renderFieldOrDash } from '@/table/utils';

const STATUS_LABELS: Record<PeriodStatus, () => string> = {
  ended: () => translate('Ended'),
  current: () => translate('Current'),
  upcoming: () => translate('Upcoming'),
};

const STATUS_VARIANTS = {
  ended: 'secondary',
  current: 'primary',
  upcoming: 'info',
} as const;

export const PeriodStatusBadge: FC<{ status: PeriodStatus }> = ({ status }) => (
  <Badge variant={STATUS_VARIANTS[status]} shape="pill" tone="light">
    {STATUS_LABELS[status]()}
  </Badge>
);

interface SpendProfileTableProps {
  entries: ReadonlyArray<SpendProfileEntry>;
  awardEnd: string | null;
  units: string | undefined;
  /** Which RemoteProject, to keep each table's state apart. */
  scope: string;
}

const PeriodsTable: FC<{ periods: SpendPeriod[] } & SpendProfileTableProps> = ({
  periods,
  units,
  scope,
}) => {
  const tableProps = useTable<SpendPeriod>({
    table: `spend-profile-${scope}`,
    fetchData: () =>
      Promise.resolve({ rows: periods, resultCount: periods.length }),
  });
  const amount = (value: number | null) =>
    value === null ? renderFieldOrDash(null) : withUnits(value, units);
  return (
    <Table<SpendPeriod>
      {...tableProps}
      columns={[
        {
          title: translate('From'),
          render: ({ row }) => <>{formatDate(row.from)}</>,
        },
        {
          // Exclusive, like a project's end date: spending stops the day before.
          title: translate('Ends'),
          render: ({ row }) => (
            <>{row.ends ? formatDate(row.ends) : renderFieldOrDash(null)}</>
          ),
        },
        {
          title: translate('Minimum'),
          render: ({ row }) => <>{amount(row.minimum)}</>,
        },
        {
          title: translate('Maximum'),
          render: ({ row }) => <>{amount(row.maximum)}</>,
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

/** A spend profile's periods: dates, controls and where each stands. */
export const SpendProfileTable: FC<SpendProfileTableProps> = (props) => {
  const periods = spendPeriods(props.entries, props.awardEnd);
  // Remounted when the profile changes, so an edit shows at once.
  return (
    <PeriodsTable key={JSON.stringify(periods)} periods={periods} {...props} />
  );
};

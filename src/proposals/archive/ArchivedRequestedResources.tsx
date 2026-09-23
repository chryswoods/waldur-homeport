import { FC, useMemo } from 'react';
import { type ArchivedRequestedResource } from 'waldur-js-client';

import { Panel } from '@/core/Panel';
import { translate } from '@/i18n';
import Table from '@/table/Table';
import { useTable } from '@/table/useTable';
import { renderFieldOrDash } from '@/table/utils';

import { RecordedName } from './utils';

const formatLimits = (limits: Record<string, unknown> | undefined) => {
  const entries = Object.entries(limits ?? {});
  if (entries.length === 0) return null;
  return entries.map(([key, value]) => `${key}: ${String(value)}`).join(', ');
};

/** What the proposal asked for, as recorded. */
export const ArchivedRequestedResources: FC<{
  resources: ArchivedRequestedResource[];
}> = ({ resources }) => {
  const rows = resources ?? [];
  const tableProps = useTable({
    table: `archived-resources-${rows.map((r) => r.uuid).join('-') || 'empty'}`,
    fetchData: () => Promise.resolve({ rows, resultCount: rows.length }),
  });

  const columns = useMemo(
    () => [
      {
        title: translate('Offering'),
        render: ({ row }: { row: ArchivedRequestedResource }) => (
          <RecordedName name={row.offering_name} />
        ),
      },
      {
        title: translate('Plan'),
        render: ({ row }: { row: ArchivedRequestedResource }) => (
          <RecordedName name={row.plan_name} />
        ),
      },
      {
        title: translate('Template'),
        render: ({ row }: { row: ArchivedRequestedResource }) => (
          <>{renderFieldOrDash(row.template_name)}</>
        ),
      },
      {
        title: translate('Limits'),
        render: ({ row }: { row: ArchivedRequestedResource }) => (
          <>{renderFieldOrDash(formatLimits(row.limits))}</>
        ),
      },
    ],
    [],
  );

  return (
    <Panel title={translate('Requested resources')} cardBordered>
      <Table
        {...tableProps}
        columns={columns}
        verboseName={translate('requested resources')}
        hideTitle
        hasActionBar={false}
        placeholderHasRetry={false}
      />
    </Panel>
  );
};

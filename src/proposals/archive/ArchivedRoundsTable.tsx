import { FC, useMemo } from 'react';
import { type ArchivedRound } from 'waldur-js-client';

import { formatDate } from '@/core/dateUtils';
import { Panel } from '@/core/Panel';
import { translate } from '@/i18n';
import Table from '@/table/Table';
import { useTable } from '@/table/useTable';
import { renderFieldOrDash } from '@/table/utils';

/**
 * The rounds of an archived call, which arrive with the call itself.
 *
 * A round has no name of its own — the old model identified it by slug — so
 * that is what the first column shows.
 */
export const ArchivedRoundsTable: FC<{ rounds: ArchivedRound[] }> = ({
  rounds,
}) => {
  const rows = rounds ?? [];
  const tableProps = useTable({
    table: `archived-rounds-${rows.map((r) => r.uuid).join('-') || 'empty'}`,
    fetchData: () => Promise.resolve({ rows, resultCount: rows.length }),
  });

  const columns = useMemo(
    () => [
      {
        title: translate('Round'),
        render: ({ row }: { row: ArchivedRound }) => (
          <>{renderFieldOrDash(row.slug)}</>
        ),
      },
      {
        title: translate('Opens'),
        render: ({ row }: { row: ArchivedRound }) => (
          <>
            {row.start_time
              ? formatDate(row.start_time)
              : renderFieldOrDash(null)}
          </>
        ),
      },
      {
        title: translate('Cut-off'),
        render: ({ row }: { row: ArchivedRound }) => (
          <>
            {row.cutoff_time
              ? formatDate(row.cutoff_time)
              : renderFieldOrDash(null)}
          </>
        ),
      },
      {
        title: translate('Allocation date'),
        render: ({ row }: { row: ArchivedRound }) => (
          <>
            {row.allocation_date
              ? formatDate(row.allocation_date)
              : renderFieldOrDash(null)}
          </>
        ),
      },
      {
        title: translate('Review strategy'),
        render: ({ row }: { row: ArchivedRound }) => (
          <>{renderFieldOrDash(row.review_strategy)}</>
        ),
      },
    ],
    [],
  );

  return (
    <Panel title={translate('Rounds')} cardBordered>
      <Table
        {...tableProps}
        columns={columns}
        verboseName={translate('rounds')}
        hideTitle
        hasActionBar={false}
        placeholderHasRetry={false}
      />
    </Panel>
  );
};

import { FC, useMemo } from 'react';
import { proposalArchiveCallsList } from 'waldur-js-client';

import { formatDate } from '@/core/dateUtils';
import { Link } from '@/core/Link';
import { translate } from '@/i18n';
import { createFetcher } from '@/table/api';
import {
  ProposalArchiveCallsFilter,
  ProposalArchiveCallsFilterFormId,
  selectProposalArchiveCallsFilter,
} from '@/table/generated/ProposalArchiveCallsFilter';
import Table from '@/table/Table';
import { useFilterValues } from '@/table/useFilterValues';
import { useTable } from '@/table/useTable';

import { ArchivedCallStateBadge, ArchiveNotice, RecordedName } from './utils';

export const ArchivedCallsList: FC = () => {
  const values = useFilterValues('ArchivedCallsList');
  const filter = useMemo(
    () => selectProposalArchiveCallsFilter(values),
    [values],
  );

  const tableProps = useTable({
    table: 'ArchivedCallsList',
    syncFiltersToURL: true,
    fetchData: createFetcher(proposalArchiveCallsList),
    queryField: 'name',
    filter,
  });

  return (
    <>
      <ArchiveNotice />
      <Table
        {...tableProps}
        formId={ProposalArchiveCallsFilterFormId}
        filters={<ProposalArchiveCallsFilter />}
        columns={[
          {
            title: translate('Call'),
            render: ({ row }) => (
              <Link
                state="proposal-archive-call"
                params={{ uuid: row.uuid }}
                label={row.name}
              />
            ),
            keys: ['name'],
            id: 'name',
          },
          {
            title: translate('Managing organisation'),
            render: ({ row }) => <RecordedName name={row.customer_name} />,
            id: 'customer',
          },
          {
            title: translate('State'),
            render: ({ row }) => <ArchivedCallStateBadge state={row.state} />,
            id: 'state',
          },
          {
            title: translate('Created by'),
            render: ({ row }) => (
              <RecordedName
                name={row.created_by_full_name}
                username={row.created_by_username}
              />
            ),
            id: 'created_by',
          },
          {
            title: translate('Created'),
            render: ({ row }) => <>{formatDate(row.created)}</>,
            id: 'created',
          },
        ]}
        verboseName={translate('archived calls')}
        hasQuery
      />
    </>
  );
};

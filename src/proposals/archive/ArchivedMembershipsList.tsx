import { FC, useMemo } from 'react';
import { proposalArchiveMembershipsList } from 'waldur-js-client';

import { formatDate } from '@/core/dateUtils';
import { translate } from '@/i18n';
import { createFetcher } from '@/table/api';
import {
  ProposalArchiveMembershipsFilter,
  ProposalArchiveMembershipsFilterFormId,
  selectProposalArchiveMembershipsFilter,
} from '@/table/generated/ProposalArchiveMembershipsFilter';
import Table from '@/table/Table';
import { useFilterValues } from '@/table/useFilterValues';
import { useTable } from '@/table/useTable';
import { renderFieldOrDash } from '@/table/utils';

import { MembershipStatusBadge } from './ArchivedMembershipsTable';
import { ArchiveNotice, RecordedName } from './utils';

/**
 * Access as it stood, across the whole archive.
 *
 * A top-level view rather than only a panel on a proposal, because the question
 * actually asked of this data — "what did this person have access to?" — is a
 * query across proposals rather than within one.
 */
export const ArchivedMembershipsList: FC = () => {
  const values = useFilterValues('ArchivedMembershipsList');
  const filter = useMemo(
    () => selectProposalArchiveMembershipsFilter(values),
    [values],
  );

  const tableProps = useTable({
    table: 'ArchivedMembershipsList',
    syncFiltersToURL: true,
    fetchData: createFetcher(proposalArchiveMembershipsList),
    queryField: 'user_username',
    filter,
  });

  return (
    <>
      <ArchiveNotice>
        {translate(
          'A record of who held which role before the upgrade. The underlying roles were removed at that point, so nothing listed here grants access now.',
        )}
      </ArchiveNotice>
      <Table
        {...tableProps}
        formId={ProposalArchiveMembershipsFilterFormId}
        filters={<ProposalArchiveMembershipsFilter />}
        columns={[
          {
            title: translate('Person'),
            render: ({ row }) => (
              <RecordedName
                name={row.user_full_name}
                username={row.user_username}
              />
            ),
            id: 'user',
          },
          {
            title: translate('Role'),
            render: ({ row }) => (
              <>{renderFieldOrDash(row.role_description || row.role_name)}</>
            ),
            id: 'role',
          },
          {
            title: translate('Scope'),
            render: ({ row }) => <>{renderFieldOrDash(row.scope_kind)}</>,
            id: 'scope_kind',
          },
          {
            title: translate('Organisation'),
            render: ({ row }) => (
              <RecordedName name={row.organisation_customer_name} />
            ),
            id: 'organisation',
          },
          {
            title: translate('Status'),
            render: ({ row }) => <MembershipStatusBadge membership={row} />,
            id: 'is_active',
          },
          {
            title: translate('Granted'),
            render: ({ row }) => <>{formatDate(row.created)}</>,
            id: 'created',
          },
        ]}
        verboseName={translate('archived memberships')}
        hasQuery
      />
    </>
  );
};

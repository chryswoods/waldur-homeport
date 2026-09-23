import { useCurrentStateAndParams } from '@uirouter/react';
import { FC, useMemo } from 'react';
import { proposalArchiveProposalsList } from 'waldur-js-client';

import { formatDate } from '@/core/dateUtils';
import { Link } from '@/core/Link';
import { translate } from '@/i18n';
import { createFetcher } from '@/table/api';
import {
  ProposalArchiveProposalsFilter,
  ProposalArchiveProposalsFilterFormId,
  selectProposalArchiveProposalsFilter,
} from '@/table/generated/ProposalArchiveProposalsFilter';
import Table from '@/table/Table';
import { useFilterValues } from '@/table/useFilterValues';
import { useTable } from '@/table/useTable';
import { renderFieldOrDash } from '@/table/utils';

import {
  ArchivedProposalStateBadge,
  ArchiveNotice,
  RecordedName,
} from './utils';

export const ArchivedProposalsList: FC = () => {
  const values = useFilterValues('ArchivedProposalsList');
  // The call detail links here with ?call=<uuid>, and an old link to a round
  // resolves to ?round=<uuid> — a round has no page of its own, so its
  // proposals are the useful answer. Both narrow the list rather than dropping
  // the reader into all 2,263 proposals.
  const {
    params: { call, round },
  } = useCurrentStateAndParams();

  const filter = useMemo(() => {
    const result = selectProposalArchiveProposalsFilter(values);
    if (call && !result.call_uuid) {
      result.call_uuid = call;
    }
    if (round && !result.round_uuid) {
      result.round_uuid = round;
    }
    return result;
  }, [values, call, round]);

  const tableProps = useTable({
    table: 'ArchivedProposalsList',
    syncFiltersToURL: true,
    fetchData: createFetcher(proposalArchiveProposalsList),
    queryField: 'name',
    filter,
  });

  return (
    <>
      <ArchiveNotice />
      <Table
        {...tableProps}
        formId={ProposalArchiveProposalsFilterFormId}
        filters={<ProposalArchiveProposalsFilter />}
        columns={[
          {
            title: translate('Proposal'),
            render: ({ row }) => (
              <Link
                state="proposal-archive-proposal"
                params={{ uuid: row.uuid }}
                label={row.name}
              />
            ),
            keys: ['name'],
            id: 'name',
          },
          {
            title: translate('Call'),
            // The recorded call name, not a link: an applicant can read their
            // own archived proposal but not the call it belongs to, so a link
            // here would 403 for exactly the people most likely to click it.
            render: ({ row }) => <>{renderFieldOrDash(row.call_name)}</>,
            id: 'call',
          },
          {
            title: translate('Applicant'),
            render: ({ row }) => (
              <RecordedName
                name={row.created_by_full_name}
                username={row.created_by_username}
              />
            ),
            id: 'created_by',
          },
          {
            title: translate('Project'),
            render: ({ row }) => <RecordedName name={row.project_name} />,
            id: 'project',
          },
          {
            title: translate('State'),
            render: ({ row }) => (
              <ArchivedProposalStateBadge state={row.state} />
            ),
            id: 'state',
          },
          {
            title: translate('Submitted'),
            render: ({ row }) => (
              <>
                {row.submitted_at
                  ? formatDate(row.submitted_at)
                  : renderFieldOrDash(null)}
              </>
            ),
            id: 'submitted_at',
          },
        ]}
        verboseName={translate('archived proposals')}
        hasQuery
      />
    </>
  );
};

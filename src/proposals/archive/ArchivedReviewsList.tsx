import { FC, useMemo } from 'react';
import { proposalArchiveReviewsList } from 'waldur-js-client';

import { formatDate } from '@/core/dateUtils';
import { Link } from '@/core/Link';
import { translate } from '@/i18n';
import { createFetcher } from '@/table/api';
import {
  ProposalArchiveReviewsFilter,
  ProposalArchiveReviewsFilterFormId,
  selectProposalArchiveReviewsFilter,
} from '@/table/generated/ProposalArchiveReviewsFilter';
import Table from '@/table/Table';
import { useFilterValues } from '@/table/useFilterValues';
import { useTable } from '@/table/useTable';
import { renderFieldOrDash } from '@/table/utils';

import { ArchivedReviewStateBadge, ArchiveNotice, RecordedName } from './utils';

/**
 * Archived reviews, for administrators and call managers.
 *
 * The API filters the queryset to that audience, so an applicant reaching this
 * page sees an empty table rather than anything they should not. The menu entry
 * is likewise only offered to the audience that can use it.
 */
export const ArchivedReviewsList: FC = () => {
  const values = useFilterValues('ArchivedReviewsList');
  const filter = useMemo(
    () => selectProposalArchiveReviewsFilter(values),
    [values],
  );

  const tableProps = useTable({
    table: 'ArchivedReviewsList',
    syncFiltersToURL: true,
    fetchData: createFetcher(proposalArchiveReviewsList),
    filter,
  });

  return (
    <>
      <ArchiveNotice />
      <Table
        {...tableProps}
        formId={ProposalArchiveReviewsFilterFormId}
        filters={<ProposalArchiveReviewsFilter />}
        columns={[
          {
            title: translate('Proposal'),
            render: ({ row }) => (
              <Link
                state="proposal-archive-proposal"
                params={{ uuid: row.proposal_uuid }}
                label={row.proposal_name}
              />
            ),
            id: 'proposal',
          },
          {
            title: translate('Reviewer'),
            render: ({ row }) => (
              <RecordedName
                name={row.reviewer_full_name}
                username={row.reviewer_username}
              />
            ),
            id: 'reviewer',
          },
          {
            title: translate('State'),
            render: ({ row }) => <ArchivedReviewStateBadge state={row.state} />,
            id: 'state',
          },
          {
            title: translate('Score'),
            render: ({ row }) => (
              <>
                {row.summary_score != null
                  ? String(row.summary_score)
                  : renderFieldOrDash(null)}
              </>
            ),
            id: 'score',
          },
          {
            title: translate('Created'),
            render: ({ row }) => <>{formatDate(row.created)}</>,
            id: 'created',
          },
        ]}
        verboseName={translate('archived reviews')}
      />
    </>
  );
};

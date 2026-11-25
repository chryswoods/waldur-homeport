import { FC, useMemo } from 'react';

import { AlertItem, BaseButton } from 'waldur-ui';

import { LoadingSpinner } from '@/core/LoadingSpinner';
import { translate } from '@/i18n';
import {
  AWARDED_RESOURCES_SECTION_ID,
  AwardComparisonRow,
  compareAward,
  useAwardedResources,
} from '@/proposals/awardedResources';
import { Proposal } from '@/proposals/types';
import { useProposalResourceRows } from '@/proposals/useProposalResourceRows';
import Table from '@/table/Table';
import { useTable } from '@/table/useTable';

import { AwardAmountsCell, AwardOfferingCell } from './AwardComparison';

/** Brings the proposal page's Awarded resources section into view. */
export const scrollToAwardedResources = () =>
  document
    .getElementById(AWARDED_RESOURCES_SECTION_ID)
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });

/** "Review awarded resources": to the section where the award is edited. */
export const ReviewAwardButton: FC<{
  onClick?(): void;
  className?: string;
}> = ({ onClick, className }) => (
  <BaseButton
    variant="tertiary"
    size="sm"
    label={translate('Review awarded resources')}
    onClick={() => {
      onClick?.();
      scrollToAwardedResources();
    }}
    className={className}
  />
);

const AwardRowsTable: FC<{ rows: AwardComparisonRow[]; scope: string }> = ({
  rows,
  scope,
}) => {
  const tableProps = useTable({
    table: `award-summary-${scope}`,
    fetchData: () => Promise.resolve({ rows, resultCount: rows.length }),
  });
  return (
    <Table<AwardComparisonRow>
      {...tableProps}
      columns={[
        { title: translate('Offering'), render: AwardOfferingCell },
        { title: translate('Amounts'), render: AwardAmountsCell },
      ]}
      verboseName={translate('awarded resources')}
      hideTitle
      hasActionBar={false}
      placeholderHasRetry={false}
      minHeight="auto"
    />
  );
};

/**
 * What completing the allocation decision will award, item by item and set
 * against the request, so it is seen before the step is completed rather
 * than found at the bottom of the page afterwards.
 */
export const AwardSummary: FC<{
  proposal: Pick<Proposal, 'uuid'>;
  /** Called before going to the section, e.g. to close a dialog. */
  onReview?(): void;
}> = ({ proposal, onReview }) => {
  const awards = useAwardedResources(proposal.uuid, true);
  const requests = useProposalResourceRows(proposal.uuid);
  const rows = useMemo(
    () =>
      awards.data ? compareAward(requests.data ?? [], awards.data) : undefined,
    [awards.data, requests.data],
  );

  if (awards.isLoading || requests.isLoading) {
    return <LoadingSpinner />;
  }
  if (!rows) {
    return null;
  }
  const granted = rows.filter((row) => row.awarded);
  return (
    <div className="mb-5" data-testid="award-summary">
      {granted.length ? (
        <AlertItem
          variant="info"
          className="mb-3"
          title={translate('Completing this step awards:')}
        />
      ) : (
        <AlertItem
          variant="warning"
          className="mb-3"
          title={translate(
            'Nothing will be awarded: the awarded resources are empty.',
          )}
        />
      )}
      {rows.length > 0 && (
        <AwardRowsTable
          // Remounted when the award changes.
          key={rows.map((row) => `${row.uuid}:${row.change}`).join('|')}
          rows={rows}
          scope={proposal.uuid}
        />
      )}
      <ReviewAwardButton onClick={onReview} className="mt-3" />
    </div>
  );
};

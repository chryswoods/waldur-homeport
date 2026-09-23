import { useQuery } from '@tanstack/react-query';
import { FC } from 'react';
import {
  type ArchivedReview,
  proposalArchiveReviewsList,
} from 'waldur-js-client';

import { formatDate } from '@/core/dateUtils';
import { Panel } from '@/core/Panel';
import { translate } from '@/i18n';

import { ArchivedReviewStateBadge, RecordedName } from './utils';

/**
 * The per-section comments a review carried.
 *
 * Nine fixed fields, one per proposal section, rather than a thread:
 * `ReviewComment` was never used in production, so `comments` is always empty
 * and there is no conversation to render.
 */
const SECTIONS: Array<[keyof ArchivedReview, () => string]> = [
  ['comment_project_title', () => translate('Title')],
  ['comment_project_summary', () => translate('Summary')],
  ['comment_project_description', () => translate('Description')],
  ['comment_project_duration', () => translate('Duration')],
  ['comment_project_is_confidential', () => translate('Confidentiality')],
  ['comment_project_has_civilian_purpose', () => translate('Civilian purpose')],
  [
    'comment_project_supporting_documentation',
    () => translate('Supporting documentation'),
  ],
  ['comment_resource_requests', () => translate('Resource requests')],
  ['comment_team', () => translate('Team')],
];

const ReviewCard: FC<{ review: ArchivedReview }> = ({ review }) => {
  const sections = SECTIONS.filter(([key]) => Boolean(review[key]));
  return (
    <div className="border rounded p-4 d-flex flex-column gap-3">
      <div className="d-flex flex-wrap align-items-center gap-3">
        <ArchivedReviewStateBadge state={review.state} />
        <RecordedName
          name={review.reviewer_full_name}
          username={review.reviewer_username}
        />
        {review.summary_score != null && (
          <span className="text-muted">
            {translate('Score: {score}', {
              score: String(review.summary_score),
            })}
          </span>
        )}
        <span className="text-muted ms-auto">{formatDate(review.created)}</span>
      </div>
      {review.summary_public_comment && (
        <div>
          <div className="fw-bold fs-7">{translate('Summary')}</div>
          <div className="text-prewrap">{review.summary_public_comment}</div>
        </div>
      )}
      {review.summary_private_comment && (
        <div>
          <div className="fw-bold fs-7">{translate('Private summary')}</div>
          <div className="text-prewrap">{review.summary_private_comment}</div>
        </div>
      )}
      {sections.map(([key, label]) => (
        <div key={String(key)}>
          <div className="fw-bold fs-7">{label()}</div>
          <div className="text-prewrap">{String(review[key])}</div>
        </div>
      ))}
    </div>
  );
};

/**
 * The reviews of an archived proposal, for the audience allowed to see them.
 *
 * Administrators and call managers only — never the applicant, whatever the old
 * call's `reviews_visible_to_submitters` and
 * `reviewer_identity_visible_to_submitters` flags said. Those flags are still
 * on the archived call record, but they are history rather than instructions,
 * so nothing here reads them.
 *
 * The API enforces this by filtering the queryset, so an applicant simply gets
 * an empty list. Rendering nothing at all in that case is the point: an empty
 * "Reviews" panel would tell them reviews exist.
 */
export const ArchivedReviewsPanel: FC<{ proposalUuid: string }> = ({
  proposalUuid,
}) => {
  const { data } = useQuery({
    queryKey: ['archived-proposal-reviews', proposalUuid],
    queryFn: () =>
      proposalArchiveReviewsList({
        query: { proposal_uuid: proposalUuid, page_size: 100 },
      })
        .then((response) => response.data ?? [])
        .catch(() => []),
    enabled: Boolean(proposalUuid),
    refetchOnWindowFocus: false,
    retry: false,
  });

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <Panel title={translate('Reviews')} cardBordered>
      <div className="d-flex flex-column gap-4">
        {data.map((review) => (
          <ReviewCard key={review.uuid} review={review} />
        ))}
      </div>
    </Panel>
  );
};

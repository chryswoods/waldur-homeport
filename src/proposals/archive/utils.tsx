import { FC, ReactNode } from 'react';

import { Badge, BadgeVariant } from 'waldur-ui';

import { AlertItem } from '@/core/AlertItem';
import { translate } from '@/i18n';
import { DASH_ESCAPE_CODE } from '@/table/constants';

/**
 * A reference out of the archive: a recorded name, never a link.
 *
 * Every reference the archive holds is denormalised to a UUID plus the display
 * value as it stood when the archive was taken, deliberately — a real foreign
 * key would let an archived proposal block the deletion of the user who wrote
 * it, or be cascade-deleted with a customer years from now. The consequence
 * here is that **the referenced object may no longer exist**, so a link to it
 * may 404. A dangling link is worse than a plain name, so this renders the
 * name.
 */
export const RecordedName: FC<{
  name?: string | null;
  username?: string | null;
}> = ({ name, username }) => {
  const label = name || username;
  if (!label) {
    return <>{DASH_ESCAPE_CODE}</>;
  }
  return (
    <span>
      {label}
      {name && username && name !== username && (
        <span className="text-muted ms-1">({username})</span>
      )}
    </span>
  );
};

const PROPOSAL_STATE_VARIANTS: Record<string, BadgeVariant> = {
  draft: 'secondary',
  submitted: 'info',
  in_review: 'warning',
  accepted: 'success',
  rejected: 'danger',
  canceled: 'secondary',
};

const CALL_STATE_VARIANTS: Record<string, BadgeVariant> = {
  draft: 'secondary',
  active: 'success',
  archived: 'secondary',
};

const REVIEW_STATE_VARIANTS: Record<string, BadgeVariant> = {
  in_review: 'warning',
  submitted: 'info',
  rejected: 'danger',
};

const STATE_LABELS: Record<string, () => string> = {
  draft: () => translate('Draft'),
  submitted: () => translate('Submitted'),
  in_review: () => translate('In review'),
  accepted: () => translate('Accepted'),
  rejected: () => translate('Rejected'),
  canceled: () => translate('Canceled'),
  active: () => translate('Active'),
  archived: () => translate('Archived'),
};

const stateBadge =
  (variants: Record<string, BadgeVariant>) =>
  ({ state }: { state?: string | null }) => {
    if (!state) return <>{DASH_ESCAPE_CODE}</>;
    return (
      <Badge
        variant={variants[state] ?? 'secondary'}
        size="sm"
        shape="pill"
        tone="light"
      >
        {STATE_LABELS[state]?.() ?? state}
      </Badge>
    );
  };

export const ArchivedProposalStateBadge = stateBadge(PROPOSAL_STATE_VARIANTS);
export const ArchivedCallStateBadge = stateBadge(CALL_STATE_VARIANTS);
export const ArchivedReviewStateBadge = stateBadge(REVIEW_STATE_VARIANTS);

/**
 * The marker that makes the section visibly a record rather than a workspace.
 *
 * The archive keeps the original UUIDs, so an archived proposal looks very like
 * a live one — which is exactly why it has to announce itself. Nothing here can
 * be edited, submitted, reviewed or withdrawn.
 */
export const ArchiveNotice: FC<{ children?: ReactNode }> = ({ children }) => (
  <AlertItem
    className="mb-6"
    title={translate('Archived records')}
    body={
      children ??
      translate(
        'A read-only record of calls and proposals from before the upgrade. Nothing here can be changed, and none of it grants any access.',
      )
    }
  />
);

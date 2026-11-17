import { ReactNode } from 'react';

import { formatDateTime } from '@/core/dateUtils';
import { translate } from '@/i18n';
import { usesCallVocabulary } from '@/proposals/presentation';
import { Proposal } from '@/proposals/types';

import { EntityHeader } from '../EntityHeader';
import { ProposalBadge } from '../ProposalBadge';

interface ProposalHeaderProps {
  proposal: Proposal;
  className?: string;
  actions?: ReactNode;
}

/** When the proposal was created, and submitted once it has been. */
export const proposalDates = (
  proposal: Pick<Proposal, 'created' | 'submitted_at'>,
): string =>
  [
    proposal.created &&
      translate('Created {date}', { date: formatDateTime(proposal.created) }),
    proposal.submitted_at &&
      translate('Submitted {date}', {
        date: formatDateTime(proposal.submitted_at),
      }),
  ]
    .filter(Boolean)
    .join(' · ');

export const ProposalHeader = ({
  proposal,
  className,
  actions,
}: ProposalHeaderProps) => (
  <EntityHeader
    title={proposal.name}
    slug={proposal.slug}
    badge={<ProposalBadge state={proposal.state} />}
    idLabel={usesCallVocabulary() ? undefined : translate('Request ID')}
    helpText={proposalDates(proposal)}
    className={className}
    actions={actions}
  />
);

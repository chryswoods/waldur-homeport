import { useQuery } from '@tanstack/react-query';
import { proposalArchiveProposalsNotesRetrieve } from 'waldur-js-client';

export interface ArchivedNote {
  timestamp?: string;
  author?: string;
  text?: string;
}

/**
 * The stored value is a JSON list of {timestamp, author, text}, but the schema
 * can only describe a JSONField as an open object, so the generated type says
 * so too. Narrow it here rather than casting at the call site, and treat
 * anything that is not a list as no notes at all — a malformed record should
 * render as empty, not throw on the page.
 */
const toNotes = (value: unknown): ArchivedNote[] | null =>
  Array.isArray(value) ? (value as ArchivedNote[]) : null;

/**
 * The call-manager notes on an archived proposal.
 *
 * A separate request, not a field on the proposal, and deliberately so: an
 * applicant can read their own archived proposal but must never see what was
 * written about it. The endpoint answers 404 for them, which this reports as
 * "no notes to show" rather than as an error — being refused is the normal
 * case for most viewers, not a failure.
 */
export const useArchivedProposalNotes = (uuid: string) => {
  const { data, isLoading } = useQuery({
    queryKey: ['archived-proposal-notes', uuid],
    queryFn: () =>
      proposalArchiveProposalsNotesRetrieve({ path: { uuid } })
        .then((response) => toNotes(response.data?.notes))
        .catch(() => null),
    enabled: Boolean(uuid),
    refetchOnWindowFocus: false,
    retry: false,
  });
  return { notes: data ?? null, isLoading };
};

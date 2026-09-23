import { useQuery } from '@tanstack/react-query';
import { useRouter } from '@uirouter/react';
import { FC, useEffect } from 'react';
import { proposalArchiveResolveRetrieve } from 'waldur-js-client';

import { LoadingSpinner } from '@/core/LoadingSpinner';
import { translate } from '@/i18n';
import { NoResult } from '@/navigation/header/search/NoResult';

import { archiveTargetFor } from './resolveArchived';

/**
 * Sends an old proposal link on to the archive.
 *
 * `/proposals/{uuid}` links are in people's inboxes, tickets and bookmarks, and
 * the archive preserved the original UUIDs — so such a link still identifies
 * the right record, it just is not a live proposal any more. Rather than
 * rewriting stored links, which could only ever fix the ones already inside
 * Waldur, the live route falls back here when its lookup 404s.
 *
 * A 404 from the resolver is the end of the road: it answers 404 both for
 * "unknown" and for "you may not see it", deliberately, so that it cannot be
 * used to test whether a confidential proposal exists.
 */
export const ArchivedProposalRedirect: FC<{ uuid: string }> = ({ uuid }) => {
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ['archive-resolve', uuid],
    queryFn: () =>
      proposalArchiveResolveRetrieve({ path: { uuid } })
        .then((response) => response.data ?? null)
        .catch(() => null),
    enabled: Boolean(uuid),
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: Infinity,
  });

  const target = archiveTargetFor(data);

  useEffect(() => {
    if (target) {
      // Replaces rather than pushes: the dead live URL has no value in the
      // back stack, and leaving it there would bounce the reader forward again.
      router.stateService.go(target.state, target.params, {
        location: 'replace',
      });
    }
  }, [target, router]);

  if (isLoading || target) {
    return <LoadingSpinner />;
  }

  return (
    <NoResult
      title={translate('Proposal not found')}
      message={translate(
        'This proposal no longer exists, and there is no archived record of it you can see.',
      )}
      noAction
    />
  );
};

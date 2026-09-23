import { useQuery } from '@tanstack/react-query';
import { proposalArchiveCallsCount } from 'waldur-js-client';

/**
 * Whether this deployment has an archive worth offering.
 *
 * No feature flag: only the site that ran the old proposal app has any archived
 * records, and everywhere else the endpoint answers zero. Presence of data is
 * a better switch than a setting nobody would remember to turn on — and it
 * cannot drift out of step with the data the way a flag can.
 *
 * `staleTime: Infinity` because the archive is immutable by construction: it is
 * a record of what happened, and nothing writes to it.
 */
export const useHasProposalArchive = (): boolean => {
  const { data } = useQuery({
    queryKey: ['proposal-archive-present'],
    queryFn: () =>
      proposalArchiveCallsCount()
        .then((response) => Number(response.data ?? 0))
        .catch(() => 0),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  });
  return (data ?? 0) > 0;
};

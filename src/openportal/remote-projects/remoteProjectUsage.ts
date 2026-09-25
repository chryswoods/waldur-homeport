import { openportalRemoteProjectsTotalUsageRetrieve } from 'waldur-js-client';

import { STALE_TIME } from '@/core/constants';

/**
 * Usage OpenPortal has reported for one remote project, in the allocation's
 * own unit. Shared by the connection card and the pace card so the two read
 * one cached request and cannot disagree about the figure.
 */
export const remoteProjectUsageQuery = (uuid: string) => ({
  queryKey: ['remote-project-total-usage', uuid],
  queryFn: () =>
    openportalRemoteProjectsTotalUsageRetrieve({ path: { uuid } }).then(
      (r) => r.data?.total_hours as number | undefined,
    ),
  staleTime: STALE_TIME,
});

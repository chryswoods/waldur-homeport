import { useQuery } from '@tanstack/react-query';
import {
  type AwardDetails,
  openportalManagedProjectsList,
} from 'waldur-js-client';

import { STALE_TIME } from '@/core/constants';

/**
 * The OpenPortal award backing a project, if it has one. Returns null for a
 * project that is not externally managed.
 */
export const useProjectAwardDetails = (projectUuid: string | undefined) =>
  useQuery<AwardDetails | null>({
    queryKey: ['project-managed', projectUuid],
    queryFn: async () => {
      const { data } = await openportalManagedProjectsList({
        query: {
          project_uuid: projectUuid,
          state: ['approved', 'pending', 'rejected'],
          page_size: 1,
        },
      });
      if (!Array.isArray(data) || data.length === 0) return null;
      return data[0].details;
    },
    staleTime: STALE_TIME,
    enabled: Boolean(projectUuid),
  });

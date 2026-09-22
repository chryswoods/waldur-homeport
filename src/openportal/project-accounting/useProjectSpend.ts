import { useQuery } from '@tanstack/react-query';
import { openportalAccountingSummaryList } from 'waldur-js-client';

import { STALE_TIME } from '@/core/constants';

import { buildProjectSpend, type ProjectSpend } from './projectSpend';

export const PROJECT_SPEND_KEY = 'openportal-project-accounting-summary';

/**
 * A project's OpenPortal spend, for projects that carry no award.
 *
 * Distinct from `useProjectAccountingSummary`, which reads the *award*
 * accounting and reports nothing for a project without one. This reads
 * `/api/openportal-accounting-summary/`, which covers every project.
 */
export const useProjectSpend = (
  projectUuid: string | undefined,
  enabled = true,
): { data: ProjectSpend | null; isLoading: boolean } => {
  const { data, isLoading } = useQuery({
    queryKey: [PROJECT_SPEND_KEY, projectUuid],
    queryFn: () =>
      openportalAccountingSummaryList({
        query: { project_uuid: projectUuid },
      }).then((response) => buildProjectSpend(response.data?.[0])),
    enabled: enabled && Boolean(projectUuid),
    staleTime: STALE_TIME,
  });
  return { data: data ?? null, isLoading };
};

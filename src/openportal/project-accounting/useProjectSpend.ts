import { useQuery } from '@tanstack/react-query';
import {
  openportalAccountingSummaryList,
  projectCreditsList,
} from 'waldur-js-client';

import { STALE_TIME } from '@/core/constants';

import { buildProjectSpend, type ProjectSpend } from './projectSpend';

export const PROJECT_SPEND_KEY = 'openportal-project-accounting-summary';

/**
 * A project's OpenPortal spend, for projects that carry no award.
 *
 * Distinct from `useProjectAccountingSummary`, which reads the *award*
 * accounting and reports nothing for a project without one. This reads
 * `/api/openportal-accounting-summary/`, which covers every project.
 *
 * Two requests, because the summary cannot supply the balance: its
 * `total_credits` adds every credit that ever arrived as a negative invoice
 * item back on top of `ProjectCredit.value`, so on a project with any
 * compensation history it is not the start-of-month balance at all. That comes
 * from `/api/project-credits/`, sharing the query key the stock Accounting
 * widget already uses so the two agree and no extra call is made where both
 * are on screen.
 */
export const useProjectSpend = (
  projectUuid: string | undefined,
  enabled = true,
): { data: ProjectSpend | null; isLoading: boolean } => {
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: [PROJECT_SPEND_KEY, projectUuid],
    queryFn: () =>
      openportalAccountingSummaryList({
        query: { project_uuid: projectUuid },
      }).then((response) => response.data?.[0] ?? null),
    enabled: enabled && Boolean(projectUuid),
    staleTime: STALE_TIME,
  });

  // The same key as useProjectCreditChart, so this shares its result rather
  // than issuing a second identical request.
  const { data: credit, isLoading: creditLoading } = useQuery({
    queryKey: ['ProjectCreditData', projectUuid],
    queryFn: () =>
      projectCreditsList({ query: { project_uuid: projectUuid } }).then(
        (response) =>
          response.data.length > 0 ? response.data[0] : (false as const),
      ),
    enabled: enabled && Boolean(projectUuid),
    staleTime: STALE_TIME,
  });

  return {
    data: buildProjectSpend(summary, credit ? credit.value : null),
    isLoading: summaryLoading || creditLoading,
  };
};

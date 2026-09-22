import { useQuery } from '@tanstack/react-query';
import {
  type ManagedProject,
  type ManagedProjectAccountingSummary,
  openportalProjectAwardHistoryList,
} from 'waldur-js-client';

import { STALE_TIME } from '@/core/constants';

import { AwardPace, buildAwardPace, resolveAwardWindow } from './awardPace';

/**
 * Pace for the award currently attached to a project.
 *
 * The award history is only fetched when the award carries no start date of its
 * own. That is the uncommon case — the funder's dates are normally present — and
 * a request on every dashboard load to cover a fallback would not be worth it.
 *
 * Returns null whenever there is no window to pace against, which the caller
 * treats as "show nothing" rather than substituting a guessed one.
 */
export const useAwardPace = (
  award: ManagedProject | null | undefined,
  accounting: ManagedProjectAccountingSummary | null | undefined,
  projectUuid: string | undefined,
  projectEndDate: string | null | undefined,
): AwardPace | null => {
  const awardStart = award?.details?.start_date ?? null;
  const awardEnd = award?.details?.end_date ?? null;
  const awardIdentifier = award?.identifier;
  const needsAttachmentFallback = Boolean(award) && !awardStart;

  const { data: firstAttachedAt } = useQuery({
    queryKey: ['openportal-project-award-history', projectUuid],
    queryFn: () =>
      openportalProjectAwardHistoryList({
        query: { project_uuid: projectUuid, page_size: 100 },
      }).then((response) => {
        // This project's history covers every award it has held, so the rows
        // are narrowed to the one attached now before taking the earliest.
        const attachedDates = (response.data ?? [])
          .flatMap((row) => row.awards ?? [])
          .filter(
            (entry) => entry.managed_project_identifier === awardIdentifier,
          )
          .map((entry) => entry.attached_at)
          .filter((value): value is string => Boolean(value))
          .sort();
        return attachedDates[0] ?? null;
      }),
    enabled: needsAttachmentFallback && Boolean(projectUuid),
    staleTime: STALE_TIME,
  });

  if (!award || !accounting?.has_award) {
    return null;
  }

  const { startDate, endDate } = resolveAwardWindow(
    awardStart,
    awardEnd,
    firstAttachedAt,
    projectEndDate,
  );

  return buildAwardPace({
    startDate,
    endDate,
    allocationCredits: accounting.allocation_credits,
    usageCredits: accounting.usage_credits,
  });
};

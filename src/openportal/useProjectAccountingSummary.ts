import { useQuery } from '@tanstack/react-query';
import { openportalManagedProjectAccountingSummaryList } from 'waldur-js-client';

import { STALE_TIME } from '@/core/constants';

/**
 * The OpenPortal award accounting for a project: the allocation granted by the
 * award and the usage counted against it, both on the credits scale.
 *
 * This is the "absolute" accounting — a running total of what the award granted
 * and what has been used against it, computed from the cached usage reports over
 * the windows the award was attached. It is not the same system as Waldur's own
 * credit ledger, which is "relative": a balance that is drawn down month by
 * month. Where an award exists the two coexist, and OpenPortal overwrites
 * `ProjectCredit.value` with `allocation − spend excluding the current month`
 * (waldur_openportal/utils.py, set_project_credits), so the Waldur balance is a
 * derived, month-lagging view of these figures rather than an independent
 * account.
 *
 * Keyed by project rather than by award: the endpoint reports the award
 * currently attached to a project, so every consumer on a page shares one
 * request.
 */
export const PROJECT_ACCOUNTING_SUMMARY_KEY =
  'openportal-managed-project-accounting-summary';

export const useProjectAccountingSummary = (
  projectUuid: string | undefined,
  enabled = true,
) =>
  useQuery({
    queryKey: [PROJECT_ACCOUNTING_SUMMARY_KEY, projectUuid],
    queryFn: () =>
      openportalManagedProjectAccountingSummaryList({
        query: { project_uuid: projectUuid },
      }).then((response) => response.data?.[0] ?? null),
    enabled: enabled && Boolean(projectUuid),
    staleTime: STALE_TIME,
  });

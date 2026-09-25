/**
 * Usage for the awards (remote projects) attached to a project.
 *
 * An award's usage must come from its own usage-report endpoint, never from
 * the raw monthly rows of `openportal-project-usage-reports`: those are keyed
 * by the identifier of whichever project held the award, so one award's
 * history is split across one key per project it has been on, and the month
 * it moved can be cached under both. The backend knows which key covered
 * which days and stitches them into one report.
 */

import {
  type CachedProjectUsageReport,
  type DailyProjectUsageReport as DailyJson,
  openportalRemoteProjectsList,
  openportalRemoteProjectsUsageReportRetrieve,
  type ProjectUsageReport as ReportJson,
  type RemoteProject,
  type RemoteProjectUsageWindow,
} from 'waldur-js-client';

import { isNotFound } from '@/proposals/archive/resolveArchived';

import { ProjectUsageReport } from './ProjectUsageReport';

export interface AwardUsage {
  remoteProject: RemoteProject;
  /** The award's report, one entry per calendar month it covers. */
  months: CachedProjectUsageReport[];
  /** Which project held the award, when. Disjoint, oldest first. */
  windows: RemoteProjectUsageWindow[];
  totalHours: number;
}

/**
 * Splits one report spanning many months into one per calendar month.
 *
 * This only partitions the days of a single stitched report — every day lands
 * in exactly one month — so recombining the months gives back the original.
 * It exists so the month picker, which works on monthly rows, still works.
 */
export const splitByMonth = (
  report: ReportJson,
  resource: string,
): CachedProjectUsageReport[] => {
  const byMonth = new Map<string, Record<string, DailyJson>>();
  for (const [date, daily] of Object.entries(report.reports ?? {})) {
    const key = date.slice(0, 7);
    if (!byMonth.has(key)) byMonth.set(key, {});
    byMonth.get(key)[date] = daily;
  }
  return [...byMonth.keys()].sort().map((key) => {
    const days = byMonth.get(key);
    const [year, month] = key.split('-').map(Number);
    return {
      id: 0,
      year,
      month,
      project_identifier: report.project,
      resource,
      is_complete: Object.values(days).every((daily) => daily.is_complete),
      report: { ...report, reports: days },
    };
  });
};

/**
 * The awards to report on for a project: one per destination, since a project
 * holds at most one award per cluster at a time.
 *
 * Only awards currently on this project are listed — the backend filters by
 * the award's current project, so history from an award that has since moved
 * away is not here.
 */
export const fetchProjectAwards = (
  projectUuid: string,
): Promise<RemoteProject[]> =>
  openportalRemoteProjectsList({ query: { project_uuid: projectUuid } }).then(
    (r) => (r.data ?? []).filter((rp) => rp.state !== 'deleted'),
  );

/**
 * One award's usage, or null when the user cannot see it (404). A pending
 * award has no report yet and comes back with no months, which the caller
 * shows as "no usage yet" rather than as an error.
 */
export const fetchAwardUsage = async (
  remoteProject: RemoteProject,
): Promise<AwardUsage | null> => {
  try {
    const { data } = await openportalRemoteProjectsUsageReportRetrieve({
      path: { uuid: remoteProject.uuid },
    });
    const report = data?.report as ReportJson | null | undefined;
    return {
      remoteProject,
      months: report ? splitByMonth(report, remoteProject.destination) : [],
      windows: data?.windows ?? [],
      totalHours: data?.total_hours ?? 0,
    };
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
};

export const fetchAllAwardUsage = async (
  remoteProjects: RemoteProject[],
): Promise<AwardUsage[]> =>
  (await Promise.all(remoteProjects.map(fetchAwardUsage))).filter(Boolean);

export const awardUsageReports = (awards: AwardUsage[]): ProjectUsageReport[] =>
  awards.flatMap((award) =>
    award.months.map(ProjectUsageReport.fromApiResponse),
  );

/**
 * Project-level OpenPortal usage report tab.
 *
 * Fetches usage and storage reports for the current project and renders them
 * using UsageReportVis / StorageReportVis.
 *
 * A project backed by awards (remote projects) takes its usage from each
 * award's own stitched report instead of the raw monthly rows, which are keyed
 * by project and so split — and can double-count — an award that has moved.
 * See awardUsage.ts.
 */

import { ArrowsClockwiseIcon } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { FC, useMemo, useState } from 'react';
import { Card, Form } from 'react-bootstrap';
import {
  CachedProjectStorageReport as StorageReportApiItem,
  CachedProjectUsageReport as UsageReportApiItem,
} from 'waldur-js-client';

import { IconButton } from '@/core/buttons/IconButton';
import { formatDate } from '@/core/dateUtils';
import { LoadingErred } from '@/core/LoadingErred';
import { LoadingSpinner } from '@/core/LoadingSpinner';
import { isFeatureVisible } from '@/features/connect';
import { CustomerFeatures } from '@/FeaturesEnums';
import { translate } from '@/i18n';
import { NoResult } from '@/navigation/header/search/NoResult';
import { useProject } from '@/workspace/hooks';

import {
  fetchUsageReports,
  fetchStorageReports,
  fetchOfferingMapping,
  fetchUserMapping,
  selectUserMappingIds,
} from './api';
import {
  AwardUsage,
  awardUsageReports,
  fetchAllAwardUsage,
  fetchProjectAwards,
} from './awardUsage';
import {
  getCached,
  setCached,
  clearCached,
  clearMappingCache,
  getCacheAge,
  formatCacheAge,
  TTL,
} from './localStorageCache';
import { ProjectStorageReport } from './ProjectStorageReport';
import { ProjectUsageReport } from './ProjectUsageReport';
import { resourceIdsOf, sortResourcesByUsage } from './resourceOrder';
import { StorageReportVis } from './StorageReportVis';
import { NameMaps } from './usageChartOptions';
import { UsageReportVis } from './UsageReportVis';

const MAX_USER_MAPPINGS = 100;

/** Module-level so the fallback keeps a stable identity across renders. */
const EMPTY_NAME_MAPS: NameMaps = {};

/** Group reports by "year-month" so the user can select a specific month */
const groupByMonth = <T extends { year: number; month: number }>(
  items: T[],
): Record<string, T[]> => {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const key = `${item.year}-${String(item.month).padStart(2, '0')}`;
    groups[key] = [...(groups[key] ?? []), item];
  }
  return groups;
};

interface AwardUsageResult {
  /** True when the project has awards at all, visible or not. */
  hasAwards: boolean;
  awards: AwardUsage[];
}

const NO_AWARDS: AwardUsageResult = { hasAwards: false, awards: [] };

export const OpenPortalReportsTab: FC = () => {
  const project = useProject();

  const awardsEnabled = isFeatureVisible(
    CustomerFeatures.show_openportal_remote_projects,
  );

  const {
    data: awardUsage,
    isLoading: awardLoading,
    error: awardError,
    refetch: refetchAwards,
  } = useQuery<AwardUsageResult>({
    queryKey: ['openportal-award-usage', project?.uuid],
    queryFn: async () => {
      const cacheKey = `project-award-usage-${project!.uuid}`;
      const cached = getCached<AwardUsageResult>(cacheKey, TTL.REPORTS);
      if (cached) return cached;
      const remoteProjects = await fetchProjectAwards(project!.uuid);
      const result = {
        hasAwards: remoteProjects.length > 0,
        awards: await fetchAllAwardUsage(remoteProjects),
      };
      setCached(cacheKey, result);
      return result;
    },
    enabled: !!project && awardsEnabled,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  // Settled once the award lookup has answered, or straight away where the
  // deployment has no awards. Until then neither source is fetched, so an
  // award-backed project never flashes the project rows it must not use.
  const awardsSettled = !awardsEnabled || awardUsage !== undefined;
  const { hasAwards, awards } = (awardsEnabled && awardUsage) || NO_AWARDS;

  const {
    data: projectUsageReports,
    isLoading: projectUsageLoading,
    error: projectUsageError,
    refetch: refetchProjectUsage,
  } = useQuery({
    queryKey: ['openportal-usage-reports', project?.uuid],
    queryFn: async () => {
      const cacheKey = `project-usage-${project!.uuid}`;
      const cached = getCached<UsageReportApiItem[]>(cacheKey, TTL.REPORTS);
      if (cached) return cached.map(ProjectUsageReport.fromApiResponse);
      const reports = await fetchUsageReports({ project_uuid: project!.uuid });
      setCached(
        cacheKey,
        reports.map((r) => r.apiItem),
      );
      return reports;
    },
    enabled: !!project && awardsSettled && !hasAwards,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  const awardReports = useMemo(() => awardUsageReports(awards), [awards]);
  const usageReports = hasAwards ? awardReports : projectUsageReports;
  const usageLoading = awardLoading || (!hasAwards && projectUsageLoading);
  const usageError = awardError || (!hasAwards && projectUsageError);
  const refetchUsage = () => {
    if (awardsEnabled) refetchAwards();
    refetchProjectUsage();
  };

  const {
    data: storageReports,
    isLoading: storageLoading,
    error: storageError,
    refetch: refetchStorage,
  } = useQuery({
    queryKey: ['openportal-storage-reports', project?.uuid],
    queryFn: async () => {
      const cacheKey = `project-storage-${project!.uuid}`;
      const cached = getCached<StorageReportApiItem[]>(cacheKey, TTL.REPORTS);
      if (cached) return cached.map(ProjectStorageReport.fromApiResponse);
      const reports = await fetchStorageReports({
        project_uuid: project!.uuid,
      });
      setCached(
        cacheKey,
        reports.map((r) => r.apiItem),
      );
      return reports;
    },
    enabled: !!project,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  const hasReports = !!(usageReports || storageReports);

  // ── Fetch name mappings once reports are available ───────────────────────
  const {
    data: nameMaps,
    isPending: mappingsPending,
    error: mappingsError,
  } = useQuery<NameMaps>({
    queryKey: ['openportal-project-mappings', project?.uuid, hasAwards],
    refetchOnWindowFocus: false,
    staleTime: Infinity,
    queryFn: async () => {
      const usage = usageReports ?? [];
      const storage = storageReports ?? [];
      const offeringIds = [
        ...new Set<string>([
          ...usage.map((r) => r.resource),
          ...storage.map((r) => r.resource),
        ]),
      ];
      const allUserIds = [
        ...new Set<string>(usage.flatMap((r) => Object.keys(r.users))),
      ];
      const usageByUid: Record<string, number> = {};
      for (const r of usage) {
        for (const [uid, localName] of Object.entries(r.users)) {
          let sec = 0;
          for (const date of r.dates) {
            sec += r.getReport(date)?.usageForUser(localName)?.seconds ?? 0;
          }
          usageByUid[uid] = (usageByUid[uid] ?? 0) + sec;
        }
      }
      const usersWithUsage = allUserIds
        .filter((uid) => (usageByUid[uid] ?? 0) > 0)
        .sort((a, b) => (usageByUid[b] ?? 0) - (usageByUid[a] ?? 0));
      // The cap counts only identifiers we'd have to fetch: already-cached
      // names come along for free, so repeat visits keep widening coverage
      // instead of re-requesting the same top slice every time.
      const { ids: userIds } = selectUserMappingIds(
        usersWithUsage,
        MAX_USER_MAPPINGS,
      );
      const offerings = await fetchOfferingMapping(offeringIds);
      const users = await fetchUserMapping(userIds);
      // Both mapping endpoints answer with null for an identifier they
      // cannot resolve rather than omitting it, so the nulls have to be
      // dropped before reading .name off the values. Skipping this filter is
      // what used to throw here and, because a rejected query leaves nameMaps
      // undefined, silently blanked the whole report.
      const maps = {
        offering: Object.fromEntries(
          Object.entries(offerings)
            .filter(([, v]) => v != null)
            .map(([k, v]) => [k, v.name]),
        ),
        user: Object.fromEntries(
          Object.entries(users)
            .filter(([, v]) => v != null)
            .map(([k, v]) => [k, v.full_name]),
        ),
      } as NameMaps;
      return maps;
    },
    enabled: hasReports,
  });

  // Identifier names are decoration; the charts read fine against raw
  // identifiers. So a failed lookup falls back to empty maps instead of
  // withholding the report, while a lookup still in flight keeps the charts
  // back for the moment it takes, to avoid a flash of raw identifiers.
  const baseNameMaps: NameMaps | undefined = mappingsError
    ? EMPTY_NAME_MAPS
    : nameMaps;
  // An award's report is filed under its destination, which the offering
  // mapping does not know; it goes by the name its connection card uses.
  const effectiveNameMaps: NameMaps | undefined = useMemo(
    () =>
      baseNameMaps && awards.length > 0
        ? {
            ...baseNameMaps,
            offering: {
              ...baseNameMaps.offering,
              ...Object.fromEntries(
                awards.map(({ remoteProject: rp }) => [
                  rp.destination,
                  rp.resource_name || rp.destination,
                ]),
              ),
            },
          }
        : baseNameMaps,
    [baseNameMaps, awards],
  );

  // Collect distinct resources across both report types, busiest first, so the
  // tab that opens is the one the project actually uses.
  const allResources = useMemo(
    () =>
      sortResourcesByUsage(
        [
          ...new Set([
            ...resourceIdsOf(usageReports),
            ...resourceIdsOf(storageReports),
          ]),
        ],
        usageReports ?? [],
        effectiveNameMaps?.offering,
      ),
    [usageReports, storageReports, effectiveNameMaps?.offering],
  );

  const [selectedResource, setSelectedResource] = useState<string>('');
  const activeResource = allResources.includes(selectedResource)
    ? selectedResource
    : (allResources[0] ?? '');

  const usageForResource = (usageReports ?? []).filter(
    (r) => r.resource === activeResource,
  );
  const storageForResource = (storageReports ?? []).filter(
    (r) => r.resource === activeResource,
  );

  const usageByMonth = groupByMonth(usageForResource);
  const storageByMonth = groupByMonth(storageForResource);
  const allMonths = [
    ...new Set([...Object.keys(usageByMonth), ...Object.keys(storageByMonth)]),
  ]
    .sort()
    .reverse();

  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const activeMonth = selectedMonth;

  const activeUsage: ProjectUsageReport[] =
    activeMonth === 'all'
      ? usageForResource
      : (usageByMonth[activeMonth] ?? []);
  const activeStorage: ProjectStorageReport[] =
    activeMonth === 'all'
      ? storageForResource
      : (storageByMonth[activeMonth] ?? []);

  const isLoading =
    usageLoading ||
    storageLoading ||
    !awardsSettled ||
    (hasReports && mappingsPending && !mappingsError);

  const reportsCacheAge =
    !isLoading && project
      ? getCacheAge(
          hasAwards
            ? `project-award-usage-${project.uuid}`
            : `project-usage-${project.uuid}`,
        )
      : null;

  const activeAward = awards.find(
    (award) => award.remoteProject.destination === activeResource,
  );

  return (
    <Card className="card-bordered">
      <Card.Header className="border-bottom">
        <div className="d-flex align-items-center gap-3 flex-wrap w-100">
          <div className="d-flex align-items-center me-2">
            <span className="h3 mb-0">{translate('Usage Report')}</span>
            <IconButton
              iconNode={<ArrowsClockwiseIcon weight="bold" />}
              tooltip={translate('Refresh')}
              variant="text-secondary"
              onClick={() => {
                clearMappingCache();
                if (project) {
                  clearCached(
                    `project-usage-${project.uuid}`,
                    `project-storage-${project.uuid}`,
                    `project-award-usage-${project.uuid}`,
                  );
                }
                refetchUsage();
                refetchStorage();
              }}
            />
          </div>

          {/* Resource / destination picker */}
          {allResources.length > 1 && (
            <Form.Select
              size="lg"
              style={{ width: 'auto' }}
              value={activeResource}
              onChange={(e) => {
                setSelectedResource(e.target.value);
                setSelectedMonth('all');
              }}
            >
              {allResources.map((r) => (
                <option key={r} value={r}>
                  {effectiveNameMaps?.offering?.[r] ?? r}
                </option>
              ))}
            </Form.Select>
          )}

          {/* Month picker */}
          {allMonths.length > 0 && (
            <Form.Select
              size="lg"
              style={{ width: 'auto' }}
              value={activeMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              <option value="all">{translate('All time')}</option>
              {allMonths.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Form.Select>
          )}

          {reportsCacheAge && (
            <span className="text-muted small ms-auto">
              {translate('Cached {age}', {
                age: formatCacheAge(reportsCacheAge),
              })}
            </span>
          )}
        </div>
      </Card.Header>
      <Card.Body>
        {isLoading && <LoadingSpinner />}

        {usageError && (
          <LoadingErred
            message={translate('Failed to load usage reports')}
            loadData={refetchUsage}
          />
        )}

        {storageError && (
          <LoadingErred
            message={translate('Failed to load storage reports')}
            loadData={refetchStorage}
          />
        )}

        {!isLoading &&
          !usageError &&
          !storageError &&
          allMonths.length === 0 && (
            <NoResult
              title={translate('No usage reports yet')}
              message={
                hasAwards
                  ? translate(
                      'No usage has been reported for the awards on this project yet.',
                    )
                  : translate(
                      'No OpenPortal reports have been generated for this project.',
                    )
              }
              noAction
            />
          )}

        {/* Names are optional, so this is a note rather than an error: the
            charts below are complete, they just label by raw identifier. */}
        {mappingsError && (
          <p className="text-muted small mb-4">
            {translate(
              'Could not load offering and user names; showing identifiers instead.',
            )}
          </p>
        )}

        {activeAward && (
          <AwardWindows award={activeAward} projectUuid={project?.uuid} />
        )}

        {/* Usage chart */}
        {activeUsage.length > 0 && effectiveNameMaps !== undefined && (
          <div className="mb-6">
            <h4 className="fw-semibold mb-3">{translate('Usage')}</h4>
            <UsageReportVis
              reports={activeUsage}
              height="400px"
              nameMaps={effectiveNameMaps}
            />
          </div>
        )}

        {/* Storage chart */}
        {activeStorage.length > 0 && effectiveNameMaps !== undefined && (
          <div>
            <h4 className="fw-semibold mb-3">{translate('Storage')}</h4>
            <StorageReportVis
              reports={activeStorage}
              height="360px"
              nameMaps={effectiveNameMaps}
            />
          </div>
        )}
      </Card.Body>
    </Card>
  );
};

const sameProject = (a: string | null, b: string | undefined): boolean =>
  Boolean(a && b) && a.replace(/-/g, '') === b.replace(/-/g, '');

/**
 * Which project held the award, when — the award's usage covers all of them.
 *
 * Names are the recorded ones and are not linked: the project may be gone, or
 * be one this user cannot open.
 */
const AwardWindows: FC<{ award: AwardUsage; projectUuid?: string }> = ({
  award,
  projectUuid,
}) => {
  if (award.windows.length === 0) return null;
  const movedBetweenProjects = award.windows.some(
    (w) => !sameProject(w.project_uuid, projectUuid),
  );
  return (
    <div className="text-muted mb-5">
      {movedBetweenProjects && (
        <p className="mb-2">
          {translate(
            'This award has been attached to more than one project. Its usage below covers all of them.',
          )}
        </p>
      )}
      <ul className="mb-0 ps-5">
        {award.windows.map((w) => (
          <li key={`${w.start}-${w.project_identifier}`}>
            {translate('{project}: {start} to {end}', {
              project: sameProject(w.project_uuid, projectUuid)
                ? translate('This project')
                : w.project_name || translate('A project no longer available'),
              start: formatDate(w.start),
              end: w.end ? formatDate(w.end) : translate('now'),
            })}
          </li>
        ))}
      </ul>
    </div>
  );
};

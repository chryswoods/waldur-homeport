import {
  openportalManagedProjectAccountingSummaryList,
  openportalManagedProjectsList,
  type Project,
  projectsListUsersList,
} from 'waldur-js-client';

import { getAllPages } from '@/core/api';

import { type ProjectExportRow } from './projectsWorkbook';

export interface FetchProgress {
  /** 1-based stage, for "Stage 2 of 3". */
  stage: number;
  stageCount: number;
  label: string;
  done: number;
  /** 0 when the total is not known yet, which renders an indeterminate bar. */
  max: number;
}

export interface FetchOptions {
  projects: Project[];
  /** Award identity, dates and accounting. Off when no sheet needs them. */
  needsAwards: boolean;
  /** Project members. Off when the People sheet is not selected. */
  needsMembers: boolean;
  onProgress: (progress: FetchProgress) => void;
  /** Checked between requests so a closed dialog stops the run. */
  isCancelled?: () => boolean;
}

/**
 * Gather everything the workbook needs for a set of projects.
 *
 * Deliberately sequential per project rather than fired all at once: an export
 * of a few hundred projects would otherwise open a few hundred connections at
 * the same moment, and the progress bar exists precisely because this is slow
 * enough to need one. The awards list is fetched whole instead of per project,
 * which is the one place where a single paginated call replaces N.
 */
export const fetchProjectExportRows = async ({
  projects,
  needsAwards,
  needsMembers,
  onProgress,
  isCancelled,
}: FetchOptions): Promise<ProjectExportRow[]> => {
  const rows: ProjectExportRow[] = projects.map((project) => ({ project }));
  const byUuid = new Map(rows.map((row) => [row.project.uuid, row]));
  const stageCount = 1 + (needsAwards ? 2 : 0) + (needsMembers ? 1 : 0);
  let stage = 0;
  const cancelled = () => Boolean(isCancelled?.());

  stage += 1;
  onProgress({
    stage,
    stageCount,
    label: 'projects',
    done: projects.length,
    max: projects.length,
  });

  if (needsAwards) {
    stage += 1;
    onProgress({ stage, stageCount, label: 'awards', done: 0, max: 0 });
    const awards = await getAllPages((page) =>
      openportalManagedProjectsList({ query: { page, page_size: 200 } }),
    );
    for (const award of awards) {
      const row = byUuid.get(award.project_data?.uuid);
      // Rejected and detached awards are not this project's current one, and
      // the accounting endpoint reports only the attached award anyway.
      if (!row || !['approved', 'pending'].includes(award.state)) continue;
      row.award = {
        identifier: award.identifier,
        destination: award.destination,
        startDate: award.details?.start_date ?? null,
        endDate: award.details?.end_date ?? null,
      };
    }
    onProgress({
      stage,
      stageCount,
      label: 'awards',
      done: awards.length,
      max: awards.length,
    });

    const withAward = rows.filter((row) => row.award);
    stage += 1;
    for (const [index, row] of withAward.entries()) {
      if (cancelled()) return rows;
      onProgress({
        stage,
        stageCount,
        label: 'allocations',
        done: index,
        max: withAward.length,
      });
      try {
        const response = await openportalManagedProjectAccountingSummaryList({
          query: { project_uuid: row.project.uuid },
        });
        row.accounting = response.data?.[0] ?? null;
      } catch {
        // One project's figures failing must not lose the whole export; the
        // cell is left empty, which reads the same as an award with no
        // resolvable allocation.
        row.accounting = null;
      }
    }
    onProgress({
      stage,
      stageCount,
      label: 'allocations',
      done: withAward.length,
      max: withAward.length,
    });
  }

  if (needsMembers) {
    stage += 1;
    for (const [index, row] of rows.entries()) {
      if (cancelled()) return rows;
      onProgress({
        stage,
        stageCount,
        label: 'people',
        done: index,
        max: rows.length,
      });
      try {
        row.members = await getAllPages((page) =>
          projectsListUsersList({
            path: { uuid: row.project.uuid },
            query: { page, page_size: 200 },
          }),
        );
      } catch {
        row.members = [];
      }
    }
    onProgress({
      stage,
      stageCount,
      label: 'people',
      done: rows.length,
      max: rows.length,
    });
  }

  return rows;
};

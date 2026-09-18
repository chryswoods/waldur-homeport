import {
  type ManagedProjectAccountingSummary,
  type Project,
  type UserRoleDetails,
} from 'waldur-js-client';

import { formatISODate } from '@/core/dateUtils';
import { translate } from '@/i18n';

import { type SheetSpec } from '../reports/reportExcel';

export type SheetKey = 'projects' | 'people' | 'awards';

/** One project with everything gathered for it. */
export interface ProjectExportRow {
  project: Project;
  /** Award accounting, when the project is backed by an award. */
  accounting?: ManagedProjectAccountingSummary | null;
  /** Award window and identity, when there is an award. */
  award?: {
    identifier: string;
    destination: string;
    startDate: string | null;
    endDate: string | null;
  } | null;
  /** Everyone with a role on the project. */
  members?: UserRoleDetails[];
}

const date = (value: string | null | undefined): string =>
  value ? formatISODate(value) : '';

const num = (value: number | null | undefined): number | string =>
  value === null || value === undefined ? '' : value;

/**
 * Columns a caller can pick for the Projects sheet. Keyed rather than positional
 * so the dialog's checkboxes and the sheet cannot drift apart.
 */
export const PROJECT_COLUMNS = {
  name: { label: () => translate('Project'), value: (r) => r.project.name },
  slug: { label: () => translate('ID'), value: (r) => r.project.slug },
  description: {
    label: () => translate('Description'),
    value: (r) => r.project.description || '',
  },
  start_date: {
    label: () => translate('Start date'),
    value: (r) => date(r.project.start_date),
  },
  end_date: {
    label: () => translate('End date'),
    value: (r) => date(r.project.end_date),
  },
  effective_end_date: {
    label: () => translate('Access ends'),
    value: (r) => date(r.project.effective_end_date),
  },
  award_identifier: {
    label: () => translate('Award'),
    value: (r) => r.award?.identifier || '',
  },
  allocation: {
    label: () => translate('Allocation'),
    value: (r) => num(r.accounting?.allocation_credits),
  },
  used: {
    label: () => translate('Used'),
    value: (r) => num(r.accounting?.usage_credits),
  },
  remaining: {
    label: () => translate('Remaining'),
    value: (r) => num(r.accounting?.remaining_credits),
  },
  members_count: {
    label: () => translate('People'),
    value: (r) => (r.members ? r.members.length : ''),
  },
} satisfies Record<
  string,
  { label: () => string; value: (row: ProjectExportRow) => unknown }
>;

export type ProjectColumnKey = keyof typeof PROJECT_COLUMNS;

export const PROJECT_COLUMN_KEYS = Object.keys(
  PROJECT_COLUMNS,
) as ProjectColumnKey[];

export const buildProjectsSheet = (
  rows: ProjectExportRow[],
  columns: ProjectColumnKey[],
): SheetSpec => ({
  name: translate('Projects'),
  rows: [
    columns.map((key) => PROJECT_COLUMNS[key].label()),
    ...rows.map((row) => columns.map((key) => PROJECT_COLUMNS[key].value(row))),
  ],
});

/**
 * One row per person per project — the shape the question "give me every
 * project lead" actually needs, and the one a project-per-row sheet cannot
 * express because a project has many members.
 *
 * `roles` filters by role name; an empty list means every role, which is what
 * the dialog starts with.
 */
export const buildPeopleSheet = (
  rows: ProjectExportRow[],
  roles: string[],
): SheetSpec => {
  const wanted = new Set(roles);
  // No roles selected means every role. The two have to agree, or clearing the
  // last checkbox would silently export an empty sheet.
  const keep = (member: UserRoleDetails) =>
    wanted.size === 0 || wanted.has(member.role_name);

  return {
    name: translate('People'),
    rows: [
      [
        translate('Project'),
        translate('Project ID'),
        translate('Full name'),
        translate('Email'),
        translate('Username'),
        translate('Role'),
        translate('Expires'),
      ],
      ...rows.flatMap((row) =>
        (row.members ?? [])
          .filter(keep)
          .map((member) => [
            row.project.name,
            row.project.slug,
            member.user_full_name || '',
            member.user_email || '',
            member.user_username || '',
            member.role_name || '',
            date(member.expiration_time),
          ]),
      ),
    ],
  };
};

export const buildAwardsSheet = (rows: ProjectExportRow[]): SheetSpec => ({
  name: translate('Awards'),
  rows: [
    [
      translate('Project'),
      translate('Award'),
      translate('Destination'),
      translate('Award start'),
      translate('Award end'),
      translate('Allocation'),
      translate('Used'),
      translate('Remaining'),
    ],
    ...rows
      .filter((row) => row.award)
      .map((row) => [
        row.project.name,
        row.award!.identifier,
        row.award!.destination,
        date(row.award!.startDate),
        date(row.award!.endDate),
        num(row.accounting?.allocation_credits),
        num(row.accounting?.usage_credits),
        num(row.accounting?.remaining_credits),
      ]),
  ],
});

export const buildSheets = (
  rows: ProjectExportRow[],
  sheets: SheetKey[],
  columns: ProjectColumnKey[],
  roles: string[],
): SheetSpec[] => {
  const specs: SheetSpec[] = [];
  if (sheets.includes('projects')) {
    specs.push(buildProjectsSheet(rows, columns));
  }
  if (sheets.includes('people')) {
    specs.push(buildPeopleSheet(rows, roles));
  }
  if (sheets.includes('awards')) {
    specs.push(buildAwardsSheet(rows));
  }
  return specs;
};

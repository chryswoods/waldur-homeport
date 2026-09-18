import { describe, expect, it } from 'vitest';

import {
  buildAwardsSheet,
  buildPeopleSheet,
  buildProjectsSheet,
  type ProjectExportRow,
} from './projectsWorkbook';

const member = (user_full_name: string, role_name: string, user_email = '') =>
  ({
    user_full_name,
    role_name,
    user_email,
    user_username: user_full_name.toLowerCase(),
  }) as any;

const rows: ProjectExportRow[] = [
  {
    project: {
      name: 'Thermoelectrics',
      slug: 'u35an',
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      description: 'New materials',
    } as any,
    accounting: {
      allocation_credits: 53750,
      usage_credits: 38319.58,
      remaining_credits: 15430.42,
    } as any,
    award: {
      identifier: 'APP96361',
      destination: 'brics.aip1',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    },
    members: [
      member('Ada Lovelace', 'Project manager', 'ada@example.org'),
      member('Alan Turing', 'Project member', 'alan@example.org'),
    ],
  },
  {
    project: { name: 'No award', slug: 'zzz' } as any,
    members: [member('Grace Hopper', 'Project manager')],
  },
];

describe('buildProjectsSheet', () => {
  it('emits the chosen columns in the chosen order', () => {
    const sheet = buildProjectsSheet(rows, ['name', 'remaining', 'slug']);

    expect(sheet.rows[0]).toEqual(['Project', 'Remaining', 'ID']);
    expect(sheet.rows[1]).toEqual(['Thermoelectrics', 15430.42, 'u35an']);
  });

  // An empty cell, not a zero: a project with no award has no allocation, and
  // a zero would read as one that has spent everything.
  it('leaves award figures blank for a project without one', () => {
    const sheet = buildProjectsSheet(rows, ['name', 'allocation']);

    expect(sheet.rows[2]).toEqual(['No award', '']);
  });
});

describe('buildPeopleSheet', () => {
  // The question this sheet exists for: one row per person per project, which
  // a project-per-row sheet cannot express.
  it('emits a row per person per project', () => {
    const sheet = buildPeopleSheet(rows, []);

    expect(sheet.rows).toHaveLength(4); // header + 3 people
    expect(sheet.rows[1]).toContain('Ada Lovelace');
    expect(sheet.rows[3]).toContain('Grace Hopper');
  });

  it('keeps only the roles asked for', () => {
    const sheet = buildPeopleSheet(rows, ['Project manager']);

    expect(sheet.rows).toHaveLength(3);
    expect(sheet.rows.flat()).not.toContain('Alan Turing');
  });

  // Every role selected and no role selected have to mean the same thing, or
  // clearing the last checkbox would silently export nothing.
  it('treats an empty role selection as every role', () => {
    expect(buildPeopleSheet(rows, []).rows).toHaveLength(4);
  });
});

describe('buildAwardsSheet', () => {
  it('lists only the projects that have an award', () => {
    const sheet = buildAwardsSheet(rows);

    expect(sheet.rows).toHaveLength(2);
    expect(sheet.rows[1][1]).toBe('APP96361');
  });
});

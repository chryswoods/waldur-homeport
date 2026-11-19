import { describe, expect, it } from 'vitest';

import {
  componentLabel,
  FORFEIT_COLOUR,
  forfeitLast,
  isForfeitUser,
} from './forfeit';
import { ProjectUsageReport } from './ProjectUsageReport';
import { buildUsageSheets } from './reportExcel';
import {
  buildJobsTimeseriesOptions,
  buildPieOptions,
  buildTimeseriesOptions,
} from './usageChartOptions';

const hours = (h: number) => ({ seconds: h * 3600 });

// Two people, and a 30 h forfeit charged on the period's last day.
const report = () =>
  ProjectUsageReport.fromApiResponse({
    id: 1,
    year: 2026,
    month: 6,
    project_identifier: 'lab.airr',
    resource: 'airr.cluster',
    is_complete: true,
    report: {
      project: 'lab.airr',
      users: {
        'ada.lab.airr': 'ada.lab',
        'bob.lab.airr': 'bob.lab',
        'forfeit.lab.airr': 'forfeit',
      },
      reports: {
        '2026-06-29': {
          is_complete: true,
          reports: { 'ada.lab': hours(10), 'bob.lab': hours(50) },
          components: { gpu: { 'ada.lab': hours(10), 'bob.lab': hours(50) } },
          num_jobs: 3,
          user_job_counts: { 'ada.lab': 1, 'bob.lab': 2 },
        },
        '2026-06-30': {
          is_complete: true,
          reports: { forfeit: hours(30) },
          components: { forfeit: { forfeit: hours(30) } },
        },
      },
    },
  } as any);

const nameMaps = {
  user: { 'ada.lab.airr': 'Ada Lovelace', 'bob.lab.airr': 'Bob Smith' },
} as any;

describe('the spend profile forfeit in usage reports', () => {
  it('is recognised by its local user or its identifier, and nobody else', () => {
    expect(isForfeitUser('forfeit')).toBe(true);
    expect(isForfeitUser('forfeit.lab.airr')).toBe(true);
    expect(isForfeitUser('forfeiture.lab')).toBe(false);
    expect(isForfeitUser('ada.lab')).toBe(false);
    expect(isForfeitUser(undefined)).toBe(false);
  });

  it('names its component "Forfeit", and others as before', () => {
    expect(componentLabel('forfeit')).toBe('Forfeit');
    expect(componentLabel('gpu')).toBe('Gpu');
  });

  it('moves the forfeit to the end', () => {
    expect(forfeitLast(['forfeit', 'ada', 'bob'], (u) => u)).toEqual([
      'ada',
      'bob',
      'forfeit',
    ]);
  });

  it('shows the forfeit last, labelled, in grey, in the usage chart', () => {
    const options: any = buildTimeseriesOptions(
      report(),
      'total',
      'day',
      false,
      nameMaps,
    );
    const names = options.series.map((s) => s.name);
    expect(names).toEqual([
      'Bob Smith',
      'Ada Lovelace',
      'Forfeit (spend profile)',
    ]);
    expect(options.series[2].itemStyle.color).toBe(FORFEIT_COLOUR);
  });

  it('keeps the forfeit in the totals', () => {
    expect(report().totalUsageHours()).toBe(90);
    const pie: any = buildPieOptions(report(), 'total', false, nameMaps);
    const slices = pie.series[0].data;
    expect(slices.at(-1)).toMatchObject({
      name: 'Forfeit (spend profile)',
      value: 30,
      itemStyle: { color: FORFEIT_COLOUR },
    });
    expect(slices.reduce((s, d) => s + d.value, 0)).toBe(90);
  });

  it('leaves the forfeit out of the jobs chart: it is not a job', () => {
    const options: any = buildJobsTimeseriesOptions(
      report(),
      'day',
      false,
      nameMaps,
    );
    expect(options.series.map((s) => s.name)).not.toContain(
      'Forfeit (spend profile)',
    );
  });

  it('keeps the forfeit row in the Excel export, labelled', () => {
    const sheets = buildUsageSheets([report()], nameMaps);
    const byUser = sheets.find((s) => s.name === 'Usage by user');
    expect(byUser.rows[0]).toContain('Forfeit (spend profile)');
    expect(sheets.map((s) => s.name)).toContain('Comp Forfeit');
    const members = sheets.find((s) => s.name === 'Project members');
    expect(members.rows.map((row) => row[2])).toContain(
      'Forfeit (spend profile)',
    );
  });
});

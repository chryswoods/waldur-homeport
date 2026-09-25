import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  openportalRemoteProjectsUsageReportRetrieve,
  type RemoteProject,
} from 'waldur-js-client';

import { awardUsageReports, fetchAwardUsage, splitByMonth } from './awardUsage';
import { ProjectUsageReport } from './ProjectUsageReport';

const day = (seconds: number, is_complete = true) => ({
  is_complete,
  reports: { 'chris.aiproject': { seconds } },
});

const REPORT: any = {
  project: 'aiproject.brics',
  users: { 'chris.aiproject.brics': 'chris.aiproject' },
  reports: {
    '2026-07-30': day(3600),
    '2026-07-31': day(7200),
    '2026-08-01': day(3600, false),
  },
};

const award = { uuid: 'rp1', destination: 'airr.brics' } as RemoteProject;

describe('splitByMonth', () => {
  it('partitions the days into calendar months', () => {
    const months = splitByMonth(REPORT, 'airr.brics');

    expect(months.map((m) => [m.year, m.month])).toEqual([
      [2026, 7],
      [2026, 8],
    ]);
    expect(Object.keys(months[0].report.reports)).toEqual([
      '2026-07-30',
      '2026-07-31',
    ]);
    expect(months[0].is_complete).toBe(true);
    expect(months[1].is_complete).toBe(false);
    expect(months.every((m) => m.resource === 'airr.brics')).toBe(true);
  });

  // Splitting only partitions one stitched report, so nothing is counted twice.
  it('recombines to the original total', () => {
    const reports = splitByMonth(REPORT, 'airr.brics').map(
      ProjectUsageReport.fromApiResponse,
    );

    expect(ProjectUsageReport.combine(reports).totalUsageHours()).toBe(4);
  });
});

describe('fetchAwardUsage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the months and windows of the stitched report', async () => {
    vi.mocked(openportalRemoteProjectsUsageReportRetrieve).mockResolvedValue({
      data: {
        start: '2026-07-01',
        end: '2026-08-01',
        total_hours: 4,
        report: REPORT,
        windows: [
          {
            project_uuid: 'p1',
            project_name: 'One',
            start: '2026-07-01',
            end: null,
            project_identifier: 'one.brics',
          },
        ],
      },
    } as any);

    const usage = await fetchAwardUsage(award);

    expect(usage.totalHours).toBe(4);
    expect(usage.windows).toHaveLength(1);
    expect(awardUsageReports([usage])).toHaveLength(2);
  });

  // Not approved yet: no report, which is "no usage yet" rather than an error.
  it('gives a pending award no months', async () => {
    vi.mocked(openportalRemoteProjectsUsageReportRetrieve).mockResolvedValue({
      data: {
        start: null,
        end: null,
        total_hours: 0,
        report: null,
        windows: [],
      },
    } as any);

    expect((await fetchAwardUsage(award)).months).toEqual([]);
  });

  it('treats a 404 as not visible', async () => {
    vi.mocked(openportalRemoteProjectsUsageReportRetrieve).mockRejectedValue({
      response: { status: 404 },
    });

    expect(await fetchAwardUsage(award)).toBeNull();
  });

  it('lets any other error through', async () => {
    vi.mocked(openportalRemoteProjectsUsageReportRetrieve).mockRejectedValue({
      response: { status: 500 },
    });

    await expect(fetchAwardUsage(award)).rejects.toEqual({
      response: { status: 500 },
    });
  });
});

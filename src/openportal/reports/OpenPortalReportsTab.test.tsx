import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  openportalOfferingMappingRetrieve,
  openportalRemoteProjectsList,
  openportalRemoteProjectsUsageReportRetrieve,
  openportalUserMappingRetrieve,
} from 'waldur-js-client';

import { isFeatureVisible } from '@/features/connect';
import { renderWithProviders } from '@/test/harness';
import { useProject } from '@/workspace/hooks';

import * as api from './api';
import { OpenPortalReportsTab } from './OpenPortalReportsTab';
import { ProjectStorageReport } from './ProjectStorageReport';
import { ProjectUsageReport } from './ProjectUsageReport';

// Only the two report fetchers are stubbed; the mapping helpers run for real
// against the mocked SDK, because the bug this file guards lives in how their
// responses are consumed.
vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof api>()),
  fetchUsageReports: vi.fn(),
  fetchStorageReports: vi.fn(),
}));

vi.mock('@/features/connect', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/connect')>()),
  isFeatureVisible: vi.fn(() => false),
}));

const RESOURCE = 'brics.aip1.clusters.shared';
const USER_ID = 'chris.aiproject.brics';

const usageItem: any = {
  id: 1,
  year: 2026,
  month: 8,
  project_identifier: 'aiproject.brics',
  resource: RESOURCE,
  is_complete: true,
  report: {
    project: 'aiproject.brics',
    users: { [USER_ID]: 'chris.aiproject' },
    reports: {
      '2026-08-01': {
        is_complete: true,
        reports: { 'chris.aiproject': { seconds: 3600 } },
      },
    },
  },
};

const storageItem: any = {
  id: 2,
  year: 2026,
  month: 8,
  project_identifier: 'aiproject.brics',
  resource: RESOURCE,
  report: {
    project: 'aiproject.brics',
    generated_at: '2026-08-31T00:00:00Z',
    project_quotas: { home: { limit: '1024.00 GB', usage: '24.00 KB' } },
    user_quotas: {
      [USER_ID]: { home: { limit: 'unlimited', usage: '1.00 GB' } },
    },
    users: { [USER_ID]: 'chris.aiproject' },
  },
};

describe('OpenPortalReportsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(isFeatureVisible).mockReturnValue(false);
    vi.mocked(useProject).mockReturnValue({ uuid: 'proj-uuid' } as any);
    vi.mocked(api.fetchUsageReports).mockResolvedValue([
      ProjectUsageReport.fromApiResponse(usageItem),
    ]);
    vi.mocked(api.fetchStorageReports).mockResolvedValue([
      ProjectStorageReport.fromApiResponse(storageItem),
    ]);
  });

  it('renders the charts when every identifier resolves to a name', async () => {
    vi.mocked(openportalOfferingMappingRetrieve).mockResolvedValue({
      data: { [RESOURCE]: { uuid: 'o1', name: 'Shared cluster' } },
    } as any);
    vi.mocked(openportalUserMappingRetrieve).mockResolvedValue({
      data: { [USER_ID]: { full_name: 'Chris' } },
    } as any);

    renderWithProviders(<OpenPortalReportsTab />);

    await waitFor(() => expect(screen.getByText('Usage')).toBeInTheDocument());
    expect(screen.getByText('Storage')).toBeInTheDocument();
  });

  // The mapping endpoints answer with null for any identifier they cannot
  // resolve — documented behaviour, and common at project level where a
  // report's resource may have no matching offering. A null must not take the
  // charts down with it.
  it('still renders the charts when an identifier maps to null', async () => {
    vi.mocked(openportalOfferingMappingRetrieve).mockResolvedValue({
      data: { [RESOURCE]: null },
    } as any);
    vi.mocked(openportalUserMappingRetrieve).mockResolvedValue({
      data: { [USER_ID]: null },
    } as any);

    renderWithProviders(<OpenPortalReportsTab />);

    await waitFor(() => expect(screen.getByText('Usage')).toBeInTheDocument());
    expect(screen.getByText('Storage')).toBeInTheDocument();
  });

  // Names are decoration. If the lookup fails outright the report is still
  // worth showing against raw identifiers.
  it('still renders the charts when the mapping lookup fails', async () => {
    vi.mocked(openportalOfferingMappingRetrieve).mockRejectedValue(
      new Error('boom'),
    );
    vi.mocked(openportalUserMappingRetrieve).mockRejectedValue(
      new Error('boom'),
    );

    renderWithProviders(<OpenPortalReportsTab />);

    await waitFor(() => expect(screen.getByText('Usage')).toBeInTheDocument());
    expect(screen.getByText('Storage')).toBeInTheDocument();
  });
});

describe('OpenPortalReportsTab for a project with awards', () => {
  const window = (overrides = {}) => ({
    project_uuid: 'proj-uuid',
    project_name: 'Here',
    start: '2026-08-01',
    end: null,
    project_identifier: 'here.brics',
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(isFeatureVisible).mockReturnValue(true);
    vi.mocked(useProject).mockReturnValue({ uuid: 'proj-uuid' } as any);
    vi.mocked(api.fetchStorageReports).mockResolvedValue([]);
    vi.mocked(openportalOfferingMappingRetrieve).mockResolvedValue({
      data: {},
    } as any);
    vi.mocked(openportalUserMappingRetrieve).mockResolvedValue({
      data: {},
    } as any);
    vi.mocked(openportalRemoteProjectsList).mockResolvedValue({
      data: [
        {
          uuid: 'rp1',
          destination: 'airr.brics',
          resource_name: 'Isambard-AI',
          state: 'active',
        },
      ],
    } as any);
  });

  // The project's raw rows are keyed by project and split an award that has
  // moved, so they are never read for an award-backed project.
  it("reads the award's stitched report, not the project rows", async () => {
    vi.mocked(openportalRemoteProjectsUsageReportRetrieve).mockResolvedValue({
      data: {
        total_hours: 1,
        report: usageItem.report,
        windows: [
          window({
            project_uuid: 'other',
            project_name: 'Before',
            start: '2026-07-01',
            end: '2026-07-31',
          }),
          window(),
        ],
      },
    } as any);

    renderWithProviders(<OpenPortalReportsTab />);

    await waitFor(() => expect(screen.getByText('Usage')).toBeInTheDocument());
    expect(api.fetchUsageReports).not.toHaveBeenCalled();
    expect(
      screen.getByText(/attached to more than one project/),
    ).toBeInTheDocument();
    expect(screen.getByText(/^Before:/)).toBeInTheDocument();
    expect(screen.getByText(/^This project:/)).toBeInTheDocument();
  });

  it('says there is no usage yet for a pending award', async () => {
    vi.mocked(openportalRemoteProjectsUsageReportRetrieve).mockResolvedValue({
      data: { total_hours: 0, report: null, windows: [] },
    } as any);

    renderWithProviders(<OpenPortalReportsTab />);

    expect(
      await screen.findByText(/No usage has been reported for the awards/),
    ).toBeInTheDocument();
    expect(api.fetchUsageReports).not.toHaveBeenCalled();
  });
});

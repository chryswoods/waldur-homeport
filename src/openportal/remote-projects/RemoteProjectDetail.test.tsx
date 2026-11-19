import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  openportalRemoteProjectsRetrieve,
  type RemoteProject,
} from 'waldur-js-client';

import { renderWithProviders } from '@/test/harness';
import { useUser } from '@/workspace/hooks';

import { RemoteProjectDetail } from './RemoteProjectDetail';

// The tables run their fetchData once and render their rows' cells.
vi.mock('@/table/useTable', async () => {
  const { useEffect, useState } = await import('react');
  return {
    useTable: ({ fetchData }) => {
      const [rows, setRows] = useState([]);
      useEffect(() => {
        fetchData({}).then((result) => setRows(result.rows));
      }, []);
      return { rows, fetch: vi.fn() };
    },
  };
});
vi.mock('@/table/Table', () => ({
  default: ({ rows, columns }) => (
    <div>
      {rows.map((row, i) => (
        <div key={i} data-testid="table-row">
          {columns.map((column, j) => (
            <span key={j}>{column.render({ row })}</span>
          ))}
        </div>
      ))}
    </div>
  ),
}));

vi.mock('./RemoteProjectAuditLog', () => ({
  RemoteProjectAuditLog: () => null,
}));

const project = (
  state: RemoteProject['state'],
  extra: Partial<RemoteProject> = {},
) =>
  ({
    uuid: 'rp-1',
    current_project_name: 'Brain models',
    destination: 'aip2.brics',
    identifier: 'brainmodels',
    state,
    created: '2026-01-01T00:00:00Z',
    notes: [],
    ...extra,
  }) as RemoteProject;

const renderPage = async (
  state: RemoteProject['state'],
  user: Record<string, unknown>,
  extra: Partial<RemoteProject> = {},
) => {
  vi.mocked(useUser).mockReturnValue(user as any);
  vi.mocked(openportalRemoteProjectsRetrieve).mockResolvedValue({
    data: project(state, extra),
  } as any);
  renderWithProviders(<RemoteProjectDetail />);
  await screen.findByText('Brain models');
};

const gear = (section: string) =>
  screen.getByRole('button', { name: `Edit ${section}` });

const menuItems = async (section: string) => {
  await userEvent.setup().click(gear(section));
  const menu = await screen.findByTestId('actions-menu');
  return within(menu)
    .getAllByTestId('action-item')
    .map((item) => item.textContent);
};

describe('RemoteProjectDetail', () => {
  beforeEach(() => vi.clearAllMocks());

  it('puts each box’s edits behind a gear in its corner', async () => {
    await renderPage('active', { is_staff: true });
    expect(await menuItems('Links')).toEqual(['Set links']);
  });

  it('offers membership control and allowed domains from the membership box', async () => {
    await renderPage('active', { is_staff: true });
    expect(await menuItems('Membership')).toEqual([
      'Set membership control',
      'Set allowed domains',
    ]);
  });

  it('offers approve now and hold only while the project is pending', async () => {
    await renderPage('pending', { is_staff: true });
    expect(await menuItems('Approval')).toEqual([
      'Set earliest approve time',
      'Approve now',
      'Hold indefinitely',
    ]);
  });

  it('offers only the earliest approve time once the project is active', async () => {
    await renderPage('active', { is_staff: true });
    expect(await menuItems('Approval')).toEqual(['Set earliest approve time']);
  });

  it('shows no gears to someone who cannot edit', async () => {
    await renderPage('active', {});
    expect(screen.queryAllByTestId('card-settings')).toHaveLength(0);
  });

  it('tells no list (anyone may join) from an empty one (nobody may)', async () => {
    await renderPage('active', {}, { allowed_domains: null });
    expect(screen.getByText('All domains allowed')).toBeInTheDocument();
  });

  it('says nobody may join when the list is empty', async () => {
    await renderPage('active', {}, { allowed_domains: [] });
    expect(screen.getByText('No domains allowed')).toBeInTheDocument();
  });

  describe('spend profile', () => {
    const PROFILE = [{ from: '2026-01-01', minimum: '250 NHR' }];

    it('lets owners, staff and support set one from its gear', async () => {
      await renderPage('active', { is_staff: true }, { spend_profile: null });
      expect(await menuItems('Spend profile')).toEqual(['Set spend profile']);
    });

    it('is not shown to others while there is none', async () => {
      await renderPage('active', {}, { spend_profile: null });
      expect(screen.queryByText('Spend profile')).not.toBeInTheDocument();
    });

    it('shows the periods to others, with nothing to edit', async () => {
      await renderPage(
        'active',
        {},
        {
          spend_profile: PROFILE,
          site_features: ['award_spend_minimums'],
          award_details: { end_date: '2026-12-31' } as any,
        },
      );
      expect(screen.getByText('Spend profile')).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Edit Spend profile' }),
      ).not.toBeInTheDocument();
    });

    it("warns while the site has not said it enforces the profile's controls", async () => {
      await renderPage(
        'active',
        { is_staff: true },
        { spend_profile: PROFILE, site_features: ['award_spend_maximums'] },
      );
      expect(screen.getByTestId('site-support-warning')).toHaveTextContent(
        'enforces minimums',
      );
      expect(
        screen.getByRole('button', { name: 'Check again' }),
      ).toBeInTheDocument();
    });

    it('says nothing once the site enforces them', async () => {
      await renderPage(
        'active',
        { is_staff: true },
        { spend_profile: PROFILE, site_features: ['award_spend_minimums'] },
      );
      expect(
        screen.queryByTestId('site-support-warning'),
      ).not.toBeInTheDocument();
    });
  });
});

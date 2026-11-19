import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  openportalRemoteProjectsSetSpendProfile,
  type RemoteProject,
} from 'waldur-js-client';

import { formatDate } from '@/core/dateUtils';
import { useNotify } from '@/store/notify';
import { renderWithProviders } from '@/test/harness';

import {
  periodError,
  SetSpendProfileDialog,
  toRequest,
} from './SetSpendProfileDialog';

const AWARD = {
  allocation: '1000 NHR',
  start_date: '2026-01-01',
  end_date: '2026-12-31',
};

const project = (spend_profile, site_features = null): RemoteProject =>
  ({
    uuid: 'rp-1',
    spend_profile,
    site_features,
    site_features_checked_at: null,
    award_details: AWARD,
    last_sent_details: AWARD,
  }) as any;

// Ended, current and upcoming on 15 August 2026.
const PROFILE = [
  { from: '2026-01-01', minimum: '250 NHR', maximum: '250 NHR' },
  { from: '2026-07-01', minimum: '100 NHR' },
  { from: '2026-10-01', maximum: '300 NHR' },
];

const renderDialog = (rp: RemoteProject) =>
  renderWithProviders(
    <SetSpendProfileDialog row={rp} resolve={{ refetch: vi.fn() }} />,
  );

const rows = () => screen.getAllByTestId('spend-period');
const removeButton = (row: HTMLElement) =>
  within(row).getByRole('button', { name: 'Remove period' });

describe('SetSpendProfileDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-15T12:00:00Z'));
    vi.mocked(openportalRemoteProjectsSetSpendProfile).mockResolvedValue({
      data: {},
    } as any);
  });
  afterEach(() => vi.useRealTimers());

  it('keeps begun periods, and leaves ended ones read-only', () => {
    renderDialog(project(PROFILE));
    const [ended, current, upcoming] = rows();

    expect(removeButton(ended)).toBeDisabled();
    expect(removeButton(current)).toBeDisabled();
    expect(removeButton(upcoming)).toBeEnabled();

    // An ended period's amounts are fixed; the current one's are not.
    within(ended)
      .getAllByRole('spinbutton')
      .forEach((input) => expect(input).toBeDisabled());
    within(current)
      .getAllByRole('spinbutton')
      .forEach((input) => expect(input).toBeEnabled());
  });

  it('shows each period until the day before the next, with running totals', () => {
    renderDialog(project(PROFILE));
    const [ended, current, upcoming] = rows();
    expect(within(ended).getByText(/Until/)).toHaveTextContent(
      formatDate('2026-06-30'),
    );
    expect(within(upcoming).getByText(/Until/)).toHaveTextContent(
      formatDate('2026-12-31'),
    );
    expect(within(current).getByTestId('running-totals')).toHaveTextContent(
      'By then: at least 350 NHR, no cap',
    );
    expect(within(upcoming).getByTestId('running-totals')).toHaveTextContent(
      'at most 550 NHR',
    );
  });

  it('starts a new period today', async () => {
    renderDialog(project(PROFILE));
    await userEvent.click(screen.getByRole('button', { name: 'Add period' }));
    const added = rows()[3];
    expect(removeButton(added)).toBeEnabled();
    expect(within(added).getByText(/Until/)).toBeInTheDocument();
  });

  it('saves the profile sorted, with the award units', async () => {
    renderDialog(project(PROFILE));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(openportalRemoteProjectsSetSpendProfile).toHaveBeenCalledWith({
        path: { uuid: 'rp-1' },
        body: { spend_profile: PROFILE },
      }),
    );
  });

  it("shows the API's reason when it refuses", async () => {
    const error = {
      status: 400,
      detail: 'A period that has begun cannot be rewritten.',
    };
    vi.mocked(openportalRemoteProjectsSetSpendProfile).mockRejectedValue(error);
    renderDialog(project(PROFILE));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(useNotify().showErrorResponse).toHaveBeenCalledWith(
        error,
        'Unable to update the spend profile.',
      ),
    );
  });

  it('offers to remove the profile only before any period has begun', () => {
    const { unmount } = renderDialog(project(PROFILE));
    expect(
      screen.queryByRole('button', { name: 'Remove profile' }),
    ).not.toBeInTheDocument();
    unmount();

    renderDialog(project([{ from: '2026-10-01', maximum: '300 NHR' }]));
    expect(
      screen.getByRole('button', { name: 'Remove profile' }),
    ).toBeInTheDocument();
  });

  it('warns while the site has not said it enforces the controls', () => {
    const { unmount } = renderDialog(project(PROFILE, []));
    expect(screen.getByTestId('site-support-warning')).toHaveTextContent(
      'minimums or maximums',
    );
    unmount();

    renderDialog(
      project(PROFILE, ['award_spend_minimums', 'award_spend_maximums']),
    );
    expect(
      screen.queryByTestId('site-support-warning'),
    ).not.toBeInTheDocument();
  });
});

describe('spend profile checks', () => {
  const award = { start: '2026-01-01', end: '2026-12-31' };
  const today = '2026-08-15';
  const check = (period, all = [period]) =>
    periodError(period, all.indexOf(period), all, award, today);

  it('wants new periods from today, within the award, on distinct days', () => {
    expect(check({ from: '2026-08-01', minimum: null, maximum: null })).toBe(
      'A new period cannot start before today.',
    );
    expect(
      check({ from: '2026-08-01', minimum: null, maximum: null, begun: true }),
    ).toBeUndefined();
    expect(check({ from: '2027-01-02', minimum: null, maximum: null })).toBe(
      'The period starts after the award ends.',
    );
    const a = { from: '2026-09-01', minimum: null, maximum: null };
    const b = { from: '2026-09-01', minimum: null, maximum: null };
    expect(check(a, [a, b])).toBe('Another period starts on the same day.');
  });

  it('wants the minimum no more than the maximum', () => {
    expect(check({ from: '2026-09-01', minimum: 300, maximum: 200 })).toBe(
      'The minimum is more than the maximum.',
    );
    expect(
      check({ from: '2026-09-01', minimum: 200, maximum: 300 }),
    ).toBeUndefined();
  });

  it('leaves out empty controls and sorts by date', () => {
    expect(
      toRequest(
        [
          { from: '2026-10-01', minimum: '', maximum: 300 },
          { from: '2026-09-01', minimum: 50, maximum: null },
        ],
        'NHR',
      ),
    ).toEqual([
      { from: '2026-09-01', minimum: '50 NHR' },
      { from: '2026-10-01', maximum: '300 NHR' },
    ]);
  });
});

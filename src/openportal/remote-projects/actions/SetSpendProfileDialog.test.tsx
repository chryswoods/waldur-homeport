import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  openportalRemoteProjectsRefreshSiteFeatures,
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

const project = (
  spend_profile,
  site_features = null,
  site_features_checked_at = null,
): RemoteProject =>
  ({
    uuid: 'rp-1',
    spend_profile,
    site_features,
    site_features_checked_at,
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
    // Asked on opening while the stored answer is missing or old; the site
    // gives the same answer unless a test says otherwise.
    vi.mocked(openportalRemoteProjectsRefreshSiteFeatures).mockImplementation(
      (({ path }) =>
        Promise.resolve({
          data: { uuid: path.uuid, site_features: [] },
        })) as any,
    );
    vi.mocked(openportalRemoteProjectsSetSpendProfile).mockResolvedValue({
      data: {},
    } as any);
  });
  afterEach(() => vi.useRealTimers());

  it('fixes ended periods; one under way can change but keeps its date', () => {
    renderDialog(project(PROFILE));
    const [ended, current, upcoming] = rows();

    expect(removeButton(ended)).toBeDisabled();
    expect(removeButton(current)).toBeEnabled();
    expect(removeButton(upcoming)).toBeEnabled();

    // An ended period's amounts are fixed; the current one's are not.
    within(ended)
      .getAllByRole('spinbutton')
      .forEach((input) => expect(input).toBeDisabled());
    within(current)
      .getAllByRole('spinbutton')
      .forEach((input) => expect(input).toBeEnabled());
  });

  it('leaves a period under way with no controls when an ended one comes before it', async () => {
    renderDialog(project(PROFILE));
    await userEvent.click(removeButton(rows()[1]));

    // Removed, the ended period would run on to the next start date.
    expect(rows()).toHaveLength(3);
    within(rows()[1])
      .getAllByRole('spinbutton')
      .forEach((input) => expect(input).toHaveValue(null));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(openportalRemoteProjectsSetSpendProfile).toHaveBeenCalledWith({
        path: { uuid: 'rp-1' },
        body: {
          spend_profile: [PROFILE[0], { from: '2026-07-01' }, PROFILE[2]],
        },
      }),
    );
  });

  it('removes a period under way when nothing has ended before it', async () => {
    renderDialog(project(PROFILE.slice(1)));
    await userEvent.click(removeButton(rows()[0]));
    expect(rows()).toHaveLength(1);
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

  it('offers to remove the profile until a period has ended', () => {
    const { unmount } = renderDialog(project(PROFILE));
    expect(
      screen.queryByRole('button', { name: 'Remove profile' }),
    ).not.toBeInTheDocument();
    unmount();

    // A period under way, none ended.
    renderDialog(project(PROFILE.slice(1)));
    expect(
      screen.getByRole('button', { name: 'Remove profile' }),
    ).toBeInTheDocument();
  });

  it('warns while the site has not said it enforces the controls', () => {
    // A fresh answer, so the site is not asked again.
    const asked = '2026-08-15T09:00:00Z';
    const { unmount } = renderDialog(project(PROFILE, [], asked));
    expect(screen.getByTestId('site-support-warning')).toHaveTextContent(
      'minimums or maximums',
    );
    unmount();

    renderDialog(
      project(PROFILE, ['award_spend_minimums', 'award_spend_maximums'], asked),
    );
    expect(
      screen.queryByTestId('site-support-warning'),
    ).not.toBeInTheDocument();
  });
});

describe('SetSpendProfileDialog and what the site supports', () => {
  const FRESH = '2026-08-15T09:00:00Z';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-15T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('keeps what has been typed when the site is asked again', async () => {
    vi.mocked(openportalRemoteProjectsRefreshSiteFeatures).mockResolvedValue({
      data: { uuid: 'rp-1', site_features: ['award_spend_maximums'] },
    } as any);
    renderDialog(project([], ['award_spend_maximums'], FRESH));
    await userEvent.click(screen.getByRole('button', { name: 'Add period' }));
    await userEvent.type(
      within(rows()[0]).getAllByRole('spinbutton')[0],
      '1000',
    );
    expect(screen.getByTestId('site-support-warning')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Check again' }));

    await waitFor(() =>
      expect(useNotify().showSuccess).toHaveBeenCalledWith(
        'The site enforces maximums, not minimums.',
      ),
    );
    expect(rows()).toHaveLength(1);
    expect(within(rows()[0]).getAllByRole('spinbutton')[0]).toHaveValue(1000);
    expect(screen.getByTestId('site-support-warning')).toBeInTheDocument();
  });

  it('asks the site on opening when its answer is missing or old', async () => {
    vi.mocked(openportalRemoteProjectsRefreshSiteFeatures).mockResolvedValue({
      data: {
        uuid: 'rp-1',
        site_features: ['award_spend_minimums', 'award_spend_maximums'],
      },
    } as any);
    renderDialog(project(PROFILE, null, null));

    expect(
      screen.getByText('Asking the site what it supports…'),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('The site enforces minimums and maximums.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('site-support-warning'),
    ).not.toBeInTheDocument();
  });

  // A row's message once came apart into an object of characters as soon
  // as one of its fields was typed in, and React refused to render it.
  it('says what is wrong with a period as it is typed, and holds Save', async () => {
    renderDialog(project([], ['award_spend_maximums'], FRESH));
    await userEvent.click(screen.getByRole('button', { name: 'Add period' }));
    const [minimum, maximum] = within(rows()[0]).getAllByRole('spinbutton');
    await userEvent.type(minimum, '1000');
    await userEvent.tab();
    await userEvent.type(maximum, '5');

    expect(
      within(rows()[0]).getByText('The minimum is more than the maximum.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    await userEvent.type(maximum, '000');
    expect(
      within(rows()[0]).queryByText('The minimum is more than the maximum.'),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('trusts an answer from the last day', () => {
    renderDialog(
      project(PROFILE, ['award_spend_minimums', 'award_spend_maximums'], FRESH),
    );
    expect(openportalRemoteProjectsRefreshSiteFeatures).not.toHaveBeenCalled();
    expect(screen.getByTestId('site-support-summary')).toHaveTextContent(
      'The site enforces minimums and maximums.',
    );
  });
});

describe('SetSpendProfileDialog filled from percentages', () => {
  const ASKED = '2026-08-15T09:00:00Z';
  const BOTH = ['award_spend_minimums', 'award_spend_maximums'];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-15T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  const fillRising = async (count: string) => {
    await userEvent.click(
      screen.getByRole('button', { name: 'Fill from percentages' }),
    );
    await userEvent.type(screen.getByLabelText('Number of periods'), count);
    await userEvent.click(screen.getByRole('button', { name: 'Rising' }));
    await userEvent.click(screen.getByRole('button', { name: 'Fill periods' }));
  };

  it('fills the rest of the award with rising shares, ready to adjust', async () => {
    renderDialog(project([], BOTH, ASKED));
    await fillRising('4');

    expect(rows()).toHaveLength(4);
    const minimums = rows().map(
      (row) =>
        (within(row).getAllByRole('spinbutton')[0] as HTMLInputElement).value,
    );
    // Shares of the 1000 NHR award: 10, 20, 30 and 40 per cent.
    expect(minimums).toEqual(['100', '200', '300', '400']);
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('keeps ended periods and takes over the one under way', async () => {
    renderDialog(project(PROFILE.slice(0, 2), BOTH, ASKED));
    await fillRising('2');

    // The ended period, then two new ones, the first starting on the date
    // the period under way did (1 July) instead of cutting it short.
    expect(rows()).toHaveLength(3);
    expect(removeButton(rows()[0])).toBeDisabled();
    expect(within(rows()[1]).getAllByRole('spinbutton')[0]).toHaveValue(333.3);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(
        vi
          .mocked(openportalRemoteProjectsSetSpendProfile)
          .mock.calls[0][0].body.spend_profile.map((entry) => entry.from),
      ).toEqual(['2026-01-01', '2026-07-01', '2026-10-01']),
    );
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

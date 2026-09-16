import { screen } from '@testing-library/react';
import { DateTime, Settings } from 'luxon';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/harness';

import { ProjectProfile } from './ProjectProfile';

vi.mock('./useProjectAwardDetails', () => ({
  useProjectAwardDetails: () => ({ data: undefined }),
}));

// Pulls in the drawer context, which this test has no use for.
vi.mock('./dashboard/ProjectActions', () => ({
  ProjectActions: () => null,
}));

const project: any = {
  uuid: 'p1',
  name: 'RAFFLE: New materials and better thermoelectrics',
  kind: 'private',
  end_date: '2026-08-31',
  effective_end_date: '2026-09-30',
  is_in_grace_period: true,
};

describe('ProjectProfile end date', () => {
  beforeEach(() => {
    // Resolve the instant before installing the clock: computing it inside
    // the callback makes Settings.now call itself.
    const fixedNow = DateTime.fromISO('2026-09-16T09:00:00').toMillis();
    Settings.now = () => fixedNow;
  });

  afterEach(() => {
    Settings.now = () => Date.now();
  });

  // Must agree with GracePeriodWarningBar, which says "13 days remaining" for
  // the same project: access is lost at the start of 30 Sep, so the last
  // usable day is the 29th.
  it('counts to the last usable day, matching the grace period banner', () => {
    renderWithProviders(<ProjectProfile project={project} />);

    expect(
      screen.getByText('(in grace period, 13 days left)'),
    ).toBeInTheDocument();
    expect(screen.queryByText('(in grace period, 14 days left)')).toBeNull();
  });
});

import { render, screen } from '@testing-library/react';
import { useCurrentStateAndParams } from '@uirouter/react';
import { DateTime, Settings } from 'luxon';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useProject } from '@/workspace/hooks';

import { GracePeriodWarningBar } from './GracePeriodWarningBar';

describe('GracePeriodWarningBar', () => {
  beforeEach(() => {
    const fixedNow = DateTime.fromISO('2026-09-16T09:00:00').toMillis();
    Settings.now = () => fixedNow;
    // The bar only renders on a project page.
    vi.mocked(useCurrentStateAndParams).mockReturnValue({
      state: { name: 'project.dashboard' },
    } as any);
    vi.mocked(useProject).mockReturnValue({
      end_date: '2026-08-31',
      effective_end_date: '2026-09-30',
      is_in_grace_period: true,
    } as any);
  });

  afterEach(() => {
    Settings.now = () => Date.now();
  });

  // Resources are deleted at the start of effective_end_date, so 30 Sep is
  // not a day of access: the banner has to name the 29th and count to it,
  // or users plan around a day they do not have.
  it('names the last usable day, not the deletion date', () => {
    render(<GracePeriodWarningBar />);

    expect(
      screen.getByText(/remain active until the end of 29 Sep 2026/),
    ).toBeInTheDocument();
    expect(screen.getByText('13 days remaining')).toBeInTheDocument();
    expect(screen.queryByText(/until the end of 30 Sep 2026/)).toBeNull();
    expect(screen.queryByText('14 days remaining')).toBeNull();
  });

  it('says so plainly on the last usable day', () => {
    const fixedNow = DateTime.fromISO('2026-09-29T09:00:00').toMillis();
    Settings.now = () => fixedNow;

    render(<GracePeriodWarningBar />);

    expect(screen.getByText('Today is the last day')).toBeInTheDocument();
  });
});

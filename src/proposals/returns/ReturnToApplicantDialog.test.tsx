import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateTime, Settings } from 'luxon';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  proposalProposalsExtendReturn,
  proposalProposalsReturnToApplicant,
} from 'waldur-js-client';

import { renderWithProviders } from '@/test/harness';

import { ExtendReturnDialog } from './ExtendReturnDialog';
import { defaultResubmitBy, validateResubmitBy } from './ResubmitByGroup';
import { ReturnToApplicantDialog } from './ReturnToApplicantDialog';

const proposal = { uuid: 'p-1', name: 'Fusion modelling' };

describe('validateResubmitBy', () => {
  it('wants a deadline in the future', () => {
    expect(validateResubmitBy(null)).toBe('This field is required.');
    expect(validateResubmitBy('2000-01-01T00:00:00Z')).toBe(
      'The deadline must be in the future.',
    );
    expect(validateResubmitBy(defaultResubmitBy())).toBeUndefined();
  });

  it('suggests 16:00 UK time two weeks ahead, with its offset', () => {
    const value = defaultResubmitBy();
    expect(value).toMatch(/T16:00:00\.000\+0[01]:00$/);
    const uk = DateTime.fromISO(value).setZone('Europe/London');
    expect(uk.hour).toBe(16);
    expect(
      uk
        .startOf('day')
        .diff(DateTime.now().setZone('Europe/London').startOf('day'), 'days')
        .days,
    ).toBe(14);
  });
});

describe('defaultResubmitBy from the round', () => {
  const now = DateTime.fromISO('2026-11-17T10:00:00Z');

  it("starts at the round's cut-off while that is ahead", () => {
    expect(defaultResubmitBy('2026-12-01T17:00:00.000+00:00', now)).toBe(
      '2026-12-01T17:00:00.000+00:00',
    );
  });

  it('falls back to two weeks ahead once the cut-off has passed', () => {
    expect(defaultResubmitBy('2026-11-01T17:00:00Z', now)).toBe(
      '2026-12-01T16:00:00.000+00:00',
    );
  });

  it('falls back without a round', () => {
    expect(defaultResubmitBy(undefined, now)).toBe(
      '2026-12-01T16:00:00.000+00:00',
    );
  });
});

describe('ReturnToApplicantDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(proposalProposalsReturnToApplicant).mockResolvedValue({
      data: {},
    } as any);
  });

  it('says what returning does', () => {
    renderWithProviders(<ReturnToApplicantDialog resolve={{ proposal }} />);
    expect(
      screen.getByText(/Its open reviews are cancelled/),
    ).toBeInTheDocument();
  });

  it('needs a reason', () => {
    renderWithProviders(<ReturnToApplicantDialog resolve={{ proposal }} />);
    expect(
      screen.getByRole('button', { name: 'Return to applicant' }),
    ).toBeDisabled();
  });

  it("offers the round's cut-off, and says so", async () => {
    const cutoff = DateTime.now().plus({ days: 20 }).startOf('second');
    renderWithProviders(
      <ReturnToApplicantDialog
        resolve={{
          proposal: { ...proposal, round: { cutoff_time: cutoff.toISO() } },
        }}
      />,
    );
    expect(
      screen.getByText(/This is the round's closing date/),
    ).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/^Reason/), 'Fix section 2.');
    await userEvent.click(
      screen.getByRole('button', { name: 'Return to applicant' }),
    );
    await waitFor(() =>
      expect(proposalProposalsReturnToApplicant).toHaveBeenCalledWith({
        path: { uuid: 'p-1' },
        body: { reason: 'Fix section 2.', resubmit_by: cutoff.toISO() },
      }),
    );
  });

  it('returns the proposal with the reason and the deadline', async () => {
    const refetch = vi.fn();
    renderWithProviders(
      <ReturnToApplicantDialog resolve={{ proposal, refetch }} />,
    );
    await userEvent.type(
      screen.getByLabelText(/^Reason/),
      '  Please add a data management plan.  ',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Return to applicant' }),
    );

    await waitFor(() =>
      expect(proposalProposalsReturnToApplicant).toHaveBeenCalledWith({
        path: { uuid: 'p-1' },
        body: {
          reason: 'Please add a data management plan.',
          resubmit_by: expect.stringMatching(
            /^\d{4}-\d\d-\d\dT16:00:00\.000\+0[01]:00$/,
          ),
        },
      }),
    );
    await waitFor(() => expect(refetch).toHaveBeenCalled());
  });
});

describe('ExtendReturnDialog', () => {
  beforeEach(() => vi.clearAllMocks());

  it('starts from the deadline still ahead and moves it', async () => {
    vi.mocked(proposalProposalsExtendReturn).mockResolvedValue({
      data: {},
    } as any);
    const resubmitBy = new Date(Date.now() + 3 * 86_400_000).toISOString();
    renderWithProviders(
      <ExtendReturnDialog resolve={{ proposal, resubmitBy }} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Extend' }));

    await waitFor(() =>
      expect(proposalProposalsExtendReturn).toHaveBeenCalledWith({
        path: { uuid: 'p-1' },
        body: { resubmit_by: resubmitBy },
      }),
    );
  });
});

describe('the deadline in another time zone', () => {
  const defaultZone = Settings.defaultZone;
  const defaultLocale = Settings.defaultLocale;
  beforeEach(() => {
    vi.clearAllMocks();
    Settings.defaultZone = 'Asia/Bangkok';
    Settings.defaultLocale = 'en-GB';
  });
  afterEach(() => {
    Settings.defaultZone = defaultZone;
    Settings.defaultLocale = defaultLocale;
  });

  it("shows the viewer's zone beside the picker, and the UK time", () => {
    renderWithProviders(<ReturnToApplicantDialog resolve={{ proposal }} />);
    expect(screen.getByTestId('deadline-zone')).toHaveTextContent('GMT+7');
    expect(screen.getByText(/That is .*, 16:00 UK time\./)).toBeInTheDocument();
  });
});

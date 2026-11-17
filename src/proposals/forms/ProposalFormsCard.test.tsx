import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { proposalFormsFetch, proposalFormsLink } from 'waldur-js-client';

import { STILL_HERE_MS } from '@/form/NavigationBlocker';
import { useNotify } from '@/store/notify';
import { renderWithProviders } from '@/test/harness';

import { ProposalFormsCard } from './ProposalFormsCard';

const form = (overrides = {}): any => ({
  proposal_uuid: 'p-1',
  flow_key: 'airr-gw',
  flow_name: 'AIRR Gateway',
  available: true,
  can_fill_in: true,
  steps: [
    {
      key: 'compliance',
      label: 'Compliance',
      completed: true,
      submitted_at: '2026-10-01T10:00:00Z',
      in_progress: false,
    },
    {
      key: 'team',
      label: 'Team details',
      completed: false,
      submitted_at: null,
      in_progress: true,
    },
    {
      key: 'ethics',
      label: 'Ethics',
      completed: false,
      submitted_at: null,
      in_progress: false,
    },
  ],
  missing: ['Team details', 'Ethics'],
  responses: [],
  ...overrides,
});

describe('ProposalFormsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window.location, 'assign').mockImplementation(() => {});
  });

  it('offers Edit, Continue or Fill in by how far each form is', () => {
    renderWithProviders(<ProposalFormsCard proposalUuid="p-1" form={form()} />);
    expect(
      screen.getByRole('button', { name: 'Edit Compliance' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Continue Team details' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Fill in Ethics' }),
    ).toBeInTheDocument();
  });

  it('asks for a fresh link and goes to it in this tab', async () => {
    vi.mocked(proposalFormsLink).mockResolvedValue({
      data: {
        step_key: 'ethics',
        step_label: 'Ethics',
        survey_url: 'https://forms.example.org/s/abc?t=1',
      },
    } as any);
    renderWithProviders(<ProposalFormsCard proposalUuid="p-1" form={form()} />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Fill in Ethics' }),
    );

    await waitFor(() =>
      expect(window.location.assign).toHaveBeenCalledWith(
        'https://forms.example.org/s/abc?t=1',
      ),
    );
    expect(proposalFormsLink).toHaveBeenCalledWith({
      path: { uuid: 'p-1' },
      body: { step: 'ethics' },
    });
  });

  describe('before a form opens', () => {
    const link = () =>
      vi.mocked(proposalFormsLink).mockResolvedValue({
        data: { survey_url: 'https://forms.example.org/s/abc' },
      } as any);

    it('keeps the form shut, with the buttons usable, when beforeOpen says no', async () => {
      link();
      const beforeOpen = vi.fn().mockResolvedValue(false);
      renderWithProviders(
        <ProposalFormsCard
          proposalUuid="p-1"
          form={form()}
          beforeOpen={beforeOpen}
        />,
      );
      await userEvent.click(
        screen.getByRole('button', { name: 'Fill in Ethics' }),
      );

      await waitFor(() => expect(beforeOpen).toHaveBeenCalled());
      expect(proposalFormsLink).not.toHaveBeenCalled();
      expect(window.location.assign).not.toHaveBeenCalled();
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: 'Edit Compliance' }),
        ).toBeEnabled(),
      );
    });

    it('says it is saving while beforeOpen runs, then opens the form', async () => {
      link();
      let finish: (ok: boolean) => void;
      const beforeOpen = vi.fn(
        () => new Promise<boolean>((resolve) => (finish = resolve)),
      );
      renderWithProviders(
        <ProposalFormsCard
          proposalUuid="p-1"
          form={form()}
          beforeOpen={beforeOpen}
        />,
      );
      await userEvent.click(
        screen.getByRole('button', { name: 'Fill in Ethics' }),
      );
      expect(
        await screen.findByText('Saving your changes…'),
      ).toBeInTheDocument();

      finish(true);
      await waitFor(() =>
        expect(window.location.assign).toHaveBeenCalledWith(
          'https://forms.example.org/s/abc',
        ),
      );
    });
  });

  it('frees the buttons again when the browser stays on the page', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      vi.mocked(proposalFormsLink).mockResolvedValue({
        data: { survey_url: 'https://forms.example.org/s/abc' },
      } as any);
      renderWithProviders(
        <ProposalFormsCard proposalUuid="p-1" form={form()} />,
      );
      const user = userEvent.setup({
        advanceTimers: vi.advanceTimersByTime,
      });
      await user.click(screen.getByRole('button', { name: 'Fill in Ethics' }));
      await waitFor(() => expect(window.location.assign).toHaveBeenCalled());
      expect(
        screen.getByRole('button', { name: 'Edit Compliance' }),
      ).toBeDisabled();

      // A navigation the browser cancelled leaves the page as it was.
      await vi.advanceTimersByTimeAsync(STILL_HERE_MS);

      expect(
        screen.getByRole('button', { name: 'Edit Compliance' }),
      ).toBeEnabled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("says why a link can't be had", async () => {
    const error = { status: 400, detail: 'Formbricks is unreachable.' };
    vi.mocked(proposalFormsLink).mockRejectedValue(error);
    renderWithProviders(<ProposalFormsCard proposalUuid="p-1" form={form()} />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Fill in Ethics' }),
    );

    await waitFor(() =>
      expect(useNotify().showErrorResponse).toHaveBeenCalledWith(
        error,
        'Unable to open the form.',
      ),
    );
    expect(window.location.assign).not.toHaveBeenCalled();
  });

  it('has no buttons once the forms cannot be filled in', () => {
    renderWithProviders(
      <ProposalFormsCard
        proposalUuid="p-1"
        form={form({ can_fill_in: false })}
      />,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Ethics')).toBeInTheDocument();
  });

  it('says so while forms are unavailable', () => {
    renderWithProviders(
      <ProposalFormsCard
        proposalUuid="p-1"
        form={form({ available: false, can_fill_in: false })}
      />,
    );
    expect(
      screen.getByText('The forms cannot be opened just now'),
    ).toBeInTheDocument();
  });

  it('fetches responses from its menu', async () => {
    vi.mocked(proposalFormsFetch).mockResolvedValue({
      data: { ...form(), fetched: 2 },
    } as any);
    renderWithProviders(<ProposalFormsCard proposalUuid="p-1" form={form()} />);
    await userEvent.click(screen.getByTestId('actions-toggle'));
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Fetch responses' }),
    );

    await waitFor(() =>
      expect(useNotify().showSuccess).toHaveBeenCalledWith(
        'Fetched 2 answers from Formbricks.',
      ),
    );
    expect(proposalFormsFetch).toHaveBeenCalledWith({ path: { uuid: 'p-1' } });
  });
});

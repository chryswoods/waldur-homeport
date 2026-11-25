import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { proposalProposalsCompleteWorkflowStep } from 'waldur-js-client';

import { renderWithProviders } from '@/test/harness';

import { CompleteWorkflowStepDialog } from './CompleteWorkflowStepDialog';

vi.mock('@/proposals/proposal/AwardSummary', () => ({
  AwardSummary: () => <div data-testid="award-summary" />,
}));

const REFUSAL =
  'Cannot complete Allocation decision: awarded amounts are missing for the following offerings: HPC Standard Allocation.';

describe('CompleteWorkflowStepDialog', () => {
  // Completing the allocation decision with an award item that grants no
  // amount is refused with a reason naming the offerings. The manager has to
  // read it to fix the award, so it stays in the dialog.
  it('shows why the backend refused the completion', async () => {
    vi.mocked(proposalProposalsCompleteWorkflowStep).mockImplementation(
      () =>
        Promise.reject({
          detail: [REFUSAL],
          response: { status: 400 },
        }) as any,
    );

    renderWithProviders(
      <CompleteWorkflowStepDialog
        resolve={{
          proposal: { uuid: 'proposal-1' } as any,
          step: {
            uuid: 'step-1',
            step: 'allocation_decision',
            step_name: 'Allocation decision',
          } as any,
        }}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByText('Approved'));
    await user.click(screen.getByRole('button', { name: /Complete step/ }));

    expect(await screen.findByText(REFUSAL)).toBeInTheDocument();
    expect(
      screen.getByText('The step cannot be completed yet'),
    ).toBeInTheDocument();
  });

  describe('at the allocation decision', () => {
    const renderStep = (step: string, decision_held = false) =>
      renderWithProviders(
        <CompleteWorkflowStepDialog
          resolve={{
            proposal: { uuid: 'proposal-1', decision_held } as any,
            step: { uuid: 'step-1', step, step_name: step } as any,
          }}
        />,
      );

    it('shows what completing the step will award', () => {
      renderStep('allocation_decision');
      expect(screen.getByTestId('award-summary')).toBeInTheDocument();
    });

    it('says nothing of an award at other steps, or once decided', () => {
      const { unmount } = renderStep('review');
      expect(screen.queryByTestId('award-summary')).not.toBeInTheDocument();
      unmount();
      renderStep('allocation_decision', true);
      expect(screen.queryByTestId('award-summary')).not.toBeInTheDocument();
    });
  });
});

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { proposalProposalsDestroy } from 'waldur-js-client';

import { useModal } from '@/modal/actions';
import { renderWithProviders } from '@/test/harness';

import { ProposalSidebar } from './ProposalSidebar';

vi.mock('@/form/FloatingSubmitButton', () => ({
  FloatingSubmitButton: ({ label, disabled, errors }) => (
    <>
      <button type="submit" disabled={disabled}>
        {label}
      </button>
      {errors && <p data-testid="submit-errors">{errors.join(' ')}</p>}
    </>
  ),
}));
vi.mock('@/form/TosNotification', () => ({ TosNotification: () => null }));
vi.mock('@/wizard', () => ({ FormSteps: () => null }));
vi.mock('@/proposals/ProposalCostTotal', () => ({
  ProposalCostTotal: () => null,
}));

const renderSidebar = (canSubmitProposal?: boolean, managerName?: string) =>
  renderWithProviders(
    <ProposalSidebar
      steps={[]}
      completedSteps={[]}
      saveAsDraft={vi.fn()}
      editable
      canSubmitProposal={canSubmitProposal}
      managerName={managerName}
    />,
  );

describe('ProposalSidebar', () => {
  it('offers Submit to whoever may submit the proposal', () => {
    renderSidebar(true);
    expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
  });

  it('leaves submitting to a manager for a proposal administrator', () => {
    renderSidebar(false);
    expect(
      screen.queryByRole('button', { name: 'Submit' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('Only a proposal manager can submit the proposal.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Save as draft' }),
    ).toBeInTheDocument();
  });
});

describe('ProposalSidebar on a call with one manager per proposal', () => {
  it('names the manager who can submit it', () => {
    renderSidebar(false, 'Ada Lovelace');
    expect(
      screen.queryByRole('button', { name: 'Submit' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        'Only the proposal manager, Ada Lovelace, can submit this proposal.',
      ),
    ).toBeInTheDocument();
  });
});

describe('ProposalSidebar with forms', () => {
  it('holds Submit back until every form is answered, naming them', () => {
    renderWithProviders(
      <ProposalSidebar
        steps={[]}
        completedSteps={[]}
        saveAsDraft={vi.fn()}
        editable
        canSubmitProposal
        proposalUuid="p-1"
        hasForms
        missingForms={['Team details', 'Ethics']}
      />,
    );
    expect(screen.getByTestId('submit-errors')).toHaveTextContent(
      'Fill in these forms before submitting: Team details, Ethics',
    );
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
  });

  it('lets whoever may submit delete the draft, form answers and all', async () => {
    renderWithProviders(
      <ProposalSidebar
        steps={[]}
        completedSteps={[]}
        saveAsDraft={vi.fn()}
        editable
        canSubmitProposal
        proposalUuid="p-1"
        hasForms
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Delete draft' }));

    expect(useModal().confirm).toHaveBeenCalledWith(
      'Delete draft',
      expect.stringContaining('Your answers to its forms will be deleted too.'),
      expect.objectContaining({ forDeletion: true }),
    );
    await waitFor(() =>
      expect(proposalProposalsDestroy).toHaveBeenCalledWith({
        path: { uuid: 'p-1' },
      }),
    );
  });

  it('offers no delete to a proposal administrator', () => {
    renderWithProviders(
      <ProposalSidebar
        steps={[]}
        completedSteps={[]}
        saveAsDraft={vi.fn()}
        editable
        canSubmitProposal={false}
        proposalUuid="p-1"
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'Delete draft' }),
    ).not.toBeInTheDocument();
  });
});

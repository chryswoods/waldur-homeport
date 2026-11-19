import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  proposalProposalsAddUser,
  proposalProposalsChangeUserRole,
  usersMeRetrieve,
} from 'waldur-js-client';

import { useModal } from '@/modal/actions';
import { useNotify } from '@/store/notify';
import { ActionsMenu } from '@/table/ActionsDropdown';
import { renderWithProviders } from '@/test/harness';
import { useSetUser } from '@/workspace/hooks';

import { TransferManagementAction } from './TransferManagementAction';

const row: any = {
  user_uuid: 'u-2',
  user_full_name: 'Grace Hopper',
  role_name: 'PROPOSAL.ADMIN',
};

const renderAction = (props = {}) => {
  const refetch = vi.fn();
  renderWithProviders(
    <ActionsMenu defaultOpen>
      <TransferManagementAction
        row={row}
        proposal={{ uuid: 'p-1' }}
        viewerIsManager
        refetch={refetch}
        {...props}
      />
    </ActionsMenu>,
  );
  return { refetch };
};

const transfer = () =>
  userEvent.click(
    screen.getByRole('menuitem', { name: 'Transfer management' }),
  );

describe('TransferManagementAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usersMeRetrieve).mockResolvedValue({
      data: { uuid: 'me' },
    } as any);
  });

  it('asks first, telling the manager they stay on as an administrator', async () => {
    vi.mocked(useModal().confirm).mockRejectedValueOnce(undefined);
    renderAction();
    await transfer();

    expect(useModal().confirm).toHaveBeenCalledWith(
      'Transfer management of this proposal?',
      "Grace Hopper will become the proposal's manager and the only person who can submit it. You will stay on the team as an administrator: you can still edit the proposal, but not submit or delete it.",
      expect.objectContaining({ positiveButton: 'Transfer' }),
    );
    expect(proposalProposalsAddUser).not.toHaveBeenCalled();
  });

  it('names the current manager to a call manager or staff', async () => {
    vi.mocked(useModal().confirm).mockRejectedValueOnce(undefined);
    renderAction({ viewerIsManager: false, currentManagerName: 'Ada' });
    await transfer();

    expect(useModal().confirm).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining(
        'The current manager, Ada, will stay on the team as an administrator.',
      ),
      expect.anything(),
    );
  });

  it("changes the member's role to manager, then reloads the team and the viewer", async () => {
    vi.mocked(proposalProposalsChangeUserRole).mockResolvedValue({} as any);
    const { refetch } = renderAction();
    await transfer();

    await waitFor(() =>
      expect(proposalProposalsChangeUserRole).toHaveBeenCalledWith({
        path: { uuid: 'p-1' },
        // No expiration_time: their current expiry is kept.
        body: {
          user: 'u-2',
          previous_role: 'PROPOSAL.ADMIN',
          role: 'PROPOSAL.MANAGER',
        },
      }),
    );
    expect(proposalProposalsAddUser).not.toHaveBeenCalled();
    expect(useNotify().showSuccess).toHaveBeenCalledWith(
      "Grace Hopper is now the proposal's manager.",
    );
    expect(refetch).toHaveBeenCalled();
    await waitFor(() =>
      expect(useSetUser()).toHaveBeenCalledWith(
        expect.objectContaining({ uuid: 'me' }),
      ),
    );
  });

  it('says why when the backend refuses', async () => {
    const error = {
      status: 400,
      non_field_errors: ['User already has role within this scope.'],
    };
    vi.mocked(proposalProposalsChangeUserRole).mockRejectedValue(error);
    const { refetch } = renderAction();
    await transfer();

    await waitFor(() =>
      expect(useNotify().showErrorResponse).toHaveBeenCalledWith(
        error,
        'Unable to transfer management.',
      ),
    );
    expect(refetch).not.toHaveBeenCalled();
  });
});

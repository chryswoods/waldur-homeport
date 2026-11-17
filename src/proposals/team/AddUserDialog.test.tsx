import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { proposalProposalsAddUserByEmail } from 'waldur-js-client';

import { isFeatureVisible } from '@/features/connect';
import { renderWithProviders } from '@/test/harness';

import { AddUserDialog } from './AddUserDialog';

vi.mock('@/features/connect', () => ({ isFeatureVisible: vi.fn() }));
vi.mock('@/project/team/ExpirationTimeGroup', () => ({
  ExpirationTimeGroup: () => null,
}));

const scope: any = { uuid: 'p-1', url: '/api/proposal-proposals/p-1/' };

const renderDialog = () =>
  renderWithProviders(
    <AddUserDialog
      scope={scope}
      roleTypes={['proposal']}
      roles={['PROPOSAL.MEMBER']}
      refetch={vi.fn()}
    />,
  );

describe('AddUserDialog, adding by email', () => {
  beforeEach(() => vi.clearAllMocks());

  it('adds someone by email, names for a new account', async () => {
    vi.mocked(isFeatureVisible).mockReturnValue(true);
    vi.mocked(proposalProposalsAddUserByEmail).mockResolvedValue({
      data: { user_uuid: 'u-1', created: true, expiration_time: null },
    } as any);
    renderDialog();
    await userEvent.click(screen.getByRole('radio', { name: 'Add by email' }));
    await userEvent.type(screen.getByLabelText(/^Email/), 'ada@example.org');
    await userEvent.type(screen.getByLabelText('First name'), 'Ada');
    await userEvent.type(screen.getByLabelText('Last name'), 'Lovelace');
    await userEvent.click(screen.getByRole('button', { name: 'Add role' }));

    await waitFor(() =>
      expect(proposalProposalsAddUserByEmail).toHaveBeenCalledWith({
        path: { uuid: 'p-1' },
        body: {
          email: 'ada@example.org',
          first_name: 'Ada',
          last_name: 'Lovelace',
          role: 'PROPOSAL.MEMBER',
          expiration_time: null,
        },
      }),
    );
  });

  it('is not offered where accounts cannot be created', () => {
    vi.mocked(isFeatureVisible).mockReturnValue(false);
    renderDialog();
    expect(
      screen.queryByRole('radio', { name: 'Add by email' }),
    ).not.toBeInTheDocument();
  });
});

describe('AddUserDialog on a call with one manager per proposal', () => {
  const roleNotice = {
    roleName: 'PROPOSAL.MANAGER',
    message: 'Adding a manager hands the proposal over.',
  };
  const renderWithRole = (
    role: string,
    notice: typeof roleNotice | null = roleNotice,
  ) =>
    renderWithProviders(
      <AddUserDialog
        scope={scope}
        roleTypes={['proposal']}
        roles={[role]}
        refetch={vi.fn()}
        roleNotice={notice ?? undefined}
      />,
    );

  beforeEach(() => vi.mocked(isFeatureVisible).mockReturnValue(false));

  it('warns that adding a manager hands the proposal over', () => {
    renderWithRole('PROPOSAL.MANAGER');
    expect(
      screen.getByText('Adding a manager hands the proposal over.'),
    ).toBeInTheDocument();
  });

  it('says nothing for other roles, or on other calls', () => {
    renderWithRole('PROPOSAL.MEMBER');
    expect(screen.queryByTestId('role-notice')).not.toBeInTheDocument();
  });

  it('says nothing without a notice', () => {
    renderWithRole('PROPOSAL.MANAGER', null);
    expect(screen.queryByTestId('role-notice')).not.toBeInTheDocument();
  });
});

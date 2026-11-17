import { screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ENV } from '@/core/config';
import { PermissionEnum, RoleEnum } from '@/permissions/enums';
import { renderWithProviders } from '@/test/harness';
import * as workspaceHooks from '@/workspace/hooks';

import { TeamSection } from './TeamSection';

const { fetchCount, dropdownProps, usersListProps } = vi.hoisted(() => ({
  fetchCount: { value: 0 },
  dropdownProps: { value: null as any },
  usersListProps: { value: null as any },
}));

// Like useTableQuery, run onFetch from an effect keyed on the callback: an
// unstable callback then fires on every render. The first call is the first
// fetch, later ones are refetches.
vi.mock('@/table/useTable', () => ({
  useTable: (options) => {
    useEffect(() => {
      options.onFetch?.([], 0, fetchCount.value++ === 0);
    }, [options.onFetch]);
    return { fetch: vi.fn() };
  },
}));

vi.mock('./UsersList', () => ({
  UsersList: (props) => {
    usersListProps.value = props;
    return null;
  },
}));
vi.mock('./InvitationsList', () => ({ InvitationsList: () => null }));
vi.mock('./TeamDropdownActions', () => ({
  TeamDropdownActions: (props) => {
    dropdownProps.value = props;
    return null;
  },
}));
vi.mock('@/events/BaseEventsList', () => ({ BaseEventsList: () => null }));
vi.mock('../proposal/create-review/FieldReviewComments', () => ({
  FieldReviewComments: () => null,
}));

const proposal = (state = 'draft') =>
  ({
    uuid: 'proposal-1',
    url: '/api/proposal-proposals/proposal-1/',
    state,
    call_uuid: 'call-1',
    call_managing_organisation_uuid: 'organizer-1',
    created_by_uuid: 'creator',
  }) as any;

const holder = (role_name: string) =>
  ({
    uuid: 'viewer',
    permissions: [
      { role_name, scope_type: 'proposal', scope_uuid: 'proposal-1' },
    ],
  }) as any;

describe('TeamSection', () => {
  beforeEach(() => {
    fetchCount.value = 0;
    dropdownProps.value = null;
    usersListProps.value = null;
    vi.spyOn(ENV, 'roles', 'get').mockReturnValue([
      {
        name: RoleEnum.PROPOSAL_MANAGER,
        content_type: 'proposal',
        is_active: true,
        permissions: [
          PermissionEnum.MANAGE_PROPOSAL,
          PermissionEnum.UPDATE_PROPOSAL,
        ],
      },
      {
        name: RoleEnum.PROPOSAL_ADMIN,
        content_type: 'proposal',
        is_active: true,
        permissions: [PermissionEnum.UPDATE_PROPOSAL],
      },
      {
        name: RoleEnum.PROPOSAL_MEMBER,
        content_type: 'proposal',
        is_active: true,
        permissions: [],
      },
    ] as any);
  });
  afterEach(() => vi.restoreAllMocks());

  const renderSection = (user, props = {}) => {
    vi.mocked(workspaceHooks.useUser).mockReturnValue(user);
    const render = () => (
      <TeamSection
        scope={proposal()}
        roleTypes={['proposal']}
        title={null}
        {...props}
      />
    );
    return { ...renderWithProviders(render()), render };
  };

  it('does not reload anything when the form re-renders it', () => {
    const change = vi.fn();
    const { rerender, render, queryClient } = renderSection(
      holder(RoleEnum.PROPOSAL_MANAGER),
      { change },
    );
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    // Every keystroke in the draft form re-renders the step.
    for (let i = 0; i < 5; i++) {
      rerender(render());
    }
    expect(change).toHaveBeenCalledTimes(1);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('re-reads whether the proposal can be submitted after a team change', () => {
    const { queryClient } = renderSection(holder(RoleEnum.PROPOSAL_MANAGER));
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    dropdownProps.value.refetchUsers();
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['ProposalCanSubmit', 'proposal-1'],
    });
  });

  it('offers a proposal manager every proposal role', () => {
    renderSection(holder(RoleEnum.PROPOSAL_MANAGER));
    expect(dropdownProps.value.roles).toEqual([
      RoleEnum.PROPOSAL_MANAGER,
      RoleEnum.PROPOSAL_ADMIN,
      RoleEnum.PROPOSAL_MEMBER,
    ]);
    expect(dropdownProps.value.canInvite).toBe(true);
    expect(screen.getByText('Invitations')).toBeInTheDocument();
    expect(screen.getByText('Permissions')).toBeInTheDocument();
  });

  it('leaves the team to the managers for an administrator', () => {
    renderSection(holder(RoleEnum.PROPOSAL_ADMIN));
    expect(dropdownProps.value).toBeNull();
    expect(
      screen.getByText('Only a proposal manager can change the proposal team.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Invitations')).not.toBeInTheDocument();
    expect(screen.queryByText('Permissions')).not.toBeInTheDocument();
  });

  describe('transferring management', () => {
    const adminRow = { user_uuid: 'u-2', role_name: RoleEnum.PROPOSAL_ADMIN };
    const managerRow = {
      user_uuid: 'viewer',
      role_name: RoleEnum.PROPOSAL_MANAGER,
    };

    it('offers it on a call with one manager per proposal, for members other than the manager', () => {
      renderSection(holder(RoleEnum.PROPOSAL_MANAGER), {
        singleProposalManager: true,
      });
      const { hasExtraRowActions } = usersListProps.value;
      expect(hasExtraRowActions(adminRow)).toBe(true);
      expect(hasExtraRowActions(managerRow)).toBe(false);
    });

    it('warns in the add and invite dialogs that a new manager takes it over', () => {
      renderSection(holder(RoleEnum.PROPOSAL_MANAGER), {
        singleProposalManager: true,
      });
      expect(dropdownProps.value.roleNotice).toEqual({
        roleName: RoleEnum.PROPOSAL_MANAGER,
        message:
          'This call has one manager per proposal: adding a manager hands the proposal over, and you will become an administrator.',
      });
    });

    it('is not offered on other calls', () => {
      renderSection(holder(RoleEnum.PROPOSAL_MANAGER));
      expect(usersListProps.value.hasExtraRowActions(adminRow)).toBe(false);
      expect(dropdownProps.value.roleNotice).toBeUndefined();
    });

    it('is not offered to an administrator, or once submitted', () => {
      renderSection(holder(RoleEnum.PROPOSAL_ADMIN), {
        singleProposalManager: true,
      });
      expect(usersListProps.value.hasExtraRowActions(adminRow)).toBe(false);

      renderSection(holder(RoleEnum.PROPOSAL_MANAGER), {
        singleProposalManager: true,
        scope: proposal('submitted'),
      });
      expect(usersListProps.value.hasExtraRowActions(adminRow)).toBe(false);
    });
  });
});

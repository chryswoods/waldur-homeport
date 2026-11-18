import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  projectsAddUser,
  projectsChangeUserRole,
  projectsDeleteUser,
  projectsUpdateUser,
} from 'waldur-js-client';

import { useModal } from '@/modal/actions';
import { useNotify } from '@/store/notify';
import { renderWithProviders } from '@/test/harness';
import { openAndSelectOption } from '@/test/select';
import { useProject } from '@/workspace/hooks';

import { EditUserDialog } from './EditUserDialog';
import { projectHasActiveManagerQueryKey } from './onlyOneProjectManager';

// Mock table constants
vi.mock('@/table/constants', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/table/constants')>()),
  DASH_ESCAPE_CODE: '—',
}));

const mockPermission = {
  uuid: 'permission-uuid',
  user_uuid: 'user-uuid',
  user_full_name: 'John Doe',
  user_email: 'john@example.com',
  user_username: 'john',
  user_image: null,
  role_name: 'admin',
  role_description: 'Administrator',
  role_uuid: 'role-uuid',
  expiration_time: '2024-12-31',
  customer_uuid: 'customer-uuid',
  customer_name: 'Test Customer',
  scope_type: 'project' as const,
  scope_uuid: 'project-uuid',
  scope_name: 'Test Project',
  created: '2024-01-01',
  created_by: 'admin',
  created_by_full_name: 'Admin User',
  created_by_username: 'admin',
  is_active: true,
} as const;

const mockResolve = {
  permission: mockPermission,
  refetch: vi.fn(),
};

const renderDialog = (resolve = mockResolve) => {
  return renderWithProviders(<EditUserDialog resolve={resolve} />);
};

describe('EditUserDialog (Project)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useProject).mockReturnValue({
      uuid: 'project-uuid',
      name: 'Test Project',
    } as any);
  });

  it('renders dialog with correct title and user information', () => {
    renderDialog();

    expect(screen.getByText('Edit project member')).toBeInTheDocument();
    expect(screen.getByText('User')).toBeInTheDocument();
    expect(
      screen.getAllByText((content) => content.includes('John Doe')).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText((content) => content.includes('john@example.com')),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText((content) => content.includes('john')).length,
    ).toBeGreaterThan(0);
  });

  it('renders role selection with project roles', () => {
    renderDialog();

    expect(screen.getByText('Role')).toBeInTheDocument();
    expect(screen.getByText('Administrator')).toBeInTheDocument();
  });

  it('renders expiration time field', () => {
    renderDialog();

    expect(screen.getByText('Role expires on')).toBeInTheDocument();
  });

  it('changes the role in one step, keeping the old expiry', async () => {
    const user = userEvent.setup();
    vi.mocked(projectsChangeUserRole).mockResolvedValue({} as any);

    renderDialog();
    await openAndSelectOption(user, 'Role', 'Manager');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mockResolve.refetch).toHaveBeenCalled());
    expect(projectsChangeUserRole).toHaveBeenCalledTimes(1);
    expect(projectsChangeUserRole).toHaveBeenCalledWith({
      path: { uuid: 'project-uuid' },
      // No expiration_time: the backend keeps the old role's.
      body: { user: 'user-uuid', previous_role: 'admin', role: 'manager' },
    });
    expect(projectsDeleteUser).not.toHaveBeenCalled();
    expect(projectsAddUser).not.toHaveBeenCalled();
  });

  it('forgets whether the project has a manager once a role changed', async () => {
    const user = userEvent.setup();
    vi.mocked(projectsChangeUserRole).mockResolvedValue({} as any);

    const { queryClient } = renderDialog();
    // The Lead stepping down: a cached "has a manager" would keep refusing
    // a new one until the page was reloaded.
    queryClient.setQueryData(
      projectHasActiveManagerQueryKey('project-uuid'),
      true,
    );
    await openAndSelectOption(user, 'Role', 'Manager');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(
        queryClient.getQueryState(
          projectHasActiveManagerQueryKey('project-uuid'),
        )?.isInvalidated,
      ).toBe(true),
    );
  });

  it('sends the expiry with a role change when it was changed too', async () => {
    const user = userEvent.setup();
    vi.mocked(projectsChangeUserRole).mockResolvedValue({} as any);

    renderDialog();
    await openAndSelectOption(user, 'Role', 'Manager');
    const dateInput = screen.getByDisplayValue('2024-12-31');
    await user.clear(dateInput);
    await user.type(dateInput, '2025-12-31');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(projectsChangeUserRole).toHaveBeenCalledWith({
        path: { uuid: 'project-uuid' },
        body: {
          user: 'user-uuid',
          previous_role: 'admin',
          role: 'manager',
          expiration_time: '2025-12-31',
        },
      }),
    );
  });

  it('says why a role change was refused, and keeps the dialog open', async () => {
    const user = userEvent.setup();
    const error = {
      status: 400,
      detail: 'Project already has an active project manager.',
    };
    vi.mocked(projectsChangeUserRole).mockRejectedValue(error);

    renderDialog();
    await openAndSelectOption(user, 'Role', 'Manager');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(useNotify().showErrorResponse).toHaveBeenCalledWith(
        error,
        'Unable to update permission.',
      ),
    );
    expect(useModal().closeDialog).not.toHaveBeenCalled();
    expect(mockResolve.refetch).not.toHaveBeenCalled();
    expect(projectsDeleteUser).not.toHaveBeenCalled();
  });

  it('handles submission with only expiration time change', async () => {
    const user = userEvent.setup();
    const mockProjectsUpdateUser = vi.mocked(projectsUpdateUser);
    mockProjectsUpdateUser.mockResolvedValue({} as any);

    renderDialog();

    // Change expiration date
    const dateInput = screen.getByDisplayValue('2024-12-31');
    await user.clear(dateInput);
    await user.type(dateInput, '2025-12-31');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockProjectsUpdateUser).toHaveBeenCalledWith(
        expect.objectContaining({
          path: { uuid: 'project-uuid' },
          body: expect.objectContaining({
            user: 'user-uuid',
            role: 'admin',
            expiration_time: '2025-12-31',
          }),
        }),
      );
      expect(mockResolve.refetch).toHaveBeenCalled();
    });
  });

  it('displays user without email when email is not provided', () => {
    const permissionWithoutEmail = {
      ...mockPermission,
      user_email: null,
    };

    renderDialog({ ...mockResolve, permission: permissionWithoutEmail });

    expect(
      screen.getAllByText((content) => content.includes('John Doe')).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('Username')).toBeInTheDocument();
    expect(screen.queryByText('Email')).not.toBeInTheDocument();
  });

  it('displays dash when user full name is not available', () => {
    const permissionWithoutName = {
      ...mockPermission,
      user_full_name: null,
    };

    renderDialog({ ...mockResolve, permission: permissionWithoutName });

    expect(
      screen.getByText((content) => content.includes('—')),
    ).toBeInTheDocument(); // DASH_ESCAPE_CODE
    expect(screen.getByText('Username')).toBeInTheDocument();
  });

  // A role missing from the cache gets a fresh fallback object each render, and
  // final-form reinitializes when initialValues stop being shallow-equal.
  it('keeps a typed expiration when the dialog re-renders', async () => {
    const user = userEvent.setup();
    const resolve = {
      ...mockResolve,
      permission: { ...mockPermission, role_name: 'retired' } as any,
    };

    const { rerender } = renderDialog(resolve);
    const dateInput = screen.getByDisplayValue('2024-12-31');
    await user.clear(dateInput);
    await user.type(dateInput, '2025-12-31');
    rerender(<EditUserDialog resolve={resolve} />);

    expect(screen.getByDisplayValue('2025-12-31')).toBeInTheDocument();
  });

  it('labels a held role missing from the cache with its description', () => {
    renderDialog({
      ...mockResolve,
      permission: {
        ...mockPermission,
        role_name: 'PROJECT.acme.ADMIN',
        role_description: 'Acme administrator',
      } as any,
    });

    expect(screen.getByText('Acme administrator')).toBeInTheDocument();
  });
});

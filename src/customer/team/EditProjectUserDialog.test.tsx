import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

import { EditProjectUserDialog } from './EditProjectUserDialog';

const renderComponent = (project, customer, refetch = vi.fn()) => {
  return renderWithProviders(
    <EditProjectUserDialog resolve={{ project, customer, refetch }} />,
  );
};

describe('EditProjectUserDialog', () => {
  const mockCustomer = {
    uuid: 'user-uuid',
    full_name: 'John Doe',
  };

  const mockProjectPermission = {
    uuid: 'permission-uuid',
    project_uuid: 'project-uuid',
    role_name: 'admin',
    expiration_time: '2025-01-01',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog correctly and pre-populates values', () => {
    renderComponent(mockProjectPermission, mockCustomer);
    expect(screen.getByText('Edit project member')).toBeInTheDocument();

    // Check role value
    expect(screen.getByText('Administrator')).toBeInTheDocument();

    // Check DateField
    const dateInput = screen.getByPlaceholderText(
      'YYYY-MM-DD',
    ) as HTMLInputElement;
    expect(dateInput.value).toBe('2025-01-01');
  });

  it('calls projectsUpdateUser when role is unchanged', async () => {
    const user = userEvent.setup();
    vi.mocked(projectsUpdateUser).mockResolvedValue({ data: {} } as any);
    const mockRefetch = vi.fn();
    renderComponent(mockProjectPermission, mockCustomer, mockRefetch);

    // Change only expiration date
    const dateInput = screen.getByPlaceholderText('YYYY-MM-DD');
    await user.clear(dateInput);
    await user.type(dateInput, '2025-12-31');

    // Submit
    await user.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(projectsUpdateUser).toHaveBeenCalledWith(
        expect.objectContaining({
          path: { uuid: 'project-uuid' },
          body: expect.objectContaining({
            role: 'admin',
            expiration_time: '2025-12-31',
          }),
        }),
      );
      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  it('changes the role in one step, keeping the old expiry', async () => {
    const user = userEvent.setup();
    vi.mocked(projectsChangeUserRole).mockResolvedValue({ data: {} } as any);
    const mockRefetch = vi.fn();
    renderComponent(mockProjectPermission, mockCustomer, mockRefetch);

    await openAndSelectOption(user, 'Role', 'Manager');
    await user.click(screen.getByText('Save'));

    await waitFor(() => expect(mockRefetch).toHaveBeenCalled());
    expect(projectsChangeUserRole).toHaveBeenCalledTimes(1);
    expect(projectsChangeUserRole).toHaveBeenCalledWith({
      path: { uuid: 'project-uuid' },
      body: { user: 'user-uuid', previous_role: 'admin', role: 'manager' },
    });
    expect(projectsDeleteUser).not.toHaveBeenCalled();
    expect(projectsAddUser).not.toHaveBeenCalled();
  });

  it('sends the expiry with a role change when it was changed too', async () => {
    const user = userEvent.setup();
    vi.mocked(projectsChangeUserRole).mockResolvedValue({ data: {} } as any);
    renderComponent(mockProjectPermission, mockCustomer);

    await openAndSelectOption(user, 'Role', 'Manager');
    const dateInput = screen.getByPlaceholderText('YYYY-MM-DD');
    await user.clear(dateInput);
    await user.type(dateInput, '2025-12-31');
    await user.click(screen.getByText('Save'));

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
    const mockRefetch = vi.fn();
    renderComponent(mockProjectPermission, mockCustomer, mockRefetch);

    await openAndSelectOption(user, 'Role', 'Manager');
    await user.click(screen.getByText('Save'));

    await waitFor(() =>
      expect(useNotify().showErrorResponse).toHaveBeenCalledWith(
        error,
        'Unable to update permission.',
      ),
    );
    expect(useModal().closeDialog).not.toHaveBeenCalled();
    expect(mockRefetch).not.toHaveBeenCalled();
  });
});

import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ENV } from '@/core/config';
import { PermissionEnum } from '@/permissions/enums';
import { useUser } from '@/workspace/hooks';

import { OrganizationLink } from './OrganizationLink';

describe('OrganizationLink', () => {
  beforeEach(() => {
    vi.mocked(useUser).mockReturnValue({
      is_staff: true,
      is_support: false,
      permissions: [],
    } as any);
  });

  it('forwards buttonSize to the link', () => {
    render(
      <OrganizationLink uuid="c1" buttonVariant="text-primary" buttonSize="sm">
        Details
      </OrganizationLink>,
    );

    expect(screen.getByText('Details')).toHaveClass('py-[4px]');
  });

  it('is md when no size is given', () => {
    render(
      <OrganizationLink uuid="c1" buttonVariant="text-primary">
        Details
      </OrganizationLink>,
    );

    expect(screen.getByText('Details')).toHaveClass('py-[8px]');
  });

  // Without permission there is no link to render, but asButton keeps the
  // control on the page as a disabled button that must match its siblings.
  it('keeps the size on the disabled fallback button', () => {
    vi.mocked(useUser).mockReturnValue({
      is_staff: false,
      is_support: false,
      permissions: [],
    } as any);
    render(
      <OrganizationLink
        uuid="c1"
        asButton
        buttonVariant="text-primary"
        buttonSize="sm"
      >
        Details
      </OrganizationLink>,
    );

    const button = screen.getByRole('button', { name: 'Details' });
    expect(button).toBeDisabled();
    expect(button).toHaveClass('py-[4px]');
  });

  describe('a role on one of its calls', () => {
    beforeEach(() => {
      vi.spyOn(ENV, 'roles', 'get').mockReturnValue([
        {
          name: 'CALL.MANAGER',
          content_type: 'call',
          is_active: true,
          permissions: [PermissionEnum.UPDATE_CALL],
        },
        {
          name: 'CALL.REVIEWER',
          content_type: 'call',
          is_active: true,
          permissions: [],
        },
      ] as any);
    });
    afterEach(() => vi.restoreAllMocks());

    const renderFor = (role_name: string) => {
      vi.mocked(useUser).mockReturnValue({
        is_staff: false,
        is_support: false,
        permissions: [
          {
            role_name,
            scope_type: 'call',
            scope_uuid: 'call-1',
            customer_uuid: 'c1',
          },
        ],
      } as any);
      render(
        <OrganizationLink uuid="c1" asButton buttonVariant="text-primary">
          Details
        </OrganizationLink>,
      );
    };

    it("leads a call manager to the organisation's call management", () => {
      renderFor('CALL.MANAGER');
      expect(
        screen.queryByRole('button', { name: 'Details' }),
      ).not.toBeInTheDocument();
      expect(screen.getByText('Details')).toBeInTheDocument();
    });

    it('does not lead a reviewer to a page that would refuse them', () => {
      renderFor('CALL.REVIEWER');
      expect(screen.getByRole('button', { name: 'Details' })).toBeDisabled();
    });
  });
});

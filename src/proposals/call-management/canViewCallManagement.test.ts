import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ENV } from '@/core/config';
import { PermissionEnum } from '@/permissions/enums';
import { type RootState } from '@/store/reducers';

import {
  canViewCallManagement,
  canViewCallManagementPages,
} from './canViewCallManagement';

const ROLES = [
  {
    name: 'CUSTOMER.CALL_ORGANIZER',
    content_type: 'call_organizer',
    is_active: true,
    permissions: [PermissionEnum.UPDATE_CALL],
  },
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
  {
    name: 'CUSTOMER.OWNER',
    content_type: 'customer',
    is_active: true,
    permissions: [],
  },
];

const org = { uuid: 'org-1', call_managing_organization_uuid: 'cmo-1' };

const user = (...permissions: any[]) =>
  ({ is_staff: false, is_support: false, permissions }) as any;

const role = (
  role_name: string,
  scope_type: string,
  scope_uuid: string,
  customer_uuid = 'org-1',
) => ({ role_name, scope_type, scope_uuid, customer_uuid });

describe('canViewCallManagement', () => {
  beforeEach(() => {
    vi.spyOn(ENV, 'roles', 'get').mockReturnValue(ROLES as any);
  });
  afterEach(() => vi.restoreAllMocks());

  it('lets staff and support in', () => {
    expect(canViewCallManagement({ is_staff: true } as any, org)).toBe(true);
    expect(canViewCallManagement({ is_support: true } as any, org)).toBe(true);
  });

  it("lets the organisation's call organisers in", () => {
    expect(
      canViewCallManagement(
        user(role('CUSTOMER.CALL_ORGANIZER', 'call_organizer', 'cmo-1')),
        org,
      ),
    ).toBe(true);
  });

  it('lets a manager of one of its calls in', () => {
    expect(
      canViewCallManagement(user(role('CALL.MANAGER', 'call', 'call-1')), org),
    ).toBe(true);
  });

  it('keeps reviewers, other members and everyone else out', () => {
    expect(
      canViewCallManagement(user(role('CALL.REVIEWER', 'call', 'call-1')), org),
    ).toBe(false);
    expect(
      canViewCallManagement(
        user(role('CUSTOMER.OWNER', 'customer', 'org-1')),
        org,
      ),
    ).toBe(false);
    expect(canViewCallManagement(user(), org)).toBe(false);
  });

  it("does not count managing another organisation's call", () => {
    expect(
      canViewCallManagement(
        user(role('CALL.MANAGER', 'call', 'call-9', 'org-2')),
        org,
      ),
    ).toBe(false);
  });

  it('is closed where the organisation runs no calls', () => {
    expect(
      canViewCallManagement({ is_staff: true } as any, { uuid: 'org-1' }),
    ).toBe(false);
  });

  it('guards the pages from the workspace', () => {
    const state = (u: any) =>
      ({ workspace: { user: u, customer: org } }) as unknown as RootState;
    expect(
      canViewCallManagementPages(
        state(user(role('CALL.MANAGER', 'call', 'call-1'))),
      ),
    ).toBe(true);
    expect(canViewCallManagementPages(state(user()))).toBe(false);
  });
});

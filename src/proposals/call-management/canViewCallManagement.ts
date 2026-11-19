import { User } from 'waldur-js-client';

import { PermissionEnum } from '@/permissions/enums';
import { hasPermission } from '@/permissions/hasPermission';
import { RootState } from '@/store/reducers';
import { getCustomer, getUser } from '@/workspace/selectors';

type CallManagingCustomer = {
  uuid: string;
  call_managing_organization_uuid?: string | null;
};

/**
 * Whether the user runs calls for this organisation, so may see its call
 * management pages. Mirrors the backend's organisation reports permission:
 * staff and support; CALL.UPDATE on the call managing organisation or on
 * the organisation itself (call organisers); or CALL.UPDATE on one of its
 * calls (call managers, who see their own calls). Reviewers and the
 * organisation's other members do not, and the backend refuses them.
 */
export const canViewCallManagement = (
  user: Pick<User, 'is_staff' | 'is_support' | 'permissions'> | undefined,
  customer: CallManagingCustomer | undefined,
): boolean => {
  if (!user || !customer?.call_managing_organization_uuid) {
    return false;
  }
  if (user.is_staff || user.is_support) {
    return true;
  }
  if (
    hasPermission(user, {
      permission: PermissionEnum.UPDATE_CALL,
      customerId: customer.uuid,
      callOrganizerId: customer.call_managing_organization_uuid,
    })
  ) {
    return true;
  }
  // A role on one call names the organisation running it as its customer.
  return Boolean(
    user.permissions?.some(
      (permission) =>
        permission.scope_type === 'call' &&
        permission.customer_uuid === customer.uuid &&
        hasPermission(user, {
          permission: PermissionEnum.UPDATE_CALL,
          scopeId: permission.scope_uuid,
        }),
    ),
  );
};

/** Route guard for the call management pages of the organisation entered. */
export const canViewCallManagementPages = (state: RootState): boolean =>
  canViewCallManagement(getUser(state), getCustomer(state));

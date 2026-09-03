import { useMemo } from 'react';
import { Permission, RoleDetails, userPermissionsList } from 'waldur-js-client';

import { Link } from '@/core/Link';
import { translate } from '@/i18n';
import { ModalDialog } from '@/modal/ModalDialog';
import { GenericPermission } from '@/permissions/types';
import { formatRoleType } from '@/permissions/utils';
import { createFetcher } from '@/table/api';
import { DASH_ESCAPE_CODE } from '@/table/constants';
import Table from '@/table/Table';
import { useTable } from '@/table/useTable';

// The API returns more fields than the generated type captures;
// GenericPermission is the accurate local definition.
type PermissionRow = Permission & GenericPermission;

const SCOPE_STATES: Record<string, { state: string; paramKey: string }> = {
  customer: { state: 'organization.dashboard', paramKey: 'uuid' },
  service_provider: {
    state: 'marketplace-providers.details',
    paramKey: 'customer_uuid',
  },
  project: { state: 'project.dashboard', paramKey: 'uuid' },
  call: { state: 'public-call.details', paramKey: 'call_uuid' },
  call_organizer: { state: 'call-management.dashboard', paramKey: 'uuid' },
  proposal: { state: 'proposals.manage-proposal', paramKey: 'proposal_uuid' },
  offering: { state: 'marketplace-offering-public', paramKey: 'offering_uuid' },
};

const ScopeLink = ({ row }: { row: PermissionRow }) => {
  const name = row.scope_name;
  if (!name) return <>{DASH_ESCAPE_CODE}</>;
  const mapping = row.scope_type ? SCOPE_STATES[row.scope_type] : undefined;
  if (!mapping || !row.scope_uuid) return <>{name}</>;
  return (
    <Link
      state={mapping.state}
      params={{ [mapping.paramKey]: row.scope_uuid }}
      label={name}
    />
  );
};

export const RoleUsersDialog = ({
  resolve: { role },
}: {
  resolve: { role: RoleDetails };
}) => {
  const filter = useMemo(() => ({ role_uuid: role.uuid }), [role.uuid]);

  const tableProps = useTable({
    table: 'RoleUsersDialog',
    fetchData: createFetcher(userPermissionsList),
    filter,
  });

  const columns = [
    {
      title: translate('User'),
      render: ({ row }: { row: PermissionRow }) => {
        const label = row.user_full_name || row.user_name || DASH_ESCAPE_CODE;
        if (!row.user_uuid) return <>{label}</>;
        return (
          <Link
            state="admin-user-user-manage"
            params={{ user_uuid: row.user_uuid }}
            label={label}
          />
        );
      },
    },
    {
      title: translate('Scope type'),
      render: ({ row }: { row: PermissionRow }) =>
        row.scope_type
          ? formatRoleType(row.scope_type as any)
          : DASH_ESCAPE_CODE,
    },
    {
      title: translate('Scope'),
      render: ({ row }: { row: PermissionRow }) => <ScopeLink row={row} />,
    },
    {
      title: translate('Organization'),
      render: ({ row }: { row: PermissionRow }) => {
        if (!row.customer_name) return <>{DASH_ESCAPE_CODE}</>;
        if (!row.customer_uuid) return <>{row.customer_name}</>;
        return (
          <Link
            state="organization.dashboard"
            params={{ uuid: row.customer_uuid }}
            label={row.customer_name}
          />
        );
      },
    },
  ];

  return (
    <ModalDialog
      title={translate('Users with role: {role}', {
        role: role.description || role.name,
      })}
      closeButton
    >
      <Table
        {...tableProps}
        columns={columns}
        verboseName={translate('users')}
        showPageSizeSelector={true}
      />
    </ModalDialog>
  );
};

import { FC, useMemo } from 'react';
import { type ArchivedMembership } from 'waldur-js-client';

import { Badge } from 'waldur-ui';

import { formatDate } from '@/core/dateUtils';
import { Panel } from '@/core/Panel';
import { translate } from '@/i18n';
import Table from '@/table/Table';
import { useTable } from '@/table/useTable';
import { renderFieldOrDash } from '@/table/utils';

import { RecordedName } from './utils';

/**
 * Whether the role was still held when the archive was taken.
 *
 * Tri-state on purpose: some rows were revoked before the archive, and that a
 * person's access was removed is part of the record. A revoked row is shown
 * differently rather than hidden.
 */
export const MembershipStatusBadge: FC<{
  membership: Pick<ArchivedMembership, 'is_active' | 'revoke_reason'>;
}> = ({ membership }) => {
  if (membership.is_active === false) {
    return (
      <Badge variant="secondary" size="sm" shape="pill" tone="outline">
        {translate('Revoked')}
      </Badge>
    );
  }
  if (membership.is_active) {
    return (
      <Badge variant="info" size="sm" shape="pill" tone="light">
        {translate('Held at archiving')}
      </Badge>
    );
  }
  return <>{renderFieldOrDash(null)}</>;
};

/**
 * Who held which role on an archived call or proposal.
 *
 * A historical record and nothing more: the underlying role assignments were
 * deleted during the upgrade, so none of this confers access now. There are
 * deliberately no revoke or edit affordances — there is nothing left to revoke.
 */
export const ArchivedMembershipsTable: FC<{
  memberships: ArchivedMembership[];
}> = ({ memberships }) => {
  const rows = memberships ?? [];
  const tableProps = useTable({
    table: `archived-memberships-${rows.map((m) => m.uuid).join('-') || 'empty'}`,
    fetchData: () => Promise.resolve({ rows, resultCount: rows.length }),
  });

  const columns = useMemo(
    () => [
      {
        title: translate('Person'),
        render: ({ row }: { row: ArchivedMembership }) => (
          <RecordedName
            name={row.user_full_name}
            username={row.user_username}
          />
        ),
      },
      {
        title: translate('Role'),
        render: ({ row }: { row: ArchivedMembership }) => (
          <>{renderFieldOrDash(row.role_description || row.role_name)}</>
        ),
      },
      {
        title: translate('Status'),
        render: ({ row }: { row: ArchivedMembership }) => (
          <MembershipStatusBadge membership={row} />
        ),
      },
      {
        title: translate('Granted by'),
        render: ({ row }: { row: ArchivedMembership }) => (
          <>{renderFieldOrDash(row.granted_by_username)}</>
        ),
      },
      {
        title: translate('Expiry'),
        render: ({ row }: { row: ArchivedMembership }) => (
          <>
            {row.expiration_time
              ? formatDate(row.expiration_time)
              : renderFieldOrDash(null)}
          </>
        ),
      },
    ],
    [],
  );

  return (
    <Panel
      title={translate('Team at archiving')}
      subtitle={translate(
        'A record of who held which role. The underlying roles were removed during the upgrade and grant no access now.',
      )}
      cardBordered
    >
      <Table
        {...tableProps}
        columns={columns}
        verboseName={translate('members')}
        hideTitle
        hasActionBar={false}
        placeholderHasRetry={false}
      />
    </Panel>
  );
};

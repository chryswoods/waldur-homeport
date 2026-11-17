import { CrownIcon } from '@phosphor-icons/react';
import { useQueryClient } from '@tanstack/react-query';
import { FC } from 'react';

import { translate } from '@/i18n';
import { useModal } from '@/modal/actions';
import { RoleEnum } from '@/permissions/enums';
import { GenericPermission } from '@/permissions/types';
import { Proposal } from '@/proposals/types';
import { ActionItem } from '@/resource/actions/ActionItem';
import { useNotify } from '@/store/notify';
import { getCurrentUser } from '@/user/UsersService';
import { useSetUser } from '@/workspace/hooks';

import { addTeamUser } from './teamApi';

interface TransferManagementActionProps {
  row: GenericPermission;
  proposal: Pick<Proposal, 'uuid'>;
  /** Whether the viewer is the manager handing the proposal over. */
  viewerIsManager: boolean;
  currentManagerName?: string;
  /** Reloads the team after the handover. */
  refetch(): void;
}

const memberName = (row: GenericPermission) =>
  row.user_full_name || row.user_username || row.user_email;

/**
 * Hands a proposal over to a team member, on a call with one manager per
 * proposal: granting them the manager role makes them its owner, and the
 * backend keeps the previous manager on the team as an administrator.
 */
export const TransferManagementAction: FC<TransferManagementActionProps> = ({
  row,
  proposal,
  viewerIsManager,
  currentManagerName,
  refetch,
}) => {
  const { confirm } = useModal();
  const { showSuccess, showErrorResponse } = useNotify();
  const queryClient = useQueryClient();
  const setCurrentUser = useSetUser();
  const name = memberName(row);

  const transfer = async () => {
    const becomes = translate(
      "{name} will become the proposal's manager and the only person who can submit it.",
      { name },
    );
    const previous = viewerIsManager
      ? translate(
          'You will stay on the team as an administrator: you can still edit the proposal, but not submit or delete it.',
        )
      : currentManagerName
        ? translate(
            'The current manager, {current}, will stay on the team as an administrator.',
            { current: currentManagerName },
          )
        : translate(
            'The current manager will stay on the team as an administrator.',
          );
    try {
      await confirm(
        translate('Transfer management of this proposal?'),
        `${becomes} ${previous}`,
        {
          positiveButton: translate('Transfer'),
          negativeButton: translate('Cancel'),
        },
      );
    } catch {
      return;
    }
    try {
      await addTeamUser('proposal', proposal.uuid, {
        user: row.user_uuid,
        role: RoleEnum.PROPOSAL_MANAGER,
      });
    } catch (error) {
      showErrorResponse(error, translate('Unable to transfer management.'));
      return;
    }
    showSuccess(translate("{name} is now the proposal's manager.", { name }));
    refetch();
    // Its owner has changed, and the viewer's own role may have: who may
    // submit follows both, without a reload.
    queryClient.invalidateQueries({ queryKey: ['Proposal', proposal.uuid] });
    try {
      setCurrentUser(await getCurrentUser());
    } catch {
      // The page still reflects the handover after a reload.
    }
  };

  return (
    <ActionItem
      title={translate('Transfer management')}
      action={transfer}
      iconNode={<CrownIcon weight="bold" />}
    />
  );
};

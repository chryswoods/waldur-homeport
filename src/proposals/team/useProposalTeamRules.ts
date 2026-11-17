import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { proposalProposalsListUsersList } from 'waldur-js-client';

import { translate } from '@/i18n';
import { RoleEnum } from '@/permissions/enums';
import { GenericPermission } from '@/permissions/types';
import { Proposal } from '@/proposals/types';
import { invalidateProposalCanSubmit } from '@/proposals/useProposalCanSubmit';
import { useUser } from '@/workspace/hooks';

import {
  canInviteToProposal,
  canManageProposalTeam,
  canOverseeProposal,
  canRevokeAnyProposalRole,
  canRevokeProposalRow,
  canTransferProposalTo,
  getGrantableProposalRoleNames,
  getRemoveDisabledReason,
  isOnProposalTeam,
  isProposalManager,
} from './teamRules';

const proposalManagersKey = (proposalUuid: string) => [
  'ProposalManagers',
  proposalUuid,
];

/**
 * The proposal's active managers, up to two: enough to tell whether removing
 * one would leave it without any, and to name the one a call with a single
 * manager per proposal has.
 */
const useProposalManagers = (proposal: Proposal | undefined) =>
  useQuery({
    queryKey: proposalManagersKey(proposal?.uuid),
    queryFn: () =>
      proposalProposalsListUsersList({
        path: { uuid: proposal.uuid },
        query: { role: [RoleEnum.PROPOSAL_MANAGER], page_size: 2 },
      }).then((response) => response.data),
    enabled: Boolean(proposal?.uuid),
    refetchOnWindowFocus: false,
  }).data;

/**
 * Everything a proposal team panel needs to know about the viewer's rights on
 * the team, in one place for the draft form and the proposal detail. Returns
 * undefined for a team that is not a proposal's.
 *
 * `singleManager`: the proposal's call has one manager per proposal, so
 * granting the manager role hands the proposal over.
 */
export const useProposalTeamRules = (
  proposal: Proposal | undefined,
  singleManager = false,
) => {
  const user = useUser();
  const queryClient = useQueryClient();
  const managers = useProposalManagers(proposal);
  const managerCount = managers?.length;

  const proposalUuid = proposal?.uuid;
  // Called after a member was added or removed: whether the proposal may be
  // submitted (it needs a manager) and who is its last manager may change.
  const onTeamChange = useCallback(() => {
    if (!proposalUuid) return;
    invalidateProposalCanSubmit(queryClient, proposalUuid);
    queryClient.invalidateQueries({
      queryKey: proposalManagersKey(proposalUuid),
    });
  }, [queryClient, proposalUuid]);

  const canRemoveRow = useCallback(
    (row: GenericPermission) => canRevokeProposalRow(user, proposal, row),
    [user, proposal],
  );
  const canTransferTo = useCallback(
    (row: GenericPermission) =>
      singleManager && canTransferProposalTo(user, proposal, row),
    [singleManager, user, proposal],
  );
  const getRemoveReason = useCallback(
    (row: GenericPermission) => getRemoveDisabledReason(row, managerCount),
    [managerCount],
  );

  return useMemo(() => {
    if (!proposal) {
      return undefined;
    }
    const grantableRoles = getGrantableProposalRoleNames(user, proposal);
    const canChangeTeam = grantableRoles.length > 0;
    const teamNote =
      canChangeTeam || !isOnProposalTeam(user, proposal)
        ? null
        : proposal.state === 'draft'
          ? translate('Only a proposal manager can change the proposal team.')
          : translate(
              'The team is fixed after submission; the call manager can change it.',
            );
    const viewerIsManager = isProposalManager(user, proposal);
    return {
      grantableRoles,
      /** Add member and invite: offered when any role may be granted. */
      dropdown: canChangeTeam
        ? {
            roles: grantableRoles,
            canAddUser: true,
            canInvite: canInviteToProposal(user, proposal),
            // Adding a manager there hands the proposal over too.
            roleNotice: singleManager
              ? {
                  roleName: RoleEnum.PROPOSAL_MANAGER,
                  message: viewerIsManager
                    ? translate(
                        'This call has one manager per proposal: adding a manager hands the proposal over, and you will become an administrator.',
                      )
                    : translate(
                        'This call has one manager per proposal: adding a manager hands the proposal over, and the current manager will become an administrator.',
                      ),
                }
              : undefined,
          }
        : null,
      /** Invitations and the change log: those who manage the team. */
      canManageTeam: canManageProposalTeam(user, proposal),
      canOversee: canOverseeProposal(user, proposal),
      readOnly: !canRevokeAnyProposalRole(user, proposal),
      canRemoveRow,
      getRemoveDisabledReason: getRemoveReason,
      /** Hand the proposal over to this row's member. */
      canTransferTo,
      viewerIsManager,
      currentManagerName: managers?.[0]?.user_full_name,
      teamNote,
      onTeamChange,
    };
  }, [
    user,
    proposal,
    singleManager,
    managers,
    canRemoveRow,
    canTransferTo,
    getRemoveReason,
    onTeamChange,
  ]);
};

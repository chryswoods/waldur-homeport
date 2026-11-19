import {
  proposalProposalsAddUser,
  proposalProposalsChangeUserRole,
  proposalProposalsDeleteUser,
  proposalProtectedCallsAddUser,
  proposalProtectedCallsChangeUserRole,
  proposalProtectedCallsDeleteUser,
  UserRoleChangeRequest,
} from 'waldur-js-client';

/** The two scopes whose team this panel manages. */
export type TeamScopeType = 'proposal' | 'call';

/** The scope type of a team panel from the role types it offers. */
export const getTeamScopeType = (roleTypes?: string[]): TeamScopeType =>
  roleTypes?.includes('proposal') ? 'proposal' : 'call';

// Through the generated client rather than a bare fetch: its error carries
// the response body (e.g. "A proposal must keep at least one proposal
// manager"), so the toast can say why a change was refused.

export const addTeamUser = (
  scopeType: TeamScopeType,
  scopeUuid: string,
  body: { user: string; role: string; expiration_time?: string | null },
) =>
  scopeType === 'proposal'
    ? proposalProposalsAddUser({ path: { uuid: scopeUuid }, body })
    : proposalProtectedCallsAddUser({ path: { uuid: scopeUuid }, body });

export const deleteTeamUser = (
  scopeType: TeamScopeType,
  scopeUuid: string,
  body: { user: string; role: string },
) =>
  scopeType === 'proposal'
    ? proposalProposalsDeleteUser({ path: { uuid: scopeUuid }, body })
    : proposalProtectedCallsDeleteUser({ path: { uuid: scopeUuid }, body });

/**
 * Gives a team member a different role in one step: their old role is
 * swapped for the new one, or nothing changes. Never add the new role
 * instead: where a user may hold one role per scope that is refused, and
 * elsewhere it leaves them with both. Leave out expiration_time to keep the
 * old role's expiry.
 */
export const changeTeamUserRole = (
  scopeType: TeamScopeType,
  scopeUuid: string,
  body: UserRoleChangeRequest,
) =>
  scopeType === 'proposal'
    ? proposalProposalsChangeUserRole({ path: { uuid: scopeUuid }, body })
    : proposalProtectedCallsChangeUserRole({ path: { uuid: scopeUuid }, body });

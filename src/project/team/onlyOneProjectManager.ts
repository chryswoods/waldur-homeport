import { projectsListUsersList } from 'waldur-js-client';

import { ENV } from '@/core/config';
import { translate } from '@/i18n';
import { RoleEnum } from '@/permissions/enums';
import { Role } from '@/permissions/types';

export const isOnlyOneProjectManagerEnabled = (): boolean =>
  Boolean(ENV.plugins.WALDUR_CORE?.ONLY_ONE_PROJECT_MANAGER);

/**
 * The roles that count as the project's manager: PROJECT.MANAGER and any the
 * site names in PROJECT_MANAGER_ROLES (e.g. a custom Project Lead).
 */
export const projectManagerRoleNames = (): string[] => [
  ...new Set([
    RoleEnum.PROJECT_MANAGER,
    ...(ENV.plugins.WALDUR_CORE?.PROJECT_MANAGER_ROLES ?? []),
  ]),
];

const roleLabel = (name: string): string => {
  const role = ENV.roles.find((r) => r.name === name);
  return role?.description || role?.name || name;
};

/** What the manager is called: with one custom role configured, that
 * role's name (e.g. "Project Lead"), else PROJECT.MANAGER's. */
const getProjectManagerRoleLabel = (): string => {
  const custom = projectManagerRoleNames().filter(
    (name) => name !== RoleEnum.PROJECT_MANAGER,
  );
  return roleLabel(custom.length === 1 ? custom[0] : RoleEnum.PROJECT_MANAGER);
};

export const getOnlyOneProjectManagerTooltip = (): string =>
  translate(
    'This project already has an active {role}. Only one {role} per project is allowed.',
    { role: getProjectManagerRoleLabel() },
  );

export const isProjectManagerRole = (
  role?: Pick<Role, 'name'> | null,
): boolean =>
  Boolean(role?.name) && projectManagerRoleNames().includes(role.name);

export const isProjectManagerSelectionBlocked = (
  hasActiveManager: boolean | undefined,
  role?: Pick<Role, 'name'> | null,
  currentRoleName?: string,
): boolean => {
  if (!isOnlyOneProjectManagerEnabled() || !hasActiveManager) {
    return false;
  }
  if (!isProjectManagerRole(role)) {
    return false;
  }
  // Already the manager: moving between manager roles keeps one.
  if (currentRoleName && projectManagerRoleNames().includes(currentRoleName)) {
    return false;
  }
  return true;
};

export const projectHasActiveManager = async (
  projectUuid: string,
): Promise<boolean> => {
  const response = await projectsListUsersList({
    path: { uuid: projectUuid },
    query: {
      role: projectManagerRoleNames(),
      page_size: 1,
      field: ['role_name'],
    },
  });
  return (response.data?.length ?? 0) > 0;
};

export const projectHasActiveManagerQueryKey = (projectUuid?: string) =>
  ['project-has-active-manager', projectUuid] as const;

/**
 * Every project's cached manager check, to drop after a team change: a role
 * changed, granted or revoked may add or remove a project's manager, and a
 * stale answer would keep refusing (or allowing) a new one until a reload.
 */
export const PROJECT_MANAGER_QUERIES = [
  { queryKey: ['project-has-active-manager'] },
];

export const isInvitationRowProjectManagerBlocked = (
  row: {
    role_project?: {
      role?: Pick<Role, 'name'> | null;
      project?: { uuid?: string } | null;
    } | null;
  },
  managerMap: Map<string, boolean>,
  fallbackProjectUuid?: string,
): boolean => {
  if (!isOnlyOneProjectManagerEnabled()) {
    return false;
  }
  if (!isProjectManagerRole(row?.role_project?.role)) {
    return false;
  }
  const projectUuid = row.role_project?.project?.uuid ?? fallbackProjectUuid;
  if (!projectUuid) {
    return false;
  }
  return managerMap.get(projectUuid) === true;
};

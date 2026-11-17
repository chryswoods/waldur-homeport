import { afterEach, describe, expect, it, vi } from 'vitest';
import { projectsListUsersList } from 'waldur-js-client';

import { ENV } from '@/core/config';
import { RoleEnum } from '@/permissions/enums';

import {
  getOnlyOneProjectManagerTooltip,
  isOnlyOneProjectManagerEnabled,
  isProjectManagerRole,
  isProjectManagerSelectionBlocked,
  projectHasActiveManager,
  projectManagerRoleNames,
} from './onlyOneProjectManager';

describe('onlyOneProjectManager', () => {
  it('reads ONLY_ONE_PROJECT_MANAGER from ENV', () => {
    ENV.plugins.WALDUR_CORE.ONLY_ONE_PROJECT_MANAGER = true;
    expect(isOnlyOneProjectManagerEnabled()).toBe(true);
    ENV.plugins.WALDUR_CORE.ONLY_ONE_PROJECT_MANAGER = false;
    expect(isOnlyOneProjectManagerEnabled()).toBe(false);
  });

  it('detects project manager role by name', () => {
    expect(isProjectManagerRole({ name: RoleEnum.PROJECT_MANAGER })).toBe(true);
    expect(isProjectManagerRole({ name: RoleEnum.PROJECT_MEMBER })).toBe(false);
  });

  it('blocks new PM selection when project already has one', () => {
    ENV.plugins.WALDUR_CORE.ONLY_ONE_PROJECT_MANAGER = true;
    expect(
      isProjectManagerSelectionBlocked(true, {
        name: RoleEnum.PROJECT_MANAGER,
      }),
    ).toBe(true);
    expect(
      isProjectManagerSelectionBlocked(true, { name: RoleEnum.PROJECT_MEMBER }),
    ).toBe(false);
    expect(
      isProjectManagerSelectionBlocked(
        true,
        { name: RoleEnum.PROJECT_MANAGER },
        RoleEnum.PROJECT_MANAGER,
      ),
    ).toBe(false);
    expect(
      isProjectManagerSelectionBlocked(false, {
        name: RoleEnum.PROJECT_MANAGER,
      }),
    ).toBe(false);
  });

  it('uses deployment role label in tooltip', () => {
    ENV.roles = [
      {
        name: RoleEnum.PROJECT_MANAGER,
        description: 'PI',
        uuid: 'pm-uuid',
        content_type: 'project',
        is_active: true,
      } as any,
    ];
    expect(getOnlyOneProjectManagerTooltip()).toContain('PI');
  });

  describe('with a site role counted as the manager (PROJECT_MANAGER_ROLES)', () => {
    const LEAD = 'PROJECT.LEAD';
    const lead = {
      name: LEAD,
      description: 'Project Lead',
      uuid: 'lead-uuid',
      content_type: 'project',
      is_active: true,
    } as any;

    afterEach(() => {
      ENV.plugins.WALDUR_CORE.PROJECT_MANAGER_ROLES = undefined;
      ENV.plugins.WALDUR_CORE.ONLY_ONE_PROJECT_MANAGER = false;
    });

    it('counts PROJECT.MANAGER and the site roles, once each', () => {
      ENV.plugins.WALDUR_CORE.PROJECT_MANAGER_ROLES = [
        LEAD,
        RoleEnum.PROJECT_MANAGER,
      ];
      expect(projectManagerRoleNames()).toEqual([
        RoleEnum.PROJECT_MANAGER,
        LEAD,
      ]);
      expect(isProjectManagerRole({ name: LEAD })).toBe(true);
      expect(isProjectManagerRole({ name: RoleEnum.PROJECT_MEMBER })).toBe(
        false,
      );
    });

    it('blocks both Lead and Project manager once the project has a Lead', () => {
      ENV.plugins.WALDUR_CORE.ONLY_ONE_PROJECT_MANAGER = true;
      ENV.plugins.WALDUR_CORE.PROJECT_MANAGER_ROLES = [LEAD];
      expect(isProjectManagerSelectionBlocked(true, { name: LEAD })).toBe(true);
      expect(
        isProjectManagerSelectionBlocked(true, {
          name: RoleEnum.PROJECT_MANAGER,
        }),
      ).toBe(true);
      // The manager themselves may move between the manager roles.
      expect(isProjectManagerSelectionBlocked(true, { name: LEAD }, LEAD)).toBe(
        false,
      );
    });

    it('asks the backend for every manager role', async () => {
      ENV.plugins.WALDUR_CORE.PROJECT_MANAGER_ROLES = [LEAD];
      vi.mocked(projectsListUsersList).mockResolvedValue({
        data: [{ role_name: LEAD }],
      } as any);

      await expect(projectHasActiveManager('project-1')).resolves.toBe(true);
      expect(projectsListUsersList).toHaveBeenCalledWith({
        path: { uuid: 'project-1' },
        query: expect.objectContaining({
          role: [RoleEnum.PROJECT_MANAGER, LEAD],
        }),
      });
    });

    it('names the Lead in the tooltip', () => {
      ENV.plugins.WALDUR_CORE.PROJECT_MANAGER_ROLES = [LEAD];
      ENV.roles = [lead];
      expect(getOnlyOneProjectManagerTooltip()).toBe(
        'This project already has an active Project Lead. Only one Project Lead per project is allowed.',
      );
    });

    it('changes nothing while the setting is empty', () => {
      ENV.plugins.WALDUR_CORE.ONLY_ONE_PROJECT_MANAGER = true;
      ENV.plugins.WALDUR_CORE.PROJECT_MANAGER_ROLES = [];
      expect(projectManagerRoleNames()).toEqual([RoleEnum.PROJECT_MANAGER]);
      expect(isProjectManagerRole({ name: LEAD })).toBe(false);
      expect(isProjectManagerSelectionBlocked(true, { name: LEAD })).toBe(
        false,
      );
    });
  });
});

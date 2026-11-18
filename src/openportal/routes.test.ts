import { describe, expect, it } from 'vitest';

import { type RootState } from '@/store/reducers';

import { canViewOrganisationUsage, canViewProjectUsage } from './routes';

const state = (user: any): RootState =>
  ({
    workspace: {
      user,
      customer: { uuid: 'org-1' },
      project: { uuid: 'proj-1' },
    },
  }) as unknown as RootState;

const role = (scope_type: string, scope_uuid: string, role_name: string) => ({
  is_staff: false,
  is_support: false,
  permissions: [{ role_name, scope_type, scope_uuid }],
});

describe('canViewProjectUsage', () => {
  it("lets the project's own team see its usage", () => {
    expect(
      canViewProjectUsage(state(role('project', 'proj-1', 'PROJECT.MEMBER'))),
    ).toBe(true);
  });

  it('lets staff and support see it', () => {
    expect(canViewProjectUsage(state({ is_staff: true }))).toBe(true);
    expect(canViewProjectUsage(state({ is_support: true }))).toBe(true);
  });

  it("lets the organisation's owners see it", () => {
    expect(
      canViewProjectUsage(state(role('customer', 'org-1', 'CUSTOMER.OWNER'))),
    ).toBe(true);
  });

  it('hides it from someone with no role on the project', () => {
    expect(
      canViewProjectUsage(state(role('project', 'proj-2', 'PROJECT.MEMBER'))),
    ).toBe(false);
  });
});

describe('canViewOrganisationUsage', () => {
  it("lets the organisation's owners and viewers see it", () => {
    expect(
      canViewOrganisationUsage(
        state(role('customer', 'org-1', 'CUSTOMER.OWNER')),
      ),
    ).toBe(true);
    expect(
      canViewOrganisationUsage(
        state(role('customer', 'org-1', 'CUSTOMER.READER')),
      ),
    ).toBe(true);
  });

  it('lets staff and support see it', () => {
    expect(canViewOrganisationUsage(state({ is_staff: true }))).toBe(true);
    expect(canViewOrganisationUsage(state({ is_support: true }))).toBe(true);
  });

  it("hides it from another organisation's viewers and from project members", () => {
    expect(
      canViewOrganisationUsage(
        state(role('customer', 'org-2', 'CUSTOMER.READER')),
      ),
    ).toBe(false);
    expect(
      canViewOrganisationUsage(
        state(role('project', 'proj-1', 'PROJECT.MEMBER')),
      ),
    ).toBe(false);
  });
});

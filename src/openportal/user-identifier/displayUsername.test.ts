import { beforeEach, describe, expect, it, vi } from 'vitest';

import { isFeatureVisible } from '@/features/connect';

import { getDisplayUsername, usesOpenPortalUsername } from './displayUsername';

vi.mock('@/features/connect');

const setFlag = (on: boolean) =>
  vi
    .mocked(isFeatureVisible)
    .mockImplementation(
      (flag: any) => on && flag === 'user.show_openportal_identifier',
    );

describe('getDisplayUsername', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the Waldur username when the flag is off', () => {
    setFlag(false);
    expect(getDisplayUsername({ username: 'a@b.com', slug: 'chris' })).toBe(
      'a@b.com',
    );
  });

  it('shows the slug when the flag is on', () => {
    setFlag(true);
    expect(getDisplayUsername({ username: 'a@b.com', slug: 'chris' })).toBe(
      'chris',
    );
  });

  // A null slug means no OpenPortal username has been chosen. Falling back to
  // user.username would put an email under a "Username" heading, which is the
  // confusion this exists to remove.
  it('shows nothing rather than falling back when no slug is set', () => {
    setFlag(true);
    expect(
      getDisplayUsername({ username: 'a@b.com', slug: null }),
    ).toBeUndefined();
    expect(
      getDisplayUsername({ username: 'a@b.com', slug: '' }),
    ).toBeUndefined();
  });

  it('reports whether the deployment uses OpenPortal usernames', () => {
    setFlag(true);
    expect(usesOpenPortalUsername()).toBe(true);
    setFlag(false);
    expect(usesOpenPortalUsername()).toBe(false);
  });
});

import { afterEach, describe, expect, it } from 'vitest';

import { ENV } from '@/core/config';

import { getGettingStartedUrl } from './utils';

const GUIDE = 'https://docs.isambard.ac.uk/user-documentation/getting_started/';

describe('getGettingStartedUrl', () => {
  const core = ENV.plugins.WALDUR_CORE as any;
  const original = {
    openportal: ENV.plugins.WALDUR_OPENPORTAL,
    hero: core.HERO_LINK_URL,
  };
  afterEach(() => {
    (ENV.plugins as any).WALDUR_OPENPORTAL = original.openportal;
    core.HERO_LINK_URL = original.hero;
  });

  it("leads to the site's guide on an Open Portal site", () => {
    (ENV.plugins as any).WALDUR_OPENPORTAL = { ENABLED: true };
    core.HERO_LINK_URL = GUIDE;
    expect(getGettingStartedUrl()).toBe(GUIDE);
  });

  it('keeps the dialog where no guide is set', () => {
    (ENV.plugins as any).WALDUR_OPENPORTAL = { ENABLED: true };
    core.HERO_LINK_URL = '';
    expect(getGettingStartedUrl()).toBeUndefined();
  });

  it('keeps the dialog on other sites', () => {
    (ENV.plugins as any).WALDUR_OPENPORTAL = { ENABLED: false };
    core.HERO_LINK_URL = GUIDE;
    expect(getGettingStartedUrl()).toBeUndefined();
  });
});

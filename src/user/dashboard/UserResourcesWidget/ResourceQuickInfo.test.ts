import { describe, expect, it } from 'vitest';

import { getOfferingLinks } from './ResourceQuickInfo';

describe('getOfferingLinks', () => {
  it("lists the offering's links, documentation first as how to get started", () => {
    expect(
      getOfferingLinks({
        documentation_url: 'https://docs.example.org/start',
        access_url: 'https://jupyter.example.org',
        helpdesk_url: 'https://help.example.org',
        privacy_policy_link: 'https://example.org/privacy',
      }),
    ).toEqual([
      { url: 'https://docs.example.org/start', label: 'How to get started' },
      { url: 'https://jupyter.example.org', label: 'Open' },
      { url: 'https://help.example.org', label: 'Get help' },
      { url: 'https://example.org/privacy', label: 'Privacy policy' },
    ]);
  });

  it('leaves out the links that are not set', () => {
    expect(
      getOfferingLinks({ documentation_url: 'https://docs.example.org' }),
    ).toEqual([
      { url: 'https://docs.example.org', label: 'How to get started' },
    ]);
    expect(getOfferingLinks({ access_url: '' })).toEqual([]);
    expect(getOfferingLinks(undefined)).toEqual([]);
  });
});

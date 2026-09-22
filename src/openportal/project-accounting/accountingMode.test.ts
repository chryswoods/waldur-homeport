import { describe, expect, it } from 'vitest';

import { getAccountingMode } from './accountingMode';

describe('getAccountingMode', () => {
  it('uses the award wherever one is attached', () => {
    for (const openPortalAccountingOnly of [true, false]) {
      expect(
        getAccountingMode({ hasAward: true, openPortalAccountingOnly }),
      ).toBe('award');
    }
  });

  // A project with OpenPortal resources but no award still has absolute
  // accounting -- just no allocation to pace against.
  it('shows project-level OpenPortal accounting when the organisation opts in', () => {
    expect(
      getAccountingMode({ hasAward: false, openPortalAccountingOnly: true }),
    ).toBe('project');
  });

  it('leaves an ordinary project on the marketplace widgets', () => {
    expect(
      getAccountingMode({ hasAward: false, openPortalAccountingOnly: false }),
    ).toBe('marketplace');
  });
});

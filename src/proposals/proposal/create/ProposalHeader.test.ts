import { describe, expect, it } from 'vitest';

import { formatDateTime } from '@/core/dateUtils';

import { proposalDates } from './ProposalHeader';

describe('proposalDates', () => {
  it('gives when the proposal was created and submitted', () => {
    expect(
      proposalDates({
        created: '2026-01-15T10:00:00Z',
        submitted_at: '2026-01-20T09:30:00Z',
      }),
    ).toBe(
      `Created ${formatDateTime('2026-01-15T10:00:00Z')} · Submitted ${formatDateTime('2026-01-20T09:30:00Z')}`,
    );
  });

  it('leaves out Submitted for a draft', () => {
    expect(
      proposalDates({ created: '2026-01-15T10:00:00Z', submitted_at: null }),
    ).toBe(`Created ${formatDateTime('2026-01-15T10:00:00Z')}`);
  });
});

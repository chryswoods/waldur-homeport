import { describe, expect, it } from 'vitest';

import { fetchResultCount } from '@/core/api';

/**
 * The archive count lives in the `x-result-count` header, not the body — the
 * generated `Count` operations answer with no body at all.
 *
 * Pinned because reading `response.data` instead yields undefined, coerces to
 * zero, and silently hides the archive from everyone: no error, no empty state,
 * just a menu that never appears. That is the shape of bug this guards.
 */
describe('reading a Count endpoint', () => {
  const countResponse = (headerValue: string | null) =>
    ({
      data: undefined,
      response: { headers: { get: () => headerValue } },
    }) as any;

  it('takes the count from x-result-count', () => {
    expect(fetchResultCount(countResponse('7'))).toBe(7);
  });

  it('has no body to read a count from', () => {
    expect(countResponse('7').data).toBeUndefined();
  });

  // Which is why useHasProposalArchive guards with Number.isFinite rather than
  // passing the value straight through.
  it('answers NaN, not zero, when the header is absent', () => {
    expect(Number.isNaN(fetchResultCount(countResponse(null)))).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';

import { archiveTargetFor, isNotFound } from './resolveArchived';

describe('archiveTargetFor', () => {
  it('sends a resolved proposal to its archived detail', () => {
    expect(archiveTargetFor({ kind: 'proposal', uuid: 'p1' })).toEqual({
      state: 'proposal-archive-proposal',
      params: { uuid: 'p1' },
    });
  });

  it('sends a resolved call to its archived detail', () => {
    expect(archiveTargetFor({ kind: 'call', uuid: 'c1' })).toEqual({
      state: 'proposal-archive-call',
      params: { uuid: 'c1' },
    });
  });

  // A round has no page of its own -- it is a section of its call -- so the
  // useful answer to "what was this round?" is the proposals in it.
  it('sends a resolved round to its proposals', () => {
    expect(archiveTargetFor({ kind: 'round', uuid: 'r1' })).toEqual({
      state: 'proposal-archive-proposals',
      params: { round: 'r1' },
    });
  });

  it('resolves nothing without an answer', () => {
    expect(archiveTargetFor(null)).toBeNull();
    expect(archiveTargetFor(undefined)).toBeNull();
    expect(archiveTargetFor({ kind: 'proposal', uuid: '' })).toBeNull();
  });

  it('resolves nothing for a kind it does not know', () => {
    expect(
      archiveTargetFor({ kind: 'something' as any, uuid: 'x' }),
    ).toBeNull();
  });
});

describe('isNotFound', () => {
  // Only a 404 means "try the archive". A 403 is a live proposal the reader
  // may not see, and redirecting them would turn a clear refusal into a
  // confusing dead end; a 500 must surface as itself.
  it('recognises a 404 in either shape the client reports', () => {
    expect(isNotFound({ status: 404 })).toBe(true);
    expect(isNotFound({ response: { status: 404 } })).toBe(true);
  });

  it('leaves every other failure alone', () => {
    expect(isNotFound({ status: 403 })).toBe(false);
    expect(isNotFound({ status: 500 })).toBe(false);
    expect(isNotFound(new Error('network'))).toBe(false);
    expect(isNotFound(undefined)).toBe(false);
  });
});

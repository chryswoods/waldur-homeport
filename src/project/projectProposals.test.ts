import { beforeEach, describe, expect, it, vi } from 'vitest';

import { isFeatureVisible } from '@/features/connect';

import {
  isProjectProposalLookupEnabled,
  pickProjectProposals,
  sameUuid,
} from './projectProposals';

vi.mock('@/features/connect');

const project = { uuid: 'proj-1', slug: '0261-7825-6844-1' };

describe('pickProjectProposals', () => {
  it('links the live proposal whose slug is the award ID', () => {
    expect(
      pickProjectProposals(
        project,
        [{ uuid: 'live-1', slug: '0261-7825-6844-1' }],
        [],
      ),
    ).toEqual([{ uuid: 'live-1', slug: '0261-7825-6844-1', archived: false }]);
  });

  it('falls back to the archived proposal recorded against the project', () => {
    expect(
      pickProjectProposals(
        project,
        [],
        [{ uuid: 'arch-1', slug: '0261-7825-6844-1', project_uuid: 'proj-1' }],
      ),
    ).toEqual([{ uuid: 'arch-1', slug: '0261-7825-6844-1', archived: true }]);
  });

  it('prefers a live match over an archived one', () => {
    const links = pickProjectProposals(
      project,
      [{ uuid: 'live-1', slug: '0261-7825-6844-1' }],
      [{ uuid: 'arch-1', slug: '0261-7825-6844-1', project_uuid: 'proj-1' }],
    );
    expect(links.map((link) => link.uuid)).toEqual(['live-1']);
  });

  // The filter this replaced was dropped by the backend while the frontend kept
  // sending it; an unrecognised filter reads as no filter, and every proposal
  // in the deployment came back. These pin that the lookup fails closed.
  it('ignores live rows that are not this award, if the slug filter is dropped', () => {
    expect(
      pickProjectProposals(
        project,
        [
          { uuid: 'other-1', slug: 'priority-aware' },
          { uuid: 'other-2', slug: '0261-7825-6844-2' },
        ],
        [],
      ),
    ).toEqual([]);
  });

  it('ignores archived rows for other projects, if the project filter is dropped', () => {
    expect(
      pickProjectProposals(
        project,
        [],
        [{ uuid: 'arch-9', slug: 'x', project_uuid: 'someone-else' }],
      ),
    ).toEqual([]);
  });

  // Follow-on awards differ only in the final segment, so the match must be
  // exact rather than a prefix.
  it('does not treat a follow-on award as this one', () => {
    expect(
      pickProjectProposals(
        { uuid: 'proj-1', slug: '0261-7825-6844-1' },
        [{ uuid: 'follow-on', slug: '0261-7825-6844-10' }],
        [],
      ),
    ).toEqual([]);
  });

  it('finds nothing for a project without a slug', () => {
    expect(
      pickProjectProposals(
        { uuid: 'proj-1', slug: null },
        [{ uuid: 'live-1', slug: '' }],
        [{ uuid: 'arch-1', slug: '', project_uuid: 'proj-1' }],
      ),
    ).toEqual([]);
  });

  // The archive renders UUIDs hyphenated where the rest of Waldur uses bare
  // hex, so the exact-string comparison this replaced rejected the correct row
  // for every existing award, and the line never appeared.
  it('matches an archived row whose project_uuid is hyphenated', () => {
    expect(
      pickProjectProposals(
        { uuid: '6f1a2b3c4d5e6f708192a3b4c5d6e7f8', slug: '0261-7825-6844-1' },
        [],
        [
          {
            uuid: 'arch-1',
            slug: '0261-7825-6844-1',
            project_uuid: '6f1a2b3c-4d5e-6f70-8192-a3b4c5d6e7f8',
          },
        ],
      ),
    ).toEqual([{ uuid: 'arch-1', slug: '0261-7825-6844-1', archived: true }]);
  });

  it("uses the project's slug for an archived record missing its own", () => {
    expect(
      pickProjectProposals(
        project,
        [],
        [{ uuid: 'arch-1', slug: '', project_uuid: 'proj-1' }],
      )[0].slug,
    ).toBe('0261-7825-6844-1');
  });
});

describe('sameUuid', () => {
  it('treats the hex and hyphenated spellings as equal', () => {
    expect(
      sameUuid(
        '6f1a2b3c4d5e6f708192a3b4c5d6e7f8',
        '6F1A2B3C-4D5E-6F70-8192-A3B4C5D6E7F8',
      ),
    ).toBe(true);
  });

  it('still tells different UUIDs apart', () => {
    expect(
      sameUuid(
        '6f1a2b3c4d5e6f708192a3b4c5d6e7f8',
        '6f1a2b3c4d5e6f708192a3b4c5d6e7f9',
      ),
    ).toBe(false);
  });

  it('never matches a missing value', () => {
    expect(sameUuid(null, null)).toBe(false);
    expect(sameUuid('', '')).toBe(false);
    expect(sameUuid(undefined, 'x')).toBe(false);
  });
});

describe('isProjectProposalLookupEnabled', () => {
  const enable = (...flags: string[]) =>
    vi
      .mocked(isFeatureVisible)
      .mockImplementation((flag: any) => flags.includes(flag));

  beforeEach(() => vi.mocked(isFeatureVisible).mockReset());

  it('needs both flags', () => {
    enable(
      'deployment.application_portal_only',
      'proposal.auto_assign_award_id',
    );
    expect(isProjectProposalLookupEnabled()).toBe(true);
  });

  // Without award IDs a slug is slugify(name) on each side, and a coincidental
  // match would link an unrelated proposal.
  it('is off without award IDs', () => {
    enable('deployment.application_portal_only');
    expect(isProjectProposalLookupEnabled()).toBe(false);
  });

  // Without it, an OpenPortal shortname can overwrite the project slug.
  it('is off outside an application portal', () => {
    enable('proposal.auto_assign_award_id');
    expect(isProjectProposalLookupEnabled()).toBe(false);
  });
});

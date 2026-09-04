import { describe, expect, it } from 'vitest';
import type { Proposal } from 'waldur-js-client';

import { belongsToProject } from './ProjectProfile';

const UUID = 'a1b2c3d4e5f6789012345678901234ab';
const proposalWith = (project: string | null) => ({ project }) as Proposal;

describe('belongsToProject', () => {
  it('accepts the project the proposal is linked to', () => {
    expect(
      belongsToProject(proposalWith(`http://api/api/projects/${UUID}/`), UUID),
    ).toBe(true);
  });

  it('accepts a URL without a trailing slash', () => {
    expect(
      belongsToProject(proposalWith(`http://api/api/projects/${UUID}`), UUID),
    ).toBe(true);
  });

  it('rejects another project', () => {
    expect(
      belongsToProject(
        proposalWith(
          'http://api/api/projects/ffffffffffffffffffffffffffffffff/',
        ),
        UUID,
      ),
    ).toBe(false);
  });

  // The whole point of the guard: an unfiltered list must render as empty,
  // not as though every proposal belonged to this project.
  it('rejects a proposal with no project at all', () => {
    expect(belongsToProject(proposalWith(null), UUID)).toBe(false);
    expect(belongsToProject({} as Proposal, UUID)).toBe(false);
  });

  it('does not match a uuid that merely appears inside a longer segment', () => {
    expect(
      belongsToProject(proposalWith(`http://api/api/projects/x${UUID}/`), UUID),
    ).toBe(false);
  });
});

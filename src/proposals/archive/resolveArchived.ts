import { type ArchiveResolve } from 'waldur-js-client';

/** Where an archive `resolve` answer should send the browser. */
export interface ArchiveTarget {
  state: string;
  params: Record<string, string>;
}

/**
 * Maps a resolved archive record to the view that shows it.
 *
 * A round has no page of its own — it is a section of its call — so a round
 * resolves to the archived proposals filtered to that round, which is the
 * useful answer to "what was this round?".
 */
export const archiveTargetFor = (
  resolved: Pick<ArchiveResolve, 'kind' | 'uuid'> | null | undefined,
): ArchiveTarget | null => {
  if (!resolved?.uuid) return null;
  switch (resolved.kind) {
    case 'proposal':
      return {
        state: 'proposal-archive-proposal',
        params: { uuid: resolved.uuid },
      };
    case 'call':
      return {
        state: 'proposal-archive-call',
        params: { uuid: resolved.uuid },
      };
    case 'round':
      return {
        state: 'proposal-archive-proposals',
        params: { round: resolved.uuid },
      };
    default:
      return null;
  }
};

/** True for the 404 the archive answers with; anything else is a real error. */
export const isNotFound = (error: any): boolean =>
  error?.status === 404 || error?.response?.status === 404;

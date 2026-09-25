import { useQuery } from '@tanstack/react-query';
import {
  proposalArchiveProposalsList,
  proposalProposalsList,
} from 'waldur-js-client';

import { STALE_TIME } from '@/core/constants';

import {
  isProjectProposalLookupEnabled,
  pickProjectProposals,
  type ProjectProposalLink,
} from './projectProposals';

/**
 * The proposal a project came from, live or archived.
 *
 * Live proposals are found by slug, which is the award ID once
 * `auto_assign_award_id` is on. The archive is searched by `project_uuid`
 * instead: it has no slug filter, and it holds the recorded link to the
 * project anyway, which is the more exact of the two.
 *
 * The archive is only asked when the live search finds nothing, so a project
 * created since the upgrade costs one request. A live failure is treated as
 * "nothing live" rather than an error — a project has a live or an archived
 * proposal, never both, so falling through cannot show the wrong one.
 *
 * Both endpoints return only what the reader may see, so an empty answer is
 * the normal case for a team member who is not on the proposal, and the hero
 * then simply shows no line.
 */
export const useProjectProposals = (project: {
  uuid: string;
  slug?: string | null;
}): ProjectProposalLink[] => {
  const enabled = isProjectProposalLookupEnabled() && Boolean(project?.slug);

  const { data } = useQuery({
    queryKey: ['project-proposals', project?.uuid, project?.slug],
    queryFn: async () => {
      const live = await proposalProposalsList({
        query: { slug: project.slug, page_size: 10 },
      })
        .then((response) => response.data ?? [])
        .catch(() => []);

      const liveLinks = pickProjectProposals(project, live, []);
      if (liveLinks.length > 0) return liveLinks;

      const archived = await proposalArchiveProposalsList({
        query: { project_uuid: project.uuid, page_size: 10 },
      })
        .then((response) => response.data ?? [])
        .catch(() => []);

      return pickProjectProposals(project, [], archived);
    },
    enabled,
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
  });

  return data ?? [];
};

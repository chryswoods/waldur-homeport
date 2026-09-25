import { type ArchivedProposal, type Proposal } from 'waldur-js-client';

import { isFeatureVisible } from '@/features/connect';
import { DeploymentFeatures } from '@/FeaturesEnums';

export interface ProjectProposalLink {
  uuid: string;
  /** The award ID, which is what the hero shows. */
  slug: string;
  archived: boolean;
}

/**
 * Whether a project's slug can be trusted to name its proposal.
 *
 * Upstream has no route from a project back to its proposal: `Proposal.project`
 * is a URL with nothing on the other side, and no proposal endpoint accepts
 * `project_uuid`. The award ID bridges the gap — with `auto_assign_award_id`
 * on, an accepted proposal and the project it creates share it as their slug.
 *
 * Without the flag the slug is only `slugify(name)` on each side, and equal
 * slugs mean nothing: a project named "Priority Aware" would link to any
 * unrelated proposal that happened to slugify the same way, and staff can see
 * all of them. So the lookup is off unless the flag makes slug equality mean
 * the relation.
 *
 * `application_portal_only` is required too, because without it
 * `ProjectInfo.set_shortname()` can overwrite `project.slug` with an OpenPortal
 * shortname, after which the slug no longer carries the award ID at all.
 */
export const isProjectProposalLookupEnabled = (): boolean =>
  isFeatureVisible(DeploymentFeatures.application_portal_only) &&
  isFeatureVisible(DeploymentFeatures.auto_assign_award_id);

/**
 * The proposals to link from a project, live ones first.
 *
 * A project has one or the other, never both: the archive holds the proposals
 * that created projects before the upgrade, and the live app everything since.
 * So a live match is the answer, and the archive is only consulted without one.
 *
 * Both lists are re-checked here rather than trusted. The filter this replaced
 * was removed from the backend while the frontend kept sending it, and an
 * unrecognised filter reads as no filter — which is how a "Proposal:" line
 * once listed every proposal in the deployment. If either parameter is ever
 * dropped again, this fails closed instead.
 */
export const pickProjectProposals = (
  project: { uuid: string; slug?: string | null },
  live: Pick<Proposal, 'uuid' | 'slug'>[],
  archived: Pick<ArchivedProposal, 'uuid' | 'slug' | 'project_uuid'>[],
): ProjectProposalLink[] => {
  if (!project.slug) return [];

  const liveMatches = live.filter((proposal) => proposal.slug === project.slug);
  if (liveMatches.length > 0) {
    return liveMatches.map((proposal) => ({
      uuid: proposal.uuid,
      slug: proposal.slug,
      archived: false,
    }));
  }

  return archived
    .filter((proposal) => proposal.project_uuid === project.uuid)
    .map((proposal) => ({
      uuid: proposal.uuid,
      // Archived proposals carry the award ID as their slug too; fall back to
      // the project's own if a record is missing it.
      slug: proposal.slug || project.slug,
      archived: true,
    }));
};

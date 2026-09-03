import { useQuery } from '@tanstack/react-query';
import {
  openportalProjectEmailPolicyRetrieve,
  type ProjectEmailPolicyResponse,
} from 'waldur-js-client';

import { STALE_TIME } from '@/core/constants';
import { isFeatureVisible } from '@/features/connect';
import { ProjectFeatures } from '@/FeaturesEnums';

/**
 * The email-domain policy enforced for a project, when the deployment enforces
 * one. Backed by waldur_openportal's project_email_policy endpoint.
 */
export const useProjectEmailPolicy = (projectUuid: string | undefined) =>
  useQuery<ProjectEmailPolicyResponse>({
    queryKey: ['project-email-policy', projectUuid],
    queryFn: async () => {
      const { data } = await openportalProjectEmailPolicyRetrieve({
        path: { project_uuid: projectUuid },
      });
      return data;
    },
    enabled:
      Boolean(projectUuid) &&
      isFeatureVisible(ProjectFeatures.enforce_allowed_domains),
    staleTime: STALE_TIME,
  });

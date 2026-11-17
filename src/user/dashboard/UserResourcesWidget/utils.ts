import { groupBy } from 'lodash-es';
import { Resource, ResourceState } from 'waldur-js-client';

import { ENV } from '@/core/config';

export interface ProjectInfo {
  uuid: string;
  name: string;
  customerName: string;
  customerUuid: string;
  resources: Resource[];
}

export const ACTIVE_RESOURCE_STATES: ResourceState[] = [
  'Creating',
  'OK',
  'Erred',
  'Updating',
  'Terminating',
];

export const groupResourcesByProject = (
  resources: Resource[],
): ProjectInfo[] => {
  const grouped = groupBy(resources, 'project_uuid');

  return Object.entries(grouped).map(([projectUuid, projectResources]) => ({
    uuid: projectUuid,
    name: projectResources[0]?.project_name || '',
    customerName: projectResources[0]?.customer_name || '',
    customerUuid: projectResources[0]?.customer_uuid || '',
    resources: projectResources,
  }));
};

/**
 * Where "Your resources" leads on an Open Portal site: its own getting
 * started guide (the "How to get started" link) rather than a dialog of
 * resources the dashboard already lists. Undefined elsewhere, or where no
 * guide is set, which keeps the dialog.
 */
export const getGettingStartedUrl = (): string | undefined =>
  (ENV.plugins.WALDUR_OPENPORTAL?.ENABLED &&
    ENV.plugins.WALDUR_CORE.HERO_LINK_URL) ||
  undefined;

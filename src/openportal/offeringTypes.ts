import { OPENPORTAL_REMOTE_PLUGIN } from '@/openportal-remote/constants';

import { OPENPORTAL_PLUGIN } from './constants';

/**
 * Whether a resource comes from one of the OpenPortal plugins.
 *
 * These are accounted for absolutely -- an award grants an allocation and usage
 * is measured against it -- so the marketplace's own usage and limit widgets
 * describe something else and confuse more than they explain. The project's
 * usage report is where this data belongs.
 */
export const isOpenPortalOffering = (
  offeringType: string | null | undefined,
): boolean =>
  offeringType === OPENPORTAL_PLUGIN ||
  offeringType === OPENPORTAL_REMOTE_PLUGIN;

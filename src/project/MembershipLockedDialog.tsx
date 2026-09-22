import type { AwardDetails } from 'waldur-js-client';

import { translate } from '@/i18n';

import { AwardLockedDialog } from './AwardLockedDialog';

export { AwardLockedDialog as MembershipLockedDialog };

/**
 * Props for the membership-locked dialog, for
 * openDialog(AwardLockedDialog, membershipLockedDialogProps(awardDetails)).
 */
export const membershipLockedDialogProps = (awardDetails: AwardDetails) => ({
  resolve: {
    awardDetails,
    title: translate('Membership controlled by award'),
    message: translate(
      'Membership for this project is controlled through the funding award. To add or remove members, visit the award page.',
    ),
  },
});

/** Props for the roles-locked dialog. */
export const rolesLockedDialogProps = (awardDetails: AwardDetails) => ({
  resolve: {
    awardDetails,
    title: translate('Roles controlled by award'),
    message: translate(
      "Roles for this project are controlled through the funding award. To change a member's role, visit the award page.",
    ),
  },
});

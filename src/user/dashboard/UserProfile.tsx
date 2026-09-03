import {
  AtIcon,
  MapPinLineIcon,
  PhoneCallIcon,
  UserSquareIcon,
} from '@phosphor-icons/react';
import { useMemo } from 'react';
import { Stack } from 'react-bootstrap';
import { User } from 'waldur-js-client';

import { CopyToClipboardButton } from '@/core/CopyToClipboardButton';
import { StateIndicator } from '@/core/StateIndicator';
import { formatPhoneNumber } from '@/core/utils';
import { PublicDashboardHero } from '@/dashboard/hero/PublicDashboardHero';
import { isFeatureVisible } from '@/features/connect';
import { UserFeatures } from '@/FeaturesEnums';
import { translate } from '@/i18n';
import { getItemAbbreviation } from '@/navigation/workspace/context-selector/utils';
import { useUser } from '@/workspace/hooks';

import { formatUserIsActive } from '../support/utils';

import { UserActions } from './UserActions';

export const UserProfile = ({
  user,
  className,
}: {
  user: User;
  className?: string;
}) => {
  const currentUser = useUser();
  const showStatus = currentUser?.is_staff || currentUser?.is_support;
  const abbreviation = useMemo(
    () => getItemAbbreviation(user, 'full_name'),
    [user],
  );
  return (
    <PublicDashboardHero
      hideQuickSection
      logo={user.image}
      logoAlt={abbreviation}
      logoCircle
      cardBordered
      className={className}
      title={
        <div className="d-flex flex-wrap gap-4 mb-3">
          <h3 className="mb-0">{user.full_name}</h3>
          {(showStatus || user.is_staff || user.is_support) && (
            <div>
              <StateIndicator
                label={formatUserIsActive(user)}
                variant={user.is_active ? 'success' : 'danger'}
                outline
                pill
                hasBullet
              />
            </div>
          )}
        </div>
      }
      actions={<UserActions user={user} />}
    >
      <Stack
        direction="horizontal"
        className="flex-wrap text-gray-500 lh-1"
        gap={5}
      >
        {isFeatureVisible(UserFeatures.show_slug) &&
          isFeatureVisible(UserFeatures.show_slug_as_id) &&
          user.slug && (
            <span className="fw-semibold text-dark text-nowrap">
              {translate('ID')}: {user.slug}
              <CopyToClipboardButton
                value={user.slug}
                onlyButton
                size={16}
                buttonClassName="ms-2"
              />
            </span>
          )}
        {user.job_title && (
          <span className="text-nowrap">
            <UserSquareIcon size={18} weight="duotone" className="me-1" />
            {user.job_title}
          </span>
        )}
        {user.organization && (
          <span className="text-nowrap">
            <MapPinLineIcon size={18} weight="duotone" className="me-1" />
            {user.organization}
          </span>
        )}
        {user.email && (
          <span className="text-nowrap">
            <AtIcon size={18} weight="duotone" className="me-1" />
            {user.email}
          </span>
        )}
        {user.phone_number && (
          <span className="text-nowrap">
            <PhoneCallIcon size={18} weight="duotone" className="me-1" />
            {formatPhoneNumber(user.phone_number)}
          </span>
        )}
      </Stack>
    </PublicDashboardHero>
  );
};

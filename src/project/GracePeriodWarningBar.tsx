import { WarningCircleIcon } from '@phosphor-icons/react';
import { useCurrentStateAndParams } from '@uirouter/react';
import { FC } from 'react';

import {
  daysUntilAccessEnds,
  formatDate,
  lastAccessDate,
} from '@/core/dateUtils';
import { FeaturedIcon } from '@/core/FeaturedIcon';
import { translate } from '@/i18n';
import { useProject } from '@/workspace/hooks';

export const GracePeriodWarningBar: FC = () => {
  const project = useProject();
  const { state } = useCurrentStateAndParams();

  const isProjectPage =
    state?.name?.startsWith('project.') || state?.name?.startsWith('project-');

  if (!project || !isProjectPage || !project.effective_end_date) {
    return null;
  }

  const today = new Date();
  const effectiveEndDateObj = new Date(project.effective_end_date);
  const isExpired = effectiveEndDateObj < today;
  const isInGracePeriod = project.is_in_grace_period;

  if (!isExpired && !isInGracePeriod) {
    return null;
  }

  const endDate = formatDate(project.end_date);
  const effectiveEndDate = formatDate(project.effective_end_date);
  // The resources go at the *start* of effective_end_date, so the last day
  // they can be used is the day before — which is the day to put in front of
  // users, not the deletion date.
  const lastActiveDate = formatDate(lastAccessDate(project.effective_end_date));

  return (
    <div className="layout-warning-bar bar-warning">
      <div className="container-fluid w-100 d-flex align-items-center gap-2">
        {/* eslint-disable-next-line waldur-custom/enforce-phosphor-icon-weight */}
        <FeaturedIcon
          IconComponent={WarningCircleIcon}
          variant="warning"
          size="sm"
        />
        <p className="text-start fs-6 mb-0">
          {isExpired ? (
            <>
              <strong className="fw-bold text-danger">
                {translate('Project expired')}:{' '}
              </strong>
              {translate(
                'This project expired on {effectiveEndDate}. Active resources are scheduled for termination.',
                { effectiveEndDate },
              )}
            </>
          ) : (
            <GracePeriodMessage
              endDate={endDate}
              lastActiveDate={lastActiveDate}
              daysRemaining={daysUntilAccessEnds(project.effective_end_date)}
            />
          )}
        </p>
      </div>
    </div>
  );
};

const GracePeriodMessage: FC<{
  endDate: string;
  lastActiveDate: string;
  daysRemaining: number;
}> = ({ endDate, lastActiveDate, daysRemaining }) => {
  const urgencyClass =
    daysRemaining <= 3
      ? 'text-danger fw-bold'
      : daysRemaining <= 7
        ? 'text-warning fw-bold'
        : 'fw-bold';

  return (
    <>
      <strong className="fw-bold">{translate('Grace period active')}: </strong>
      {translate(
        'This project ended on {endDate}. Resources will remain active until the end of {lastActiveDate}.',
        { endDate, lastActiveDate },
      )}{' '}
      <span className={urgencyClass}>
        {daysRemaining <= 0
          ? translate('Today is the last day')
          : daysRemaining === 1
            ? translate('1 day remaining')
            : translate('{daysRemaining} days remaining', {
                daysRemaining: String(daysRemaining),
              })}
      </span>
      .
    </>
  );
};

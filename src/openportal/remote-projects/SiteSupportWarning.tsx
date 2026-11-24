import { ArrowsClockwiseIcon } from '@phosphor-icons/react';
import classNames from 'classnames';
import { FC } from 'react';
import {
  openportalRemoteProjectsRefreshSiteFeatures,
  type RemoteProject,
} from 'waldur-js-client';

import { AlertItem, BaseButton } from 'waldur-ui';

import { formatDateTime } from '@/core/dateUtils';
import { translate } from '@/i18n';
import { useManagedMutation } from '@/modal/useManagedMutation';
import {
  siteSupportSummary,
  unsupportedControls,
} from '@/openportal/spendProfile';
import { useNotify } from '@/store/notify';

interface SiteSupportWarningProps {
  rp: Pick<
    RemoteProject,
    'uuid' | 'site_features' | 'site_features_checked_at'
  >;
  /** The profile to check: the saved one, or the one being edited. */
  entries: ReadonlyArray<{
    minimum?: string | number | null;
    maximum?: string | number | null;
  }> | null;
  /** Offers "Check again"; called with the refreshed RemoteProject. */
  onChecked?(rp: RemoteProject): void;
  /** The site is being asked just now. */
  checking?: boolean;
  /** Also say what the site supports when there is nothing to warn of. */
  showSupported?: boolean;
  className?: string;
}

/**
 * Warns where a profile uses a control the site has not said it enforces:
 * the profile is kept, but the site may not apply it.
 */
export const SiteSupportWarning: FC<SiteSupportWarningProps> = ({
  rp,
  entries,
  onChecked,
  checking,
  showSupported,
  className,
}) => {
  const { showSuccess } = useNotify();
  const check = useManagedMutation<RemoteProject, unknown, void>({
    mutationFn: () =>
      openportalRemoteProjectsRefreshSiteFeatures({
        path: { uuid: rp.uuid },
      }).then(({ data }) => data),
    onSuccess: (data) => {
      // Say what the site answered, whether or not the warning stays.
      showSuccess(
        siteSupportSummary(data.site_features) ??
          translate('The site has not answered yet.'),
      );
      onChecked?.(data);
    },
    errorMessage: translate('Unable to ask the site what it supports.'),
    // Also used inside the editor, which must stay open.
    closeModal: false,
  });

  if (checking || check.isPending) {
    return (
      <p className={classNames('text-muted fs-7', className)}>
        {translate('Asking the site what it supports…')}
      </p>
    );
  }
  const missing = unsupportedControls(entries, rp.site_features);
  if (!missing.minimums && !missing.maximums) {
    const summary = showSupported ? siteSupportSummary(rp.site_features) : null;
    return summary ? (
      <p
        className={classNames('text-muted fs-7', className)}
        data-testid="site-support-summary"
      >
        {summary}
      </p>
    ) : null;
  }
  const title =
    missing.minimums && missing.maximums
      ? translate(
          'The site has not said it enforces minimums or maximums; the profile is recorded but may not be applied.',
        )
      : missing.minimums
        ? translate(
            'The site has not said it enforces minimums; the profile is recorded but may not be applied.',
          )
        : translate(
            'The site has not said it enforces maximums; the profile is recorded but may not be applied.',
          );

  return (
    <AlertItem
      variant="warning"
      className={className}
      title={title}
      data-testid="site-support-warning"
      body={
        <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap">
          <span>
            {rp.site_features_checked_at
              ? translate('Last asked {date}.', {
                  date: formatDateTime(rp.site_features_checked_at),
                })
              : translate('The site has not been asked yet.')}
          </span>
          {onChecked && (
            <BaseButton
              size="sm"
              variant="tertiary"
              iconNode={<ArrowsClockwiseIcon weight="bold" />}
              label={translate('Check again')}
              onClick={() => check.mutate()}
              pending={check.isPending}
            />
          )}
        </div>
      }
    />
  );
};

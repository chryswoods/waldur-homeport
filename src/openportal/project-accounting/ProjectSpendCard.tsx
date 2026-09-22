import { InfoIcon } from '@phosphor-icons/react';
import classNames from 'classnames';
import { FC } from 'react';

import { Tooltip } from 'waldur-ui';

import { defaultCurrency } from '@/core/formatCurrency';
import { Panel } from '@/core/Panel';
import { translate } from '@/i18n';

import {
  percentOf,
  UsageProgressBar,
  usageTextClass,
} from '../allocationUsage';

import { type ProjectSpend } from './projectSpend';

interface Props {
  spend: ProjectSpend;
  className?: string;
}

/**
 * A project's OpenPortal accounting where no award is attached.
 *
 * Deliberately the same shape as the award card — allocation, usage, a bar —
 * because it is the same absolute accounting; the allocation simply has to be
 * recovered from the credit balance rather than stated by an award. See
 * `buildProjectSpend` for why that recovery is exact here and would not be on
 * an ordinary Waldur project.
 *
 * What it does not carry is the pace: a pace needs an award window to measure
 * against, and the project's own dates are not one.
 */
export const ProjectSpendCard: FC<Props> = ({ spend, className }) => {
  const percent = percentOf(spend.usedTotal, spend.allocation);
  return (
    // No heading and no date range: the award card it stands in for has none
    // either, and stripping them lets this line up with the monthly usage chart
    // beside it instead of standing a header taller than everything else.
    <Panel cardBordered className={className}>
      <div className="d-flex align-items-start gap-3">
        <div className="flex-grow-1 d-flex flex-column gap-3">
          <div>
            <div className="fs-6 text-muted fw-bold mb-1">
              {translate('Allocation')}
            </div>
            <div className="display-6 fw-boldest">
              {defaultCurrency(spend.allocation)}
            </div>
          </div>
          <div>
            <div className="fs-6 text-muted fw-bold mb-1">
              {translate('Used')}
            </div>
            <div
              className={classNames(
                'display-6 fw-boldest',
                usageTextClass(percent),
              )}
            >
              {defaultCurrency(spend.usedTotal)}
            </div>
            <UsageProgressBar percent={percent} />
            <div className="fs-8 text-muted mt-1">
              {translate('{amount} remaining', {
                amount: defaultCurrency(spend.remaining),
              })}
            </div>
          </div>
        </div>
        <Tooltip
          label={translate(
            'The credit granted to this project over its life, and everything booked against it including the current month. {thisMonth} of the usage is this month, which has not yet been drawn from the credit balance.',
            { thisMonth: defaultCurrency(spend.currentMonth) },
          )}
        >
          <InfoIcon weight="bold" className="text-muted" />
        </Tooltip>
      </div>
    </Panel>
  );
};

import { InfoIcon } from '@phosphor-icons/react';
import { FC } from 'react';

import { Tooltip } from 'waldur-ui';

import { formatDate } from '@/core/dateUtils';
import { defaultCurrency } from '@/core/formatCurrency';
import { WidgetCard } from '@/dashboard/WidgetCard';
import { translate } from '@/i18n';

import { percentOf, UsageProgressBar } from '../allocationUsage';

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
export const ProjectSpendCard: FC<Props> = ({ spend, className }) => (
  <WidgetCard
    cardTitle={translate('Project accounting')}
    meta={
      spend.endDate
        ? translate('{start} to {end}', {
            start: formatDate(spend.startDate),
            end: formatDate(spend.endDate),
          })
        : translate('From {start}', { start: formatDate(spend.startDate) })
    }
    className={className}
    cardAction={
      <Tooltip
        label={translate(
          'The credit granted to this project over its life, and everything booked against it including the current month. {thisMonth} of the usage is this month, which has not yet been drawn from the credit balance.',
          { thisMonth: defaultCurrency(spend.currentMonth) },
        )}
      >
        <InfoIcon weight="bold" className="text-muted" />
      </Tooltip>
    }
  >
    <div className="separator mt-4 mb-4" />
    <div className="d-flex flex-column gap-3">
      <div>
        <div className="fs-6 text-muted fw-bold mb-1">
          {translate('Allocation')}
        </div>
        <div className="display-6 fw-boldest">
          {defaultCurrency(spend.allocation)}
        </div>
      </div>
      <div>
        <div className="fs-6 text-muted fw-bold mb-1">{translate('Used')}</div>
        <div className="display-6 fw-boldest">
          {defaultCurrency(spend.usedTotal)}
        </div>
        <UsageProgressBar
          percent={percentOf(spend.usedTotal, spend.allocation)}
        />
        <div className="fs-8 text-muted mt-1">
          {translate('{amount} remaining', {
            amount: defaultCurrency(spend.remaining),
          })}
        </div>
      </div>
    </div>
  </WidgetCard>
);

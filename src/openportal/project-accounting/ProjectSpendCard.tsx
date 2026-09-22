import { InfoIcon } from '@phosphor-icons/react';
import { FC, ReactNode } from 'react';
import { Col, Row } from 'react-bootstrap';

import { Tooltip } from 'waldur-ui';

import { formatDate } from '@/core/dateUtils';
import { defaultCurrency } from '@/core/formatCurrency';
import { StatsCard } from '@/core/StatsCard';
import { WidgetCard } from '@/dashboard/WidgetCard';
import { translate } from '@/i18n';

import { type ProjectSpend } from './projectSpend';

const MetricTip: FC<{ label: ReactNode }> = ({ label }) => (
  <Tooltip label={label}>
    <InfoIcon weight="bold" className="text-muted" />
  </Tooltip>
);

interface Props {
  spend: ProjectSpend;
  className?: string;
}

/**
 * A project's OpenPortal spend, for a project with no award behind it.
 *
 * The award card's counterpart, minus everything that needs an allocation:
 * there is no bar, no pace and no run-out date, because without an award there
 * is no stated figure to measure against. What is left is still the absolute
 * accounting — what has been used, and what credit is left — rather than the
 * marketplace widgets' monthly ledger view.
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
  >
    <div className="separator mt-4 mb-4" />
    <Row className="g-3">
      <Col md={4} sm={12}>
        <StatsCard
          label={translate('Used to date')}
          value={defaultCurrency(spend.usedTotal)}
          icon={
            <MetricTip
              label={translate(
                'Everything booked against this project, including the current month.',
              )}
            />
          }
        />
      </Col>
      <Col md={4} sm={12}>
        <StatsCard
          label={translate('This month')}
          value={defaultCurrency(spend.currentMonth)}
          icon={
            <MetricTip
              label={translate(
                'Booked so far this month. It is drawn from the credit balance when the month is invoiced, not as it accrues.',
              )}
            />
          }
        />
      </Col>
      <Col md={4} sm={12}>
        <StatsCard
          label={translate('Credit remaining')}
          value={defaultCurrency(spend.remaining)}
          icon={
            <MetricTip
              label={translate(
                'The credit balance less what this month has booked against it.',
              )}
            />
          }
        />
      </Col>
    </Row>
  </WidgetCard>
);

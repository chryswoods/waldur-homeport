import classNames from 'classnames';
import { Project } from 'waldur-js-client';

import { defaultCurrency } from '@/core/formatCurrency';
import { LoadingErred } from '@/core/LoadingErred';
import { LoadingSpinner } from '@/core/LoadingSpinner';
import { WidgetCard } from '@/dashboard/WidgetCard';
import { translate } from '@/i18n';

import { useProjectCreditChart } from './utils';

export const ProjectDashboardBalance = ({
  project,
  className,
}: {
  project: Project;
  className?: string;
}) => {
  const { credit, error, isLoading, refetch } = useProjectCreditChart(project);

  if (isLoading) {
    return <LoadingSpinner />;
  } else if (error) {
    return (
      <LoadingErred
        message={translate('Unable to load data.')}
        loadData={refetch}
      />
    );
  }

  // The API serialises both of these as decimal strings, so they have to be
  // converted before any arithmetic — the same way ProjectDashboardCredit
  // does for credit.value.
  const balance = Number(credit?.value) || 0;
  const estimate = Number(project.billing_price_estimate?.total) || 0;
  let estimated_balance = balance - estimate;

  let warning = null;

  if (estimated_balance <= 0) {
    estimated_balance = 0;

    warning = (
      <span className="text-danger">
        {translate(
          'Warning: Your estimated balance is now zero. You will not be able to consume any more resources.',
        )}
      </span>
    );
  } else if (estimated_balance < 0.1 * balance) {
    warning = (
      <span className="text-warning">
        {translate('Warning: Your estimated balance is low.')}
      </span>
    );
  }

  return (
    <WidgetCard
      cardTitle={translate('Accounting')}
      className={classNames('h-100', className)}
    >
      <ul>
        <li>
          {translate('Balance at start of month')}: {defaultCurrency(balance)}
        </li>
        <li>
          {translate('Estimated spend this month')}: {defaultCurrency(estimate)}
        </li>
        <li>
          {translate('Estimated balance at the end of this month')}:{' '}
          {defaultCurrency(estimated_balance)}
        </li>
      </ul>
      {warning && <div className="mt-2">{warning}</div>}
    </WidgetCard>
  );
};

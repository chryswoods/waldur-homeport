import { useQuery } from '@tanstack/react-query';
import { FunctionComponent, useMemo } from 'react';
import { Col, Row } from 'react-bootstrap';
import { customersStatsRetrieve } from 'waldur-js-client';

import { SHORT_STALE_TIME } from '@/core/constants';
import { COMMON_WIDGET_HEIGHT } from '@/dashboard/constants';
import { isFeatureVisible } from '@/features/connect';
import { CustomerFeatures } from '@/FeaturesEnums';
import { AggregateLimitWidget } from '@/marketplace/aggregate-limits/AggregateLimitWidget';
import { UsageViewsSection } from '@/marketplace/aggregate-limits/usage-views/UsageViewsSection';
import { ProjectsList } from '@/project/ProjectsList';
import { useUser, useCustomer } from '@/workspace/hooks';
import {
  checkIsServiceManager,
  checkIsOwnerOrStaffOrReader,
} from '@/workspace/selectors';

import { CustomerDashboardChart } from './CustomerDashboardChart';
import { CustomerDashboardCredit } from './CustomerDashboardCredit';
import { CustomerProfile } from './CustomerProfile';
import { filterComponentsWithUsage } from './utils';

export const CustomerDashboard: FunctionComponent = () => {
  const user = useUser();
  const customer = useCustomer();
  const isServiceManager = useMemo(
    () => checkIsServiceManager(customer, user),
    [customer, user],
  );
  // Readers hold a read-only organisation role, and the dashboard charts only
  // display organisation data.
  const canSeeCharts = useMemo(
    () => checkIsOwnerOrStaffOrReader(customer, user),
    [customer, user],
  );

  const {
    data: aggregateLimitData,
    isLoading: isAggregateLimitLoading,
    error: aggregateLimitError,
    refetch: aggregateLimitRefetch,
  } = useQuery({
    queryKey: ['customer-stats', customer?.uuid],

    queryFn: () =>
      customersStatsRetrieve({ path: { uuid: customer?.uuid } }).then(
        (r) => r.data,
      ),

    refetchOnWindowFocus: false,
    staleTime: SHORT_STALE_TIME,
  });

  const {
    data: aggregateLimitDataForCurrentMonth,
    isLoading: isAggregateLimitLoadingForCurrentMonth,
    error: aggregateLimitErrorForCurrentMonth,
    refetch: aggregateLimitRefetchForCurrentMonth,
  } = useQuery({
    queryKey: ['customer-stats', customer?.uuid, 'current-month'],

    queryFn: () =>
      customersStatsRetrieve({
        path: { uuid: customer?.uuid },
        query: { for_current_month: true },
      }).then((r) => r.data),

    refetchOnWindowFocus: false,
    staleTime: SHORT_STALE_TIME,
  });

  const currentMonthFilteredData = filterComponentsWithUsage(
    aggregateLimitDataForCurrentMonth,
  );

  // An organisation accounted for by OpenPortal awards is measured absolutely --
  // an award grants an allocation and usage is counted against it -- so the
  // marketplace's usage, limit and credit widgets describe a different model
  // and read as a contradiction of the project figures rather than a summary of
  // them.
  //
  // A feature rather than something inferred from the projects: deciding it by
  // inspection would need every project's award state before anything could
  // render, and "all of them" is the wrong test anyway -- one non-award project
  // would bring the widgets back for the whole organisation.
  const openPortalAccountingOnly = isFeatureVisible(
    CustomerFeatures.show_openportal_accounting_only,
  );

  const shouldShowAggregateLimitWidget =
    !openPortalAccountingOnly && aggregateLimitData?.components?.length > 0;

  const shouldShowCurrentMonthWidget =
    !openPortalAccountingOnly &&
    currentMonthFilteredData?.components?.length > 0;

  if (!customer) return null;

  return (
    <>
      {isServiceManager ? (
        <CustomerProfile customer={customer} />
      ) : (
        <Row>
          {canSeeCharts && (
            <CustomerDashboardChart customer={customer} user={user} />
          )}
          {shouldShowCurrentMonthWidget && (
            <Col md={6} sm={12} className="mb-5" style={COMMON_WIDGET_HEIGHT}>
              <AggregateLimitWidget
                customer={customer}
                data={currentMonthFilteredData}
                isLoading={isAggregateLimitLoadingForCurrentMonth}
                error={aggregateLimitErrorForCurrentMonth}
                refetch={aggregateLimitRefetchForCurrentMonth}
                type="monthly"
              />
            </Col>
          )}
          {shouldShowAggregateLimitWidget && (
            <Col md={6} sm={12} className="mb-5" style={COMMON_WIDGET_HEIGHT}>
              <AggregateLimitWidget
                customer={customer}
                data={aggregateLimitData}
                isLoading={isAggregateLimitLoading}
                error={aggregateLimitError}
                refetch={aggregateLimitRefetch}
              />
            </Col>
          )}
          {!openPortalAccountingOnly && Boolean(customer.credit) && (
            <Col md={6} sm={12} className="mb-5" style={COMMON_WIDGET_HEIGHT}>
              <CustomerDashboardCredit customer={customer} />
            </Col>
          )}
          <Col xs={12}>
            <UsageViewsSection customer={customer} />
          </Col>
          <Col xs={12}>
            <ProjectsList customer={customer} />
          </Col>
        </Row>
      )}
    </>
  );
};

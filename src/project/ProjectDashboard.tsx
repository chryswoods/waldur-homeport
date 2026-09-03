import { PencilSimpleIcon } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from '@uirouter/react';
import { FunctionComponent } from 'react';
import { Col, Row } from 'react-bootstrap';
import {
  openportalManagedProjectsList,
  openportalRemoteProjectsList,
  projectsListUsersList,
  projectsStatsRetrieve,
} from 'waldur-js-client';

import { getResourcesCount } from '@/administration/api';
import { parseSelectData } from '@/core/api';
import { Badge } from '@/core/Badge';
import { SHORT_STALE_TIME, STALE_TIME, UI_STALE_TIME } from '@/core/constants';
import { lazyComponent } from '@/core/lazyComponent';
import { Panel } from '@/core/Panel';
import { TruncatedMarkdown } from '@/core/TruncatedMarkdown';
import { filterComponentsWithUsage } from '@/customer/dashboard/utils';
import { COMMON_WIDGET_HEIGHT } from '@/dashboard/constants';
import { TeamWidget } from '@/dashboard/TeamWidget';
import { isFeatureVisible } from '@/features/connect';
import { CustomerFeatures, MarketplaceFeatures } from '@/FeaturesEnums';
import { EditButton } from '@/form/EditButton';
import { translate } from '@/i18n';
import { useCreateInvitation } from '@/invitations/actions/useCreateInvitation';
import { AggregateLimitWidget } from '@/marketplace/aggregate-limits/AggregateLimitWidget';
import { UsageViewsSection } from '@/marketplace/aggregate-limits/usage-views/UsageViewsSection';
import { NON_TERMINATED_STATES } from '@/marketplace/resources/list/constants';
import { useModal } from '@/modal/actions';
import { canChangeMembership } from '@/openportal/awardPolicy';
import { ManagedProjectDashboardCards } from '@/openportal/managed-projects/ManagedProjectDashboardCards';
import { RemoteProjectDashboardCards } from '@/openportal/remote-projects/RemoteProjectDashboardCards';
import { PermissionEnum } from '@/permissions/enums';
import { hasPermission } from '@/permissions/hasPermission';
import { ActionButton } from '@/table/ActionButton';
import { useThemeFeatures } from '@/theme/useThemeFeatures';
import { useCustomer, useUser, useProject } from '@/workspace/hooks';

import { AwardLockedDialog } from './AwardLockedDialog';
import { ProjectLimitUsageBasedResources } from './dashboard/ProjectLimitUsageBasedResources';
import { membershipLockedDialogProps } from './MembershipLockedDialog';
import { ProjectCreditHealthBlock } from './policy-watch/ProjectCreditHealthBlock';
import { ProjectDashboardBalance } from './ProjectDashboardBalance';
import { ProjectDashboardCostLimits } from './ProjectDashboardCostLimits';
import { ProjectDashboardCredit } from './ProjectDashboardCredit';
import { useProjectAwardDetails } from './useProjectAwardDetails';
import { getProjectTeamChart } from './utils';

const EditFieldDialog = lazyComponent(() =>
  import('./manage/EditFieldDialog').then((module) => ({
    default: module.EditFieldDialog,
  })),
);

export const ProjectDashboard: FunctionComponent<{}> = () => {
  const shouldConcealPrices = isFeatureVisible(
    MarketplaceFeatures.conceal_prices,
  );

  const { openDialog } = useModal();

  // Limits are aggregated across all resources, which reads as though the
  // budget were N * remaining_credits. Hidden for this deployment.
  const { ShowResourceLimits } = useThemeFeatures();
  const user = useUser();
  const userFromSelector = useUser();
  const project = useProject();

  const router = useRouter();
  const goToUsers = () => router.stateService.go('project-users');

  const canEditProject =
    userFromSelector &&
    project &&
    (hasPermission(userFromSelector, {
      permission: PermissionEnum.UPDATE_PROJECT,
      projectId: project.uuid,
    }) ||
      hasPermission(userFromSelector, {
        permission: PermissionEnum.UPDATE_PROJECT,
        customerId: project.customer_uuid,
      }));

  const handleEditStaffNotes = () => {
    openDialog(EditFieldDialog, {
      resolve: { project, name: 'staff_notes' },
      size: 'lg',
    });
  };

  const handleEditDescription = () => {
    openDialog(EditFieldDialog, {
      resolve: { project, name: 'description' },
      size: 'lg',
    });
  };

  const { data: teamData } = useQuery({
    queryKey: ['projectTeamData', project?.uuid],
    queryFn: () => getProjectTeamChart(project),
    staleTime: STALE_TIME,
  });

  const { callback, canInvite, loadingProjects } = useCreateInvitation({
    project: project,
    roleTypes: ['project'],
  });

  const isProjectRemoved = Boolean(project?.is_removed);

  const {
    data: aggregateLimitData,
    isLoading: isAggregateLimitLoading,
    error: aggregateLimitError,
    refetch: aggregateLimitRefetch,
  } = useQuery({
    queryKey: ['project-stats', project?.uuid],

    queryFn: () =>
      projectsStatsRetrieve({ path: { uuid: project?.uuid } }).then(
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
    queryKey: ['project-stats', project?.uuid, 'current-month'],

    queryFn: () =>
      projectsStatsRetrieve({
        path: { uuid: project?.uuid },
        query: { for_current_month: true },
      }).then((r) => r.data),

    refetchOnWindowFocus: false,
    staleTime: SHORT_STALE_TIME,
  });

  const currentMonthFilteredData = filterComponentsWithUsage(
    aggregateLimitDataForCurrentMonth,
  );

  const shouldShowAggregateLimitWidget =
    aggregateLimitData?.components?.length > 0 && ShowResourceLimits;

  const shouldShowCurrentMonthWidget =
    currentMonthFilteredData?.components?.length > 0 && ShowResourceLimits;

  // Check if there are limit-based resources to show
  const { data: limitBasedResourcesCount } = useQuery({
    queryKey: ['limit-based-resources-count', project?.uuid],
    queryFn: () =>
      project?.uuid
        ? getResourcesCount({
            project_uuid: project.uuid,
            state: NON_TERMINATED_STATES,
            only_limit_based: true,
            component_count: 1,
          })
        : 0,
    refetchOnWindowFocus: false,
    staleTime: UI_STALE_TIME,
    enabled: Boolean(project?.uuid),
  });

  const shouldShowLimitBasedResources = (limitBasedResourcesCount || 0) > 0;

  const showBillingInfo = project.customer_display_billing_info_in_projects;

  // ── OpenPortal remote and managed projects ──────────────────────────────
  // A project backed by an external award shows that award's allocation and
  // usage in place of the local credit widgets, which say nothing useful when
  // the budget lives on the awarding portal.
  const customer = useCustomer();

  const showRemoteProjects = isFeatureVisible(
    CustomerFeatures.show_openportal_remote_projects,
  );

  const { data: remoteProjects } = useQuery({
    queryKey: ['remote-projects-for-project', project?.uuid],
    queryFn: () =>
      openportalRemoteProjectsList({
        query: { project_uuid: project.uuid },
      }).then((r) => r.data),
    enabled: showRemoteProjects && Boolean(project?.uuid),
    staleTime: STALE_TIME,
  });

  const remoteCount =
    remoteProjects?.filter((rp) => rp.state !== 'deleted').length ?? 0;
  const hasAnyRemoteProjects = showRemoteProjects && remoteCount > 0;
  const hasManyRemoteProjects = showRemoteProjects && remoteCount > 1;

  const showManagedProjects = isFeatureVisible(
    MarketplaceFeatures.show_managed_projects,
  );

  const { data: managedProjects } = useQuery({
    queryKey: ['managed-projects-for-project', project?.uuid],
    queryFn: () =>
      openportalManagedProjectsList({
        query: { project_uuid: project.uuid },
      }).then((r) => r.data),
    enabled: showManagedProjects && Boolean(project?.uuid),
    staleTime: STALE_TIME,
  });

  const hasAnyManagedProjects =
    showManagedProjects &&
    (managedProjects?.filter(
      (mp) => mp.state === 'approved' || mp.state === 'pending',
    ).length ?? 0) > 0;

  // When the award controls membership, the team widget's Add button explains
  // that rather than opening the invitation flow.
  const { data: awardDetails } = useProjectAwardDetails(project?.uuid);
  const membershipLocked = !canChangeMembership(
    awardDetails?.membership_control,
  );
  const handleAddClick =
    membershipLocked && awardDetails
      ? () =>
          openDialog(
            AwardLockedDialog,
            membershipLockedDialogProps(awardDetails),
          )
      : callback;

  if (!project || !user) {
    return null;
  }
  return (
    <>
      {(project.description || project.staff_notes) && (
        <Row>
          {project.description && (
            <Col
              md={project.staff_notes ? 6 : 12}
              className="mb-5"
              style={COMMON_WIDGET_HEIGHT}
            >
              <Panel
                title={translate('Description')}
                actions={
                  canEditProject && (
                    <ActionButton
                      title={translate('Edit')}
                      iconNode={<PencilSimpleIcon weight="bold" />}
                      iconRight
                      action={handleEditDescription}
                      tooltip={translate('Edit description')}
                    />
                  )
                }
                cardBordered
                className="h-100"
              >
                <TruncatedMarkdown
                  text={project.description}
                  title={translate('Description')}
                  maxHeight={120}
                />
              </Panel>
            </Col>
          )}
          {project.staff_notes && (user.is_staff || user.is_support) && (
            <Col
              md={project.description ? 6 : 12}
              className="mb-5"
              style={COMMON_WIDGET_HEIGHT}
            >
              <Panel
                title={
                  <>
                    {translate('Staff Notes')}{' '}
                    <Badge variant="warning" pill outline>
                      {translate('Internal')}
                    </Badge>
                  </>
                }
                actions={
                  user.is_staff && (
                    <EditButton
                      onClick={handleEditStaffNotes}
                      tooltip={translate('Edit staff notes')}
                    />
                  )
                }
                cardBordered
                className="h-100"
              >
                <TruncatedMarkdown
                  text={project.staff_notes}
                  title={translate('Staff Notes')}
                  maxHeight={120}
                  showInternalBadge={true}
                />
              </Panel>
            </Col>
          )}
        </Row>
      )}
      {shouldShowLimitBasedResources && (
        <ProjectLimitUsageBasedResources
          showCost={!shouldConcealPrices && showBillingInfo}
        />
      )}
      <Row>
        {!shouldConcealPrices &&
          showBillingInfo &&
          ShowResourceLimits &&
          !hasManyRemoteProjects && (
            <Col md={6} sm={12} className="mb-5" style={COMMON_WIDGET_HEIGHT}>
              <ProjectDashboardCostLimits project={project} />
            </Col>
          )}
        {hasAnyRemoteProjects && remoteProjects && (
          <RemoteProjectDashboardCards
            remoteProjects={remoteProjects}
            customerEmail={customer?.email}
          />
        )}
        {hasAnyManagedProjects && managedProjects && (
          <ManagedProjectDashboardCards
            managedProjects={managedProjects}
            project={project}
          />
        )}
        {!hasManyRemoteProjects && !hasAnyManagedProjects && (
          <Col md={6} sm={12} className="mb-5" style={COMMON_WIDGET_HEIGHT}>
            <ProjectDashboardBalance project={project} />
          </Col>
        )}
        {!hasAnyRemoteProjects && (
          <Col md={6} sm={12} className="mb-5" style={COMMON_WIDGET_HEIGHT}>
            <TeamWidget
              api={() =>
                projectsListUsersList({
                  path: { uuid: project.uuid },
                  query: {
                    field: [
                      'user_uuid',
                      'user_full_name',
                      'user_email',
                      'user_image',
                      'role_name',
                    ],

                    page_size: 5,
                  },
                }).then(parseSelectData)
              }
              scope={project}
              chartData={teamData}
              showChart
              onBadgeClick={isProjectRemoved ? undefined : goToUsers}
              onAddClick={isProjectRemoved ? undefined : handleAddClick}
              showAdd={(canInvite || membershipLocked) && !isProjectRemoved}
              loadingAdd={loadingProjects}
              className="h-100"
              nameKey="user_full_name"
              emailKey="user_email"
              imageKey="user_image"
            />
          </Col>
        )}
        {shouldShowCurrentMonthWidget && (
          <Col md={6} sm={12} className="mb-5" style={COMMON_WIDGET_HEIGHT}>
            <AggregateLimitWidget
              project={project}
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
              project={project}
              data={aggregateLimitData}
              isLoading={isAggregateLimitLoading}
              error={aggregateLimitError}
              refetch={aggregateLimitRefetch}
            />
          </Col>
        )}
        {showBillingInfo && !hasManyRemoteProjects && (
          <ProjectDashboardCredit project={project} className="mb-5" />
        )}
      </Row>
      {/* The Health block is for projects with a credit allocation and gates
          itself on one — it renders nothing without. The usage views are about
          quota rather than credit, so they are not tied to an allocation; each
          view ships behind its own dashboard.usage_* feature flag and the
          section renders nothing until an operator enables one. */}
      {showBillingInfo && <ProjectCreditHealthBlock project={project} />}
      <UsageViewsSection project={project} />
    </>
  );
};

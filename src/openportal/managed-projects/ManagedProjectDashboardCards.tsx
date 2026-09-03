import { useQuery } from '@tanstack/react-query';
import { FC } from 'react';
import { Col } from 'react-bootstrap';
import type { ManagedProject, Project } from 'waldur-js-client';

import { AlertItem } from '@/core/AlertItem';
import { formatDate } from '@/core/dateUtils';
import { Panel } from '@/core/Panel';
import { translate } from '@/i18n';

import {
  allocationUnit,
  ExternalCardLink,
  formatUsage,
  usagePercent,
  UsageProgressBar,
} from '../allocationUsage';
import { fetchUsageReports } from '../reports/api';
import { ProjectUsageReport } from '../reports/ProjectUsageReport';

import { embargoedUntil } from './utils';

interface Props {
  managedProjects: ManagedProject[];
  project: Project;
}

// Matches the Usage Report tab's cache TTL expectation: shows a same-day total
// without re-fetching the full report history on every dashboard load. Manually
// refetching on the Usage Report tab (project.openportal-reports) updates the
// same react-query cache entry, so this widget picks up the fresh total too.
const USAGE_STALE_TIME = 12 * 60 * 60 * 1000;

const ManagedProjectCard: FC<{ mp: ManagedProject; project: Project }> = ({
  mp,
  project,
}) => {
  const details = mp.details;
  const embargo = embargoedUntil(mp);
  const unit = allocationUnit(details.allocation);
  const projectLinkUrl = details.project_link?.url;
  const breakdown =
    details.breakdown && Object.keys(details.breakdown).length > 0
      ? details.breakdown
      : null;

  const { data: usageReports } = useQuery({
    queryKey: ['openportal-usage-reports', project.uuid],
    queryFn: () => fetchUsageReports({ project_uuid: project.uuid }),
    enabled: Boolean(project.uuid),
    staleTime: USAGE_STALE_TIME,
  });

  const usedHours =
    usageReports === undefined
      ? undefined
      : usageReports.length > 0
        ? ProjectUsageReport.combine(usageReports).totalUsageHours()
        : 0;

  return (
    <Col md={6} sm={12} className="mb-5">
      <Panel cardBordered>
        <div className="d-flex align-items-stretch gap-3">
          <div className="flex-grow-1 d-flex flex-column gap-3">
            {details.allocation && (
              <div>
                <div className="fs-6 text-muted fw-bold mb-1">
                  {translate('Allocation')}
                </div>
                <div className="display-6 fw-boldest">{details.allocation}</div>
                {breakdown && (
                  <div className="mt-1 fs-7 text-muted">
                    {Object.entries(breakdown).map(([k, v]) => (
                      <span key={k} className="me-3">
                        {k}: {String(v)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
            {usedHours !== undefined && (
              <div>
                <div className="fs-6 text-muted fw-bold mb-1">
                  {translate('Used')}
                </div>
                <div className="display-6 fw-boldest">
                  {formatUsage(usedHours)}
                  {unit ? ` ${unit}` : ''}
                </div>
                <UsageProgressBar
                  percent={usagePercent(usedHours, details.allocation)}
                />
              </div>
            )}
            {embargo && (
              <AlertItem
                variant="warning"
                title={translate(
                  'This allocation is currently on hold until {date}.',
                  { date: formatDate(embargo) },
                )}
              />
            )}
          </div>

          {projectLinkUrl && (
            <ExternalCardLink url={projectLinkUrl}>
              {translate('Go to')}
              <br />
              {translate('award')}
            </ExternalCardLink>
          )}
        </div>
      </Panel>
    </Col>
  );
};

export const ManagedProjectDashboardCards: FC<Props> = ({
  managedProjects,
  project,
}) => (
  <>
    {managedProjects
      .filter((mp) => mp.state === 'approved' || mp.state === 'pending')
      .map((mp, index) => (
        <ManagedProjectCard
          key={`${mp.destination}-${mp.identifier || mp.local_identifier || index}`}
          mp={mp}
          project={project}
        />
      ))}
  </>
);

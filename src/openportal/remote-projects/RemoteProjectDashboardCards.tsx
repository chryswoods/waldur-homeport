import { useQuery } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { FC, ReactNode } from 'react';
import { Col } from 'react-bootstrap';
import {
  openportalRemoteProjectsTotalUsageRetrieve,
  type RemoteProject,
} from 'waldur-js-client';

import { AlertItem } from '@/core/AlertItem';
import { STALE_TIME } from '@/core/constants';
import { formatDate } from '@/core/dateUtils';
import { Link } from '@/core/Link';
import { Panel } from '@/core/Panel';
import { translate } from '@/i18n';

import {
  allocationUnit,
  ExternalCardLink,
  formatUsage,
  usagePercent,
  UsageProgressBar,
} from '../allocationUsage';

import { RemoteProjectStateField } from './RemoteProjectStateField';

interface Props {
  remoteProjects: RemoteProject[];
  customerEmail?: string;
}

/** link_project is either a bare URL string or a {url, id} link object. */
const getLinkUrl = (link: unknown): string | undefined => {
  if (!link) return undefined;
  if (typeof link === 'string') return link || undefined;
  if (typeof link !== 'object') return undefined;
  const l = link as Record<string, unknown>;
  return typeof l.url === 'string' && l.url ? l.url : undefined;
};

/** On hold, if approval is held more than a day out. */
const isEmbargoed = (earliestApprove: string | null | undefined): boolean => {
  if (!earliestApprove) return false;
  const dt = DateTime.fromISO(earliestApprove);
  return dt.isValid && dt.diffNow('hours').hours > 24;
};

/** Held so far out that naming the date would be meaningless. */
const isIndefiniteEmbargo = (
  earliestApprove: string | null | undefined,
): boolean => {
  if (!earliestApprove) return false;
  const dt = DateTime.fromISO(earliestApprove);
  return dt.isValid && dt.diffNow('years').years > 1;
};

const daysSince = (since: string | null | undefined): number => {
  if (!since) return 0;
  const dt = DateTime.fromISO(since);
  return dt.isValid ? DateTime.now().diff(dt, 'days').days : 0;
};

const RemoteProjectCard: FC<{
  rp: RemoteProject;
  customerEmail?: string;
}> = ({ rp, customerEmail }) => {
  const projectUrl = getLinkUrl(rp.link_project);
  const embargoed = isEmbargoed(rp.earliest_approve);
  const pendingTooLong =
    !embargoed && rp.has_pending_change && daysSince(rp.pending_since) > 7;
  const breakdown =
    rp.breakdown && Object.keys(rp.breakdown).length > 0 ? rp.breakdown : null;
  const unit = allocationUnit(rp.allocation_string);

  const { data: usageData } = useQuery({
    queryKey: ['remote-project-total-usage', rp.uuid],
    queryFn: () =>
      openportalRemoteProjectsTotalUsageRetrieve({
        path: { uuid: rp.uuid },
      }).then((r) => r.data?.total_hours as number | undefined),
    staleTime: STALE_TIME,
  });

  const mailtoHref = customerEmail
    ? `mailto:${customerEmail}?subject=${encodeURIComponent(
        `Query about remote project ${rp.identifier ?? ''} on ${rp.destination}`,
      )}`
    : undefined;

  const allocatorLink: ReactNode = mailtoHref ? (
    <>
      {translate('If you have any questions, please')}{' '}
      <a href={mailtoHref}>{translate('email your allocator')}</a>.
    </>
  ) : (
    translate('If you have any questions, please contact your allocator.')
  );

  return (
    <Col md={6} sm={12} className="mb-5">
      <Panel
        title={
          <div className="d-flex justify-content-between align-items-center gap-3 w-100">
            <div>
              {rp.resource_uuid ? (
                <Link
                  state="marketplace-resource-details"
                  params={{ resource_uuid: rp.resource_uuid }}
                >
                  {rp.resource_name ?? rp.destination}
                </Link>
              ) : (
                <span>{rp.resource_name ?? rp.destination}</span>
              )}
              {rp.resource_name && (
                <div className="fs-7 fw-normal text-muted mt-1">
                  {rp.destination}
                </div>
              )}
            </div>
            {rp.state && <RemoteProjectStateField project={rp} />}
          </div>
        }
        cardBordered
      >
        <div className="d-flex align-items-stretch gap-3">
          <div className="flex-grow-1 d-flex flex-column gap-2">
            {(rp.allocation_string || rp.current_allocation) && (
              <div>
                <span className="text-muted me-2">
                  {translate('Allocation:')}
                </span>
                <span className="fw-semibold">
                  {rp.allocation_string ?? rp.current_allocation}
                </span>
                {rp.has_pending_change && rp.pending_allocation && (
                  <span className="text-muted ms-2 fs-7">
                    ({translate('pending:')} {rp.pending_allocation})
                  </span>
                )}
                {breakdown && (
                  <div className="ms-2 mt-1 fs-7 text-muted">
                    {Object.entries(breakdown).map(([k, v]) => (
                      <span key={k} className="me-3">
                        {k}: {String(v)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
            {usageData !== undefined && (
              <div>
                <div>
                  <span className="text-muted me-2">{translate('Used:')}</span>
                  <span className="fw-semibold">
                    {formatUsage(usageData)}
                    {unit ? ` ${unit}` : ''}
                  </span>
                </div>
                <UsageProgressBar
                  percent={usagePercent(
                    usageData,
                    rp.allocation_string,
                    rp.current_allocation,
                  )}
                />
              </div>
            )}
            {rp.identifier && (
              <div className="fs-7 text-muted">
                <span className="me-2">{translate('Identifier:')}</span>
                <code>{rp.identifier}</code>
              </div>
            )}
            {!projectUrl && rp.state !== 'active' && (
              <AlertItem
                variant="warning"
                title={
                  embargoed
                    ? isIndefiniteEmbargo(rp.earliest_approve)
                      ? translate(
                          'Allocation of this resource is currently on hold.',
                        )
                      : translate(
                          'This resource will not be allocated before {date}.',
                          { date: formatDate(rp.earliest_approve) },
                        )
                    : translate(
                        'The allocated resource is not yet ready. This can take up to 5 working days.',
                      )
                }
                body={allocatorLink}
              />
            )}
          </div>

          {projectUrl && (
            <ExternalCardLink url={projectUrl}>
              {translate('Go to')}
              <br />
              {translate('project')}
            </ExternalCardLink>
          )}
        </div>

        {pendingTooLong && (
          <AlertItem
            variant="warning"
            className="mt-3"
            title={translate(
              'It looks like it is taking longer than normal to make this change.',
            )}
            body={allocatorLink}
          />
        )}
        {rp.state === 'error' && (
          <AlertItem
            variant="error"
            className="mt-3"
            title={translate(
              'The allocation of the resource failed or is in an error state.',
            )}
            body={allocatorLink}
          />
        )}
      </Panel>
    </Col>
  );
};

export const RemoteProjectDashboardCards: FC<Props> = ({
  remoteProjects,
  customerEmail,
}) => (
  <>
    {remoteProjects
      .filter((rp) => rp.state !== 'deleted')
      .map((rp) => (
        <RemoteProjectCard
          key={rp.uuid}
          rp={rp}
          customerEmail={customerEmail}
        />
      ))}
  </>
);

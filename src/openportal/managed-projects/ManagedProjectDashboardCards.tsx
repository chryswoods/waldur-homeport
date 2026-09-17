import { FC } from 'react';
import { Col } from 'react-bootstrap';
import { type ManagedProject, type Project } from 'waldur-js-client';

import { AlertItem } from '@/core/AlertItem';
import { formatDate } from '@/core/dateUtils';
import { defaultCurrency } from '@/core/formatCurrency';
import { Panel } from '@/core/Panel';
import { translate } from '@/i18n';

import {
  ExternalCardLink,
  percentOf,
  UsageProgressBar,
} from '../allocationUsage';
import { useProjectAccountingSummary } from '../useProjectAccountingSummary';

import { embargoedUntil } from './utils';

interface Props {
  managedProjects: ManagedProject[];
  project: Project;
}

const ManagedProjectCard: FC<{ mp: ManagedProject; project: Project }> = ({
  mp,
  project,
}) => {
  const details = mp.details;
  const embargo = embargoedUntil(mp);
  // The button beside the card reads "Go to award", so it links to the award
  // on the funder's system, not to project_link — which points at the project
  // page on the awarding portal and is a different destination.
  const awardUrl = details.award?.url;
  const breakdown =
    details.breakdown && Object.keys(details.breakdown).length > 0
      ? details.breakdown
      : null;

  const { data: accounting } = useProjectAccountingSummary(project.uuid);

  // allocation_credits is null when the award has no resolvable project
  // template or no allocation to convert, in which case there is a usage
  // figure but nothing to measure it against.
  const allocationCredits = accounting?.allocation_credits ?? null;
  const showAccounting = Boolean(accounting?.has_award);

  return (
    <Col md={6} sm={12} className="mb-5">
      <Panel cardBordered>
        <div className="d-flex align-items-stretch gap-3">
          <div className="flex-grow-1 d-flex flex-column gap-3">
            {showAccounting && allocationCredits !== null && (
              <div>
                <div className="fs-6 text-muted fw-bold mb-1">
                  {translate('Allocation')}
                </div>
                <div className="display-6 fw-boldest">
                  {defaultCurrency(allocationCredits)}
                </div>
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
            {showAccounting && accounting && (
              <div>
                <div className="fs-6 text-muted fw-bold mb-1">
                  {translate('Used')}
                </div>
                <div className="display-6 fw-boldest">
                  {defaultCurrency(accounting.usage_credits)}
                </div>
                {allocationCredits !== null && (
                  <>
                    <UsageProgressBar
                      percent={percentOf(
                        accounting.usage_credits,
                        allocationCredits,
                      )}
                    />
                    {accounting.remaining_credits !== null && (
                      <div className="fs-8 text-muted mt-1">
                        {translate('{amount} remaining', {
                          amount: defaultCurrency(accounting.remaining_credits),
                        })}
                      </div>
                    )}
                  </>
                )}
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

          {awardUrl && (
            <ExternalCardLink url={awardUrl}>
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

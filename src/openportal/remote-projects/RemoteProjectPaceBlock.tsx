import { useQueries } from '@tanstack/react-query';
import { FC, useMemo, useState } from 'react';
import { Col, Nav, Row } from 'react-bootstrap';
import { type RemoteProject } from 'waldur-js-client';

import { translate } from '@/i18n';
import { AwardPaceCard } from '@/openportal/award-pace/AwardPaceCard';

import {
  buildRemoteProjectPace,
  isPaced,
  orderByUsage,
  remotePaceUnits,
  remoteProjectLabel,
} from './remotePace';
import { RemoteProjectStateField } from './RemoteProjectStateField';
import { remoteProjectUsageQuery } from './remoteProjectUsage';

/** The connection's name, with its state beside it unless it is active. */
const ConnectionLabel: FC<{ remoteProject: RemoteProject }> = ({
  remoteProject,
}) => (
  <span className="d-inline-flex align-items-center gap-2">
    {remoteProjectLabel(remoteProject)}
    {remoteProject.state !== 'active' && (
      <RemoteProjectStateField project={remoteProject} />
    )}
  </span>
);

interface Props {
  remoteProjects: RemoteProject[];
  projectEndDate?: string | null;
}

/**
 * Award pace for each remote project connection, one at a time.
 *
 * Active, pending and stale connections are shown; see PACED_STATES.
 *
 * Each connection is its own allocation, in its own unit, over its own window,
 * so they are never added together: "3,000 GPUHR and 40,000 CPUHR" has no
 * single pace. One connection gets the card on its own; more than one get tabs
 * across the top of it, busiest first.
 *
 * The usage figures come from the same cached requests as the connection cards
 * above, so this adds no calls of its own. Nothing renders until every figure
 * is in — sorting as they arrive would reshuffle the tabs under the reader.
 */
export const RemoteProjectPaceBlock: FC<Props> = ({
  remoteProjects,
  projectEndDate,
}) => {
  const paced = useMemo(() => remoteProjects.filter(isPaced), [remoteProjects]);
  const usage = useQueries({
    queries: paced.map((rp) => remoteProjectUsageQuery(rp.uuid)),
  });
  const loading = usage.some((query) => query.isLoading);
  const paces = loading
    ? []
    : orderByUsage(
        paced
          .map((rp, i) =>
            buildRemoteProjectPace(rp, usage[i]?.data, projectEndDate),
          )
          .filter(Boolean),
      );

  const [selected, setSelected] = useState<string | null>(null);

  if (paces.length === 0) {
    return null;
  }
  const current =
    paces.find((entry) => entry.remoteProject.uuid === selected) ?? paces[0];

  const toolbar =
    paces.length > 1 ? (
      <Nav
        variant="tabs"
        role="tablist"
        className="nav-line-tabs mb-5"
        activeKey={current.remoteProject.uuid}
        onSelect={(key) => setSelected(key)}
      >
        {paces.map(({ remoteProject }) => (
          <Nav.Item key={remoteProject.uuid}>
            <Nav.Link as="button" eventKey={remoteProject.uuid}>
              <ConnectionLabel remoteProject={remoteProject} />
            </Nav.Link>
          </Nav.Item>
        ))}
      </Nav>
    ) : (
      <div className="fw-semibold mb-4">
        <ConnectionLabel remoteProject={current.remoteProject} />
      </div>
    );

  return (
    <Row>
      <Col xs={12}>
        <AwardPaceCard
          pace={current.pace}
          units={remotePaceUnits(current.unit)}
          toolbar={
            <>
              {toolbar}
              {current.remoteProject.state !== 'active' && (
                <p className="text-muted mb-5">
                  {translate(
                    'This connection is not active at the moment, so these figures are the last the remote portal reported and may be out of date.',
                  )}
                </p>
              )}
            </>
          }
        />
      </Col>
    </Row>
  );
};

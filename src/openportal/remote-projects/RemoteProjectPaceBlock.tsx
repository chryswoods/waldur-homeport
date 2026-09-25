import { useQueries } from '@tanstack/react-query';
import { FC, useMemo, useState } from 'react';
import { Col, Nav, Row } from 'react-bootstrap';
import { type RemoteProject } from 'waldur-js-client';

import { AwardPaceCard } from '@/openportal/award-pace/AwardPaceCard';

import {
  buildRemoteProjectPace,
  orderByUsage,
  remotePaceUnits,
  remoteProjectLabel,
} from './remotePace';
import { remoteProjectUsageQuery } from './remoteProjectUsage';

interface Props {
  remoteProjects: RemoteProject[];
  projectEndDate?: string | null;
}

/**
 * Award pace for each remote project connection, one at a time.
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
  const active = useMemo(
    () => remoteProjects.filter((rp) => rp.state === 'active'),
    [remoteProjects],
  );
  const usage = useQueries({
    queries: active.map((rp) => remoteProjectUsageQuery(rp.uuid)),
  });
  const loading = usage.some((query) => query.isLoading);
  const paces = loading
    ? []
    : orderByUsage(
        active
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
              {remoteProjectLabel(remoteProject)}
            </Nav.Link>
          </Nav.Item>
        ))}
      </Nav>
    ) : (
      <div className="fw-semibold mb-4">
        {remoteProjectLabel(current.remoteProject)}
      </div>
    );

  return (
    <Row>
      <Col xs={12}>
        <AwardPaceCard
          pace={current.pace}
          units={remotePaceUnits(current.unit)}
          toolbar={toolbar}
        />
      </Col>
    </Row>
  );
};

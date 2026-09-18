import { useQuery } from '@tanstack/react-query';
import { FC } from 'react';
import { Col, Row } from 'react-bootstrap';
import { type ManagedProject, projectCreditsList } from 'waldur-js-client';

import { SHORT_STALE_TIME } from '@/core/constants';
import { useAwardPace } from '@/openportal/award-pace/useAwardPace';
import { useProjectAccountingSummary } from '@/openportal/useProjectAccountingSummary';
import { Project } from '@/workspace/types';

import { usePolicyWatchData } from './usePolicyWatchData';
import { HealthView } from './views/HealthView';

interface Props {
  project: Project;
  /**
   * True when the project is backed by an OpenPortal award, so its figures come
   * from the award ("absolute") accounting rather than Waldur's credit ledger.
   * Decided by the dashboard, which already establishes it for the award card.
   */
  hasAward?: boolean;
  /** The award attached now, whose window the pace card measures against. */
  award?: ManagedProject | null;
}

/**
 * The Health view — pacing, credit lifecycle, and per-resource state — shown as
 * a first-class dashboard block for projects that have a credit allocation.
 *
 * Without an allocation there is no credit widget at all, and the block must
 * not pay for one either: the credit lookup is a single list call, and only a
 * hit mounts the inner component whose hook fans out to policies, resources,
 * invoices and organization credit.
 */
export const ProjectCreditHealthBlock: FC<Props> = ({
  project,
  hasAward,
  award,
}) => {
  const { data: credit } = useQuery({
    queryKey: ['policy-watch-project-credit', project?.uuid],
    queryFn: () =>
      projectCreditsList({ query: { project_uuid: project.uuid } }).then((r) =>
        r.data && r.data.length > 0 ? r.data[0] : null,
      ),
    enabled: Boolean(project?.uuid),
    staleTime: SHORT_STALE_TIME,
    refetchOnWindowFocus: false,
  });

  if (!credit) {
    return null;
  }
  return <CreditHealth project={project} hasAward={hasAward} award={award} />;
};

const CreditHealth: FC<Props> = ({ project, hasAward, award }) => {
  // Shares the award card's request rather than adding one: same query key.
  const { data: awardAccounting } = useProjectAccountingSummary(
    project?.uuid,
    Boolean(hasAward),
  );
  // Passed whenever an award is attached, including when its allocation does
  // not resolve: that is still enough to know the credit ledger is not this
  // project's accounting, and a breakdown with nothing to show is better than
  // one that is wrong.
  const data = usePolicyWatchData(
    project,
    awardAccounting?.has_award ? awardAccounting : null,
  );
  const awardPace = useAwardPace(
    award,
    awardAccounting,
    project?.uuid,
    project?.end_date,
  );

  if (data.isLoading || data.hasError || !data.runway.credit) {
    return null;
  }

  return (
    <Row className="mt-3">
      <Col xs={12} className="mb-3">
        <HealthView
          data={data}
          awardPace={awardPace}
          projectUuid={project?.uuid}
        />
      </Col>
    </Row>
  );
};

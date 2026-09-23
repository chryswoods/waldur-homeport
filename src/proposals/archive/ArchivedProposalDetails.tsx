import { useQuery } from '@tanstack/react-query';
import { useCurrentStateAndParams } from '@uirouter/react';
import { FC } from 'react';
import { Col, Row } from 'react-bootstrap';
import { proposalArchiveProposalsRetrieve } from 'waldur-js-client';

import { formatDate } from '@/core/dateUtils';
import { LoadingErred } from '@/core/LoadingErred';
import { LoadingSpinner } from '@/core/LoadingSpinner';
import { Panel } from '@/core/Panel';
import FormTable from '@/form/FormTable';
import { translate } from '@/i18n';
import { useTitle } from '@/navigation/title';
import { renderFieldOrDash } from '@/table/utils';

import { ArchivedDocumentList } from './ArchivedDocumentList';
import { ArchivedMembershipsTable } from './ArchivedMembershipsTable';
import { ArchivedProposalNotes } from './ArchivedProposalNotes';
import { ArchivedRequestedResources } from './ArchivedRequestedResources';
import { ArchivedReviewsPanel } from './ArchivedReviewsPanel';
import { useArchivedProposalNotes } from './useArchivedProposalNotes';
import {
  ArchivedProposalStateBadge,
  ArchiveNotice,
  RecordedName,
} from './utils';

export const ArchivedProposalDetails: FC = () => {
  const {
    params: { uuid },
  } = useCurrentStateAndParams();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['archived-proposal', uuid],
    queryFn: () =>
      proposalArchiveProposalsRetrieve({ path: { uuid } }).then((r) => r.data),
    refetchOnWindowFocus: false,
  });

  // Fetched here rather than inside the panel so the 404 an applicant gets is
  // handled in one place; see useArchivedProposalNotes.
  const { notes } = useArchivedProposalNotes(uuid);

  useTitle(data?.name ?? translate('Archived proposal'));

  if (isLoading) return <LoadingSpinner />;
  if (error) {
    return (
      <LoadingErred
        message={translate('Unable to load the archived proposal.')}
        loadData={refetch}
      />
    );
  }
  if (!data) return null;

  return (
    <>
      <ArchiveNotice />
      <Row>
        <Col lg={6} className="mb-6">
          <Panel title={data.name} cardBordered>
            <FormTable>
              <FormTable.Item
                label={translate('State')}
                value={<ArchivedProposalStateBadge state={data.state} />}
              />
              {/* The call name as recorded, not a link: an applicant may read
                  their own archived proposal but not the call it belongs to. */}
              <FormTable.Item
                label={translate('Call')}
                value={renderFieldOrDash(data.call_name)}
              />
              <FormTable.Item
                label={translate('Applicant')}
                value={
                  <RecordedName
                    name={data.created_by_full_name}
                    username={data.created_by_username}
                  />
                }
              />
              <FormTable.Item
                label={translate('Project')}
                value={<RecordedName name={data.project_name} />}
              />
              <FormTable.Item
                label={translate('Submitted')}
                value={
                  data.submitted_at
                    ? formatDate(data.submitted_at)
                    : renderFieldOrDash(null)
                }
              />
              <FormTable.Item
                label={translate('Duration')}
                value={
                  data.duration_in_days
                    ? translate('{count} days', {
                        count: String(data.duration_in_days),
                      })
                    : renderFieldOrDash(null)
                }
              />
              <FormTable.Item
                label={translate('Confidential')}
                value={
                  data.project_is_confidential
                    ? translate('Yes')
                    : translate('No')
                }
              />
              <FormTable.Item
                label={translate('Civilian purpose')}
                value={
                  data.project_has_civilian_purpose
                    ? translate('Yes')
                    : translate('No')
                }
              />
              <FormTable.Item
                label={translate('Field of science')}
                value={renderFieldOrDash(data.oecd_fos_2007_code)}
              />
            </FormTable>
          </Panel>
        </Col>
        <Col lg={6} className="mb-6">
          <Panel title={translate('Project')} cardBordered>
            <FormTable>
              <FormTable.Item
                label={translate('Summary')}
                value={renderFieldOrDash(data.project_summary)}
              />
              <FormTable.Item
                label={translate('Description')}
                value={renderFieldOrDash(data.description)}
              />
              <FormTable.Item
                label={translate('Allocation comment')}
                value={renderFieldOrDash(data.allocation_comment)}
              />
            </FormTable>
          </Panel>
        </Col>
      </Row>
      <Row>
        <Col lg={6} className="mb-6">
          <ArchivedRequestedResources resources={data.requested_resources} />
        </Col>
        <Col lg={6} className="mb-6">
          <ArchivedDocumentList documents={data.documents} />
        </Col>
      </Row>
      <div className="mb-6">
        <ArchivedMembershipsTable memberships={data.memberships} />
      </div>
      <div className="mb-6">
        <ArchivedProposalNotes notes={notes} />
      </div>
      <div className="mb-6">
        <ArchivedReviewsPanel proposalUuid={uuid} />
      </div>
    </>
  );
};

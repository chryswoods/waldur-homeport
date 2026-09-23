import { useQuery } from '@tanstack/react-query';
import { useCurrentStateAndParams } from '@uirouter/react';
import { FC } from 'react';
import { Col, Row } from 'react-bootstrap';
import { proposalArchiveCallsRetrieve } from 'waldur-js-client';

import { formatDate } from '@/core/dateUtils';
import { Link } from '@/core/Link';
import { LoadingErred } from '@/core/LoadingErred';
import { LoadingSpinner } from '@/core/LoadingSpinner';
import { Panel } from '@/core/Panel';
import FormTable from '@/form/FormTable';
import { translate } from '@/i18n';
import { useTitle } from '@/navigation/title';
import { renderFieldOrDash } from '@/table/utils';

import { ArchivedDocumentList } from './ArchivedDocumentList';
import { ArchivedRoundsTable } from './ArchivedRoundsTable';
import { ArchivedCallStateBadge, ArchiveNotice, RecordedName } from './utils';

export const ArchivedCallDetails: FC = () => {
  const {
    params: { uuid },
  } = useCurrentStateAndParams();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['archived-call', uuid],
    queryFn: () =>
      proposalArchiveCallsRetrieve({ path: { uuid } }).then((r) => r.data),
    refetchOnWindowFocus: false,
  });

  useTitle(data?.name ?? translate('Archived call'));

  if (isLoading) return <LoadingSpinner />;
  if (error) {
    return (
      <LoadingErred
        message={translate('Unable to load the archived call.')}
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
                value={<ArchivedCallStateBadge state={data.state} />}
              />
              <FormTable.Item
                label={translate('Managing organisation')}
                value={<RecordedName name={data.customer_name} />}
              />
              <FormTable.Item
                label={translate('Created by')}
                value={
                  <RecordedName
                    name={data.created_by_full_name}
                    username={data.created_by_username}
                  />
                }
              />
              <FormTable.Item
                label={translate('Created')}
                value={formatDate(data.created)}
              />
              <FormTable.Item
                label={translate('Proposals')}
                value={
                  <Link
                    state="proposal-archive-proposals"
                    params={{ call: data.uuid }}
                    label={translate('{count} proposals', {
                      count: String(data.proposal_count),
                    })}
                  />
                }
              />
              <FormTable.Item
                label={translate('Description')}
                value={renderFieldOrDash(data.description)}
              />
            </FormTable>
          </Panel>
        </Col>
        <Col lg={6} className="mb-6">
          <ArchivedDocumentList documents={data.documents} />
        </Col>
      </Row>
      <ArchivedRoundsTable rounds={data.rounds} />
    </>
  );
};

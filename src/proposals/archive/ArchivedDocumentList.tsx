import { FC, useMemo } from 'react';
import {
  type ArchivedCallDocument,
  type ArchivedProposalDocument,
} from 'waldur-js-client';

import { formatDate } from '@/core/dateUtils';
import { Panel } from '@/core/Panel';
import { formatFilesize } from '@/core/utils';
import { translate } from '@/i18n';
import Table from '@/table/Table';
import { useTable } from '@/table/useTable';
import { renderFieldOrDash } from '@/table/utils';

type AnyArchivedDocument = ArchivedCallDocument | ArchivedProposalDocument;

interface Props {
  documents: AnyArchivedDocument[];
  title?: string;
}

/**
 * The documents hanging off an archived call or proposal.
 *
 * The rows come with the parent record, so the table resolves them directly
 * rather than fetching. `file` is used exactly as the serializer gives it: the
 * archive deliberately moved its media rows onto their own storage prefixes
 * (`archived_call_documents/`, `archived_proposal_documentation/`) because the
 * live proposal app owns the original prefixes and would deny them.
 */
export const ArchivedDocumentList: FC<Props> = ({ documents, title }) => {
  const rows = documents ?? [];
  const tableProps = useTable({
    table: `archived-documents-${rows.map((d) => d.uuid).join('-') || 'empty'}`,
    fetchData: () => Promise.resolve({ rows, resultCount: rows.length }),
  });

  const columns = useMemo(
    () => [
      {
        title: translate('File'),
        render: ({ row }: { row: AnyArchivedDocument }) =>
          row.file ? (
            <a href={row.file} target="_blank" rel="noopener noreferrer">
              {row.file_name}
            </a>
          ) : (
            <>{renderFieldOrDash(row.file_name)}</>
          ),
      },
      {
        title: translate('Size'),
        render: ({ row }: { row: AnyArchivedDocument }) => (
          <>{formatFilesize(row.file_size)}</>
        ),
      },
      {
        title: translate('Added'),
        render: ({ row }: { row: AnyArchivedDocument }) => (
          <>{formatDate(row.created)}</>
        ),
      },
    ],
    [],
  );

  return (
    <Panel title={title ?? translate('Documents')} cardBordered>
      <Table
        {...tableProps}
        columns={columns}
        verboseName={translate('documents')}
        hideTitle
        hasActionBar={false}
        placeholderHasRetry={false}
      />
    </Panel>
  );
};

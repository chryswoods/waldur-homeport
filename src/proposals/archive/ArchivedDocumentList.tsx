import { FC, useMemo, useState } from 'react';
import {
  type ArchivedCallDocument,
  type ArchivedProposalDocument,
} from 'waldur-js-client';

import { BaseButton } from 'waldur-ui';

import { formatDate } from '@/core/dateUtils';
import { Panel } from '@/core/Panel';
import { formatFilesize } from '@/core/utils';
import { downloadFile } from '@/form/upload/FileDownloader';
import { translate } from '@/i18n';
import { useNotify } from '@/store/notify';
import Table from '@/table/Table';
import { useTable } from '@/table/useTable';
import { renderFieldOrDash } from '@/table/utils';

type AnyArchivedDocument = ArchivedCallDocument | ArchivedProposalDocument;

/** The file's own name: `file_name` is its storage path. */
export const documentName = (path: string | null | undefined) =>
  path ? path.slice(path.lastIndexOf('/') + 1) : path;

/** `file_size` is in bytes; null when the document has no stored file. */
export const documentSize = (bytes: number | null | undefined) => {
  if (bytes === null || bytes === undefined) {
    return renderFieldOrDash(null);
  }
  return bytes === 0 ? '0 B' : String(formatFilesize(bytes, 'B'));
};

/**
 * Downloads a document with the API token. The media endpoint answers an
 * anonymous request with 404, which is what a plain link would make.
 */
const DocumentDownload: FC<{ url: string; name: string; path: string }> = ({
  url,
  name,
  path,
}) => {
  const { showErrorResponse } = useNotify();
  const [loading, setLoading] = useState(false);
  const download = async () => {
    setLoading(true);
    try {
      await downloadFile(url, name);
    } catch (error) {
      showErrorResponse(error, translate('File download failed'));
    } finally {
      setLoading(false);
    }
  };
  return (
    <BaseButton
      variant="text-primary"
      size="sm"
      label={name}
      title={path}
      pending={loading}
      onClick={download}
    />
  );
};

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
        render: ({ row }: { row: AnyArchivedDocument }) => {
          const name = documentName(row.file_name);
          return row.file && name ? (
            <DocumentDownload url={row.file} name={name} path={row.file_name} />
          ) : (
            <span title={row.file_name}>{renderFieldOrDash(name)}</span>
          );
        },
      },
      {
        title: translate('Size'),
        render: ({ row }: { row: AnyArchivedDocument }) => (
          <>{documentSize(row.file_size)}</>
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

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { downloadFile } from '@/form/upload/FileDownloader';
import { useNotify } from '@/store/notify';
import { renderWithProviders } from '@/test/harness';

import {
  ArchivedDocumentList,
  documentName,
  documentSize,
} from './ArchivedDocumentList';

vi.mock('@/form/upload/FileDownloader', () => ({ downloadFile: vi.fn() }));
// The table renders through the app's store; a stand-in renders its cells.
vi.mock('@/table/useTable', async () => {
  const { useEffect, useState } = await import('react');
  return {
    useTable: ({ fetchData }) => {
      const [rows, setRows] = useState([]);
      useEffect(() => {
        fetchData().then((result) => setRows(result.rows));
      }, [fetchData]);
      return { rows };
    },
  };
});
vi.mock('@/table/Table', () => ({
  default: ({ columns, rows }) => (
    <ul>
      {(rows ?? []).map((row) => (
        <li key={row.uuid}>
          {columns.map((column) => (
            <span key={column.title}>{column.render({ row })}</span>
          ))}
        </li>
      ))}
    </ul>
  ),
}));

const doc = (overrides = {}): any => ({
  uuid: 'd1',
  file: '/api/media/abc/',
  file_name: 'archived_proposal_documentation/plan.pdf',
  file_size: 56730,
  created: '2025-03-01T10:00:00Z',
  ...overrides,
});

describe('documentName and documentSize', () => {
  it('takes the name after the storage path', () => {
    expect(documentName('archived_proposal_documentation/plan.pdf')).toBe(
      'plan.pdf',
    );
    expect(documentName('plan.pdf')).toBe('plan.pdf');
  });

  it('reads the size as bytes', () => {
    expect(documentSize(56730)).toBe('55.4 KB');
    expect(documentSize(3 * 1024 * 1024)).toBe('3 MB');
  });

  it('shows a dash for a document with no stored file', () => {
    expect(documentSize(null)).toBe('—');
  });
});

describe('ArchivedDocumentList', () => {
  beforeEach(() => vi.clearAllMocks());

  it('downloads the file with the API token, under its own name', async () => {
    vi.mocked(downloadFile).mockResolvedValue(undefined);
    renderWithProviders(<ArchivedDocumentList documents={[doc()]} />);

    const button = await screen.findByRole('button', { name: 'plan.pdf' });
    expect(button).toHaveAttribute(
      'title',
      'archived_proposal_documentation/plan.pdf',
    );
    await userEvent.click(button);
    expect(downloadFile).toHaveBeenCalledWith('/api/media/abc/', 'plan.pdf');
  });

  it('says why a download failed', async () => {
    const error = { status: 404 };
    vi.mocked(downloadFile).mockRejectedValue(error);
    renderWithProviders(<ArchivedDocumentList documents={[doc()]} />);
    await userEvent.click(
      await screen.findByRole('button', { name: 'plan.pdf' }),
    );
    await waitFor(() =>
      expect(useNotify().showErrorResponse).toHaveBeenCalledWith(
        error,
        'File download failed',
      ),
    );
  });

  it('keeps a document with no file as plain text', async () => {
    renderWithProviders(
      <ArchivedDocumentList
        documents={[doc({ file: null, file_size: null })]}
      />,
    );
    expect(await screen.findByText('plan.pdf')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

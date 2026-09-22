import { screen } from '@testing-library/dom';
import { FC } from 'react';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import { describe, expect, it, vi } from 'vitest';

import { DrawerProvider } from '@/drawer/DrawerContext';
import { isFeatureVisible } from '@/features/connect';
import { useTable } from '@/table/useTable';
import { renderWithProviders } from '@/test/harness';

import { TeamTableComponent } from './TeamTableComponent';

vi.mock('@/features/connect');

// Avoid real API calls; rows are supplied through the mocked redux table state.
vi.mock('@/table/useTableQuery', () => ({
  useTableQuery: () => ({
    data: undefined,
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

const mockStore = configureStore();
const rowId = 'member-uuid-1';
const row = {
  uuid: rowId,
  full_name: 'John Doe',
  email: 'john.doe@example.com',
  username: 'john.doe@example.com',
  slug: 'johndoe',
  role_name: 'owner',
  expiration_time: '2025-12-31T23:59:59Z',
};
const tableId = 'team-table-test';
const store = mockStore({
  tables: {
    [tableId]: {
      loading: false,
      entities: { [rowId]: row },
      order: [rowId],
      pagination: { pageSize: 10, resultCount: 1, currentPage: 1 },
      toggled: {},
      activeColumns: {},
      columnPositions: [],
    },
  },
});

// Renders the real TeamTableComponent through the real Table (TableLoader),
// so the feature-gated `!hideExpiration && {…}` column entry actually flows
// through the central falsy-column filter. hasOptionalColumns is disabled so
// the visible set maps 1:1 to the declared columns for a clean count.
const Harness: FC<{ hideExpiration?: boolean }> = ({ hideExpiration }) => {
  const props = useTable({ table: tableId, fetchData: vi.fn() as any });
  return (
    <TeamTableComponent
      {...props}
      context="organization"
      hideExpiration={hideExpiration}
      hasOptionalColumns={false}
      enableExport={false}
    />
  );
};

const renderTable = (hideExpiration?: boolean) =>
  renderWithProviders(
    <Provider store={store}>
      <DrawerProvider>
        <Harness hideExpiration={hideExpiration} />
      </DrawerProvider>
    </Provider>,
  );

const assertHeaderBodyAligned = async () => {
  // Wait for the single body row to render.
  await screen.findByText('John Doe');
  // A leftover falsy column entry would add a <th> with no matching <td>,
  // shifting every later column. With one data row, the body cell count must
  // match the header count.
  const headers = screen.getAllByRole('columnheader');
  const cells = screen.getAllByRole('cell');
  expect(cells).toHaveLength(headers.length);
};

describe('TeamTableComponent falsy column guard', () => {
  it('drops the feature-gated column when its flag is off, keeping rows aligned', async () => {
    renderTable(true);

    // `!hideExpiration && {…}` yields a falsy entry that must be dropped.
    expect(screen.queryByText('Role expiration')).not.toBeInTheDocument();
    await assertHeaderBodyAligned();
  });

  it('renders the feature-gated column when its flag is on, still aligned', async () => {
    renderTable(false);

    expect(await screen.findByText('Role expiration')).toBeInTheDocument();
    await assertHeaderBodyAligned();
  });
});

describe('TeamTableComponent username column', () => {
  const enableFlags = (...flags: string[]) =>
    vi
      .mocked(isFeatureVisible)
      .mockImplementation((flag: any) => flags.includes(flag));

  /** The text of the body cell under the "Username" header. */
  const usernameCell = async () => {
    await screen.findByText('John Doe');
    const index = screen
      .getAllByRole('columnheader')
      .findIndex((th) => th.textContent?.includes('Username'));
    expect(index).toBeGreaterThanOrEqual(0);
    return screen.getAllByRole('cell')[index].textContent;
  };

  it('shows user.username by default', async () => {
    enableFlags('user.show_username');
    renderTable(true);

    expect(await usernameCell()).toContain('john.doe@example.com');
  });

  // Where the deployment identifies users by their OpenPortal username,
  // user.username may be the email address, which is what this replaces.
  it('shows the slug instead when the OpenPortal identifier is enabled', async () => {
    enableFlags('user.show_openportal_identifier');
    renderTable(true);

    const text = await usernameCell();
    expect(text).toContain('johndoe');
    expect(text).not.toContain('john.doe@example.com');
  });

  it('shows the column without needing show_username as well', async () => {
    enableFlags('user.show_openportal_identifier');
    renderTable(true);

    await expect(usernameCell()).resolves.toBeTruthy();
  });
});

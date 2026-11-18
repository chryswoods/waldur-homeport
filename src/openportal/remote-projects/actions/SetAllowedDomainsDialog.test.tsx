import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  openportalRemoteProjectsSetAllowedDomains,
  type RemoteProject,
} from 'waldur-js-client';

import { renderWithProviders } from '@/test/harness';

import { SetAllowedDomainsDialog } from './SetAllowedDomainsDialog';

const renderDialog = (allowed_domains: string[] | null) =>
  renderWithProviders(
    <SetAllowedDomainsDialog
      row={{ uuid: 'rp-1', allowed_domains } as RemoteProject}
      resolve={{ refetch: vi.fn() }}
    />,
  );

const allowAll = () => screen.getByLabelText('Allow all domains');
const save = () =>
  userEvent.click(screen.getByRole('button', { name: 'Save' }));
const sent = () =>
  vi.mocked(openportalRemoteProjectsSetAllowedDomains).mock.calls[0][0].body
    .allowed_domains;

describe('SetAllowedDomainsDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(openportalRemoteProjectsSetAllowedDomains).mockResolvedValue(
      {} as any,
    );
  });

  it('starts with every domain allowed when the project has no list', () => {
    renderDialog(null);
    expect(allowAll()).toBeChecked();
    expect(
      screen.queryByText('Allowed email domain patterns'),
    ).not.toBeInTheDocument();
  });

  it('sends no list at all to allow every domain', async () => {
    renderDialog(['*.ac.uk']);
    expect(allowAll()).not.toBeChecked();

    await userEvent.click(allowAll());
    await save();

    await waitFor(() => expect(sent()).toBeNull());
  });

  it('sends the list when only some domains may join', async () => {
    renderDialog(['*.ac.uk', 'example.org']);
    await save();

    await waitFor(() => expect(sent()).toEqual(['*.ac.uk', 'example.org']));
  });

  it('keeps an empty list, which lets nobody join', async () => {
    renderDialog([]);
    expect(allowAll()).not.toBeChecked();
    expect(
      screen.getByText(/An empty list means nobody may join/),
    ).toBeInTheDocument();

    await save();

    await waitFor(() => expect(sent()).toEqual([]));
  });
});

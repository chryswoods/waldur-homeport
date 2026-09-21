import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/harness';

import { OpenPortalUsernameField } from './OpenPortalUsernameField';
import { useOpenPortalUsername } from './useOpenPortalUsername';

vi.mock('./useOpenPortalUsername');

const user: any = { uuid: 'user-1', url: '/api/users/user-1/' };

const mockState = (state: Partial<ReturnType<typeof useOpenPortalUsername>>) =>
  vi.mocked(useOpenPortalUsername).mockReturnValue({
    shortname: null,
    isLoading: false,
    error: null,
    setShortname: vi.fn(),
    ...state,
  } as any);

describe('OpenPortalUsernameField', () => {
  beforeEach(() => vi.clearAllMocks());

  it('offers an edit control while no username has been chosen', () => {
    mockState({ shortname: null });
    renderWithProviders(<OpenPortalUsernameField user={user} />);

    expect(screen.getByTestId('edit-shortname')).toBeInTheDocument();
  });

  it('shows the username read-only once it is set', () => {
    mockState({ shortname: 'chris' });
    renderWithProviders(<OpenPortalUsernameField user={user} />);

    expect(screen.getByText('chris')).toBeInTheDocument();
    // The backend refuses a second change, so no edit affordance is offered.
    expect(screen.queryByTestId('edit-shortname')).not.toBeInTheDocument();
  });

  it('does not offer an edit while the value is still loading', () => {
    mockState({ isLoading: true });
    renderWithProviders(<OpenPortalUsernameField user={user} />);

    expect(screen.queryByTestId('edit-shortname')).not.toBeInTheDocument();
  });

  // Guessing "unset" from a failed lookup would offer an edit that can only
  // fail, on a choice that cannot be undone.
  it('does not offer an edit when the lookup failed', () => {
    mockState({ error: new Error('boom') as any });
    renderWithProviders(<OpenPortalUsernameField user={user} />);

    expect(screen.queryByTestId('edit-shortname')).not.toBeInTheDocument();
    expect(screen.getByText('Could not be loaded')).toBeInTheDocument();
  });
});

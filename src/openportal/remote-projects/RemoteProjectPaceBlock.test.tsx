import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  openportalRemoteProjectsTotalUsageRetrieve,
  type RemoteProject,
} from 'waldur-js-client';

import { RemoteProjectPaceBlock } from './RemoteProjectPaceBlock';

const remote = (
  uuid: string,
  name: string,
  allocation: string,
  state: RemoteProject['state'] = 'active',
): RemoteProject =>
  ({
    uuid,
    destination: `${name.toLowerCase()}.brics`,
    resource_name: name,
    state,
    allocation_string: allocation,
    award_details: {
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      allocation,
    },
    created: '2026-01-01T00:00:00Z',
  }) as RemoteProject;

const USAGE: Record<string, number> = { gpu: 1500, cpu: 30000, idle: 0 };

const renderBlock = (remoteProjects: RemoteProject[]) =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <RemoteProjectPaceBlock remoteProjects={remoteProjects} />
    </QueryClientProvider>,
  );

describe('RemoteProjectPaceBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 6, 1));
    vi.mocked(openportalRemoteProjectsTotalUsageRetrieve).mockImplementation(
      ({ path }) =>
        Promise.resolve({ data: { total_hours: USAGE[path.uuid] } }) as any,
    );
  });

  it('shows one connection without tabs', async () => {
    renderBlock([remote('gpu', 'Isambard-AI', '15000 GPUHR')]);

    expect(await screen.findByText('Isambard-AI')).toBeInTheDocument();
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.getByText('1,500 GPUHR')).toBeInTheDocument();
  });

  it('gives several connections a tab each, busiest first', async () => {
    renderBlock([
      remote('gpu', 'Isambard-AI', '15000 GPUHR'),
      remote('cpu', 'Isambard 3', '40000 CPUHR'),
    ]);

    const tabs = await screen.findAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'Isambard 3',
      'Isambard-AI',
    ]);
    expect(screen.getByText('30,000 CPUHR')).toBeInTheDocument();

    await userEvent.click(tabs[1]);
    expect(screen.getByText('1,500 GPUHR')).toBeInTheDocument();
    expect(screen.queryByText('30,000 CPUHR')).toBeNull();
  });

  it('keeps a pending connection, saying which state it is in', async () => {
    renderBlock([remote('gpu', 'Isambard-AI', '15000 GPUHR', 'pending')]);

    expect(await screen.findByText('Isambard-AI')).toBeInTheDocument();
    expect(screen.getByTestId('remote-project-state-field')).toHaveTextContent(
      'pending',
    );
    expect(screen.getByText(/not active at the moment/)).toBeInTheDocument();
  });

  it('leaves out errored connections', async () => {
    renderBlock([
      remote('gpu', 'Isambard-AI', '15000 GPUHR'),
      remote('idle', 'Broken one', '100 NHR', 'error'),
    ]);

    expect(await screen.findByText('Isambard-AI')).toBeInTheDocument();
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByText(/not active at the moment/)).toBeNull();
    expect(
      vi.mocked(openportalRemoteProjectsTotalUsageRetrieve),
    ).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when no connection can be paced', () => {
    const { container } = renderBlock([
      remote('idle', 'Broken one', '100 NHR', 'error'),
    ]);

    expect(container).toBeEmptyDOMElement();
  });
});

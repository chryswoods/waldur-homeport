import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAwardedResources } from '@/proposals/awardedResources';
import { useProposalResourceRows } from '@/proposals/useProposalResourceRows';

import { AwardSummary } from './AwardSummary';

vi.mock('@/proposals/awardedResources', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/proposals/awardedResources')>()),
  useAwardedResources: vi.fn(),
}));
vi.mock('@/proposals/useProposalResourceRows', () => ({
  useProposalResourceRows: vi.fn(),
}));
vi.mock('./AwardComparison', () => ({
  AwardOfferingCell: ({ row }) => (
    <>{(row.awarded ?? row.requested).requested_offering.offering_name}</>
  ),
  AwardAmountsCell: ({ row }) => <>{row.change}</>,
}));
// The table runs its fetchData once and renders its rows' cells.
vi.mock('@/table/useTable', async () => {
  const { useEffect, useState } = await import('react');
  return {
    useTable: ({ fetchData }) => {
      const [rows, setRows] = useState([]);
      useEffect(() => {
        fetchData({}).then((result) => setRows(result.rows));
      }, []);
      return { rows, fetch: vi.fn() };
    },
  };
});
vi.mock('@/table/Table', () => ({
  default: ({ rows, columns }) => (
    <div>
      {rows.map((row, i) => (
        <div key={i} data-testid="award-row">
          {columns.map((column, j) => (
            <span key={j}>{column.render({ row })}</span>
          ))}
        </div>
      ))}
    </div>
  ),
}));

const offering = (name: string) => ({ uuid: name, offering_name: name });

const request = {
  uuid: 'req-1',
  requested_offering: offering('Isambard-AI'),
  attributes: {},
  limits: { node: 5000 },
};
const award = {
  uuid: 'award-1',
  requested_resource: 'req-1',
  requested_offering: offering('Isambard-AI'),
  attributes: {},
  limits: { node: 5000 },
};

const loaded = (data) => ({ data, isLoading: false }) as any;

describe('AwardSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useProposalResourceRows).mockReturnValue(loaded([request]));
  });

  it('lists what completing the allocation decision awards', async () => {
    vi.mocked(useAwardedResources).mockReturnValue(loaded([award]));
    render(<AwardSummary proposal={{ uuid: 'p-1' }} />);

    expect(
      screen.getByText('Completing this step awards:'),
    ).toBeInTheDocument();
    expect(await screen.findAllByTestId('award-row')).toHaveLength(1);
    expect(screen.getByText('Isambard-AI')).toBeInTheDocument();
  });

  it('warns when nothing will be awarded', async () => {
    vi.mocked(useAwardedResources).mockReturnValue(loaded([]));
    render(<AwardSummary proposal={{ uuid: 'p-1' }} />);

    expect(
      screen.getByText(
        'Nothing will be awarded: the awarded resources are empty.',
      ),
    ).toBeInTheDocument();
    // The request it no longer covers is still listed, as removed.
    expect(await screen.findByText('removed')).toBeInTheDocument();
  });

  it('goes to the Awarded resources section, closing what it is in first', async () => {
    vi.mocked(useAwardedResources).mockReturnValue(loaded([award]));
    const section = document.createElement('div');
    section.id = 'step-awarded-resources';
    section.scrollIntoView = vi.fn();
    document.body.appendChild(section);
    const onReview = vi.fn();
    render(<AwardSummary proposal={{ uuid: 'p-1' }} onReview={onReview} />);

    await userEvent.click(
      screen.getByRole('button', { name: 'Review awarded resources' }),
    );

    expect(onReview).toHaveBeenCalled();
    expect(section.scrollIntoView).toHaveBeenCalled();
    section.remove();
  });
});

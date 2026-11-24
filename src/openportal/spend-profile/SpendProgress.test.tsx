import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SpendPeriodProgress, SpendProgress } from 'waldur-js-client';

import { formatDate } from '@/core/dateUtils';

import {
  forfeitText,
  SpendNow,
  spendNowMessages,
  SpendProgressPanel,
} from './SpendProgress';

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
        <div key={i} data-testid="table-row">
          {columns.map((column, j) => (
            <span key={j}>{column.render({ row })}</span>
          ))}
        </div>
      ))}
    </div>
  ),
}));

const period = (
  overrides: Partial<SpendPeriodProgress>,
): SpendPeriodProgress => ({
  from: '2026-07-01',
  to: '2026-09-30',
  minimum: null,
  maximum: null,
  status: 'current',
  spend: 0,
  cumulative_spend: 0,
  cumulative_minimum: null,
  cap: null,
  headroom: null,
  forfeit: null,
  ...overrides,
});

const progress = (...periods: SpendPeriodProgress[]): SpendProgress => ({
  units: 'NHR',
  allocation: 1000,
  spend: 0,
  periods,
});

describe('what the current period allows and asks for', () => {
  it('says how much more can be spent before the period ends', () => {
    const { headroom } = spendNowMessages(
      progress(period({ cap: 500, cumulative_spend: 380, headroom: 120 })),
    );
    expect(headroom).toBe(
      `Can spend up to 120 NHR more before ${formatDate('2026-10-01')}.`,
    );
  });

  it('says jobs are held until the next period once the cap is reached', () => {
    for (const headroom of [0, -15]) {
      expect(
        spendNowMessages(progress(period({ cap: 500, headroom }))).headroom,
      ).toBe(
        `This period's cap is reached: jobs will be held until ${formatDate('2026-10-01')}.`,
      );
    }
  });

  it('says nothing of a cap when the period has none', () => {
    expect(spendNowMessages(progress(period({}))).headroom).toBeNull();
  });

  it('asks for the shortfall against the minimums so far', () => {
    const { minimum } = spendNowMessages(
      progress(period({ cumulative_minimum: 350, cumulative_spend: 241 })),
    );
    expect(minimum).toBe(
      `Spend at least 109 NHR before ${formatDate('2026-10-01')} to avoid a forfeit.`,
    );
    expect(
      spendNowMessages(
        progress(period({ cumulative_minimum: 350, cumulative_spend: 400 })),
      ).minimum,
    ).toBeNull();
  });

  it('has nothing to say without a current period', () => {
    expect(spendNowMessages(progress(period({ status: 'upcoming' })))).toEqual({
      headroom: null,
      minimum: null,
    });
    expect(spendNowMessages(null)).toEqual({ headroom: null, minimum: null });
  });
});

describe('forfeits', () => {
  it('shows a forfeit as a charge, and none as none', () => {
    expect(forfeitText({ forfeit: 109, to: '2026-06-30' }, 'NHR')).toBe(
      `109 NHR, charged on ${formatDate('2026-06-30')}`,
    );
    expect(forfeitText({ forfeit: 0, to: '2026-06-30' }, 'NHR')).toBe('None');
    expect(forfeitText({ forfeit: null, to: '2026-09-30' }, 'NHR')).toBeNull();
  });
});

describe('the spend profile panel', () => {
  const PROGRESS = progress(
    period({
      from: '2026-01-01',
      to: '2026-06-30',
      status: 'ended',
      minimum: '250 NHR',
      spend: 141,
      cumulative_spend: 141,
      cumulative_minimum: 250,
      forfeit: 109,
    }),
    period({
      cap: 600,
      maximum: '350 NHR',
      cumulative_spend: 300,
      headroom: 300,
    }),
  );

  it('lists the periods with their forfeits, and what now allows', async () => {
    render(<SpendProgressPanel progress={PROGRESS} scope="p-1" />);
    expect(await screen.findAllByTestId('table-row')).toHaveLength(2);
    expect(
      screen.getByText(`109 NHR, charged on ${formatDate('2026-06-30')}`),
    ).toBeInTheDocument();
    expect(screen.getByTestId('spend-progress-now')).toHaveTextContent(
      'Can spend up to 300 NHR more',
    );
  });

  it('is hidden for an award without a spend profile', () => {
    const { container } = render(
      <SpendProgressPanel progress={null} scope="p-1" />,
    );
    expect(container).toBeEmptyDOMElement();
    const { container: card } = render(<SpendNow progress={null} />);
    expect(card).toBeEmptyDOMElement();
  });
});

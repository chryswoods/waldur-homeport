import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CreditBreakdown } from '../types';

import { CreditBreakdownCard } from './CreditBreakdownCard';

const ledger: CreditBreakdown = {
  granted: 1000,
  used: 250,
  lost: 100,
  remaining: 650,
  source: 'ledger',
};

// The figures from the screenshot that prompted this: an award that has spent
// most of its allocation, which the ledger breakdown reported as 0% consumed
// because OpenPortal writes no credit transactions.
const award: CreditBreakdown = {
  granted: 53750,
  used: 38319.58,
  lost: 0,
  remaining: 15430.42,
  source: 'award',
};

describe('CreditBreakdownCard', () => {
  it('shows the three ledger segments', () => {
    render(<CreditBreakdownCard breakdown={ledger} />);

    expect(screen.getByText(/Allocated/)).toBeInTheDocument();
    expect(screen.getByText('35% consumed')).toBeInTheDocument();
    expect(screen.getByText(/^Lost/)).toBeInTheDocument();
  });

  it('reports the award allocation and its real consumption', () => {
    render(<CreditBreakdownCard breakdown={award} />);

    expect(screen.getByText(/Award allocation/)).toBeInTheDocument();
    expect(screen.getByText('71% consumed')).toBeInTheDocument();
  });

  // The award accounting has no minimum-draw floor and no expiry write-off, so
  // a "Lost 0 · 0%" badge would imply a forfeiture that cannot happen.
  it('drops the Lost segment under award accounting', () => {
    render(<CreditBreakdownCard breakdown={award} />);

    expect(screen.queryByText(/^Lost/)).toBeNull();
  });
});

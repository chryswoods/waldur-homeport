import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { buildAwardPace } from './awardPace';
import { AwardPaceCard } from './AwardPaceCard';

const on = (year: number, month: number, day: number) =>
  new Date(year, month - 1, day);

const pace = (usage: number, today = on(2026, 7, 1)) =>
  buildAwardPace(
    {
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      allocationCredits: 53750,
      usageCredits: usage,
    },
    today,
  )!;

describe('AwardPaceCard', () => {
  it('states the rate needed alongside the rate being run at', () => {
    render(<AwardPaceCard pace={pace(18100)} />);

    // 53,750 over 364 days is the rate that uses it exactly; 18,100 over the
    // 181 elapsed is the rate actually being run at.
    // 35,650 left over the 183 days remaining is what to aim at from today —
    // not the 53,750 over 364 the whole-window average would give.
    expect(
      screen.getByText(/194\.81\/d from today uses the rest/),
    ).toBeInTheDocument();
    expect(screen.getByText('Spending rate')).toBeInTheDocument();
    expect(screen.getByText(/181 of 364 days used/)).toBeInTheDocument();
  });

  // Use it or lose it: unspent allocation is the case to surface.
  it('says how much would go unused at the current rate', () => {
    render(<AwardPaceCard pace={pace(10000)} />);

    expect(screen.getByText('Behind pace')).toBeInTheDocument();
    // The headline is what is at stake, not a date: "At this rate, by 31 Dec"
    // reads as permission to keep spending until then.
    expect(screen.getByText('Lost at this rate')).toBeInTheDocument();
    expect(screen.getByText(/used by 31 Dec 2026/)).toBeInTheDocument();
  });

  // An underspending award never runs out — the window closes first — so a
  // run-out badge would contradict the loss figure beside it.
  it('offers no run-out date when the award ends first', () => {
    render(<AwardPaceCard pace={pace(10000)} />);

    expect(screen.queryByText(/Runs out/)).toBeNull();
  });

  it('warns that the allocation runs out early when spending fast', () => {
    render(<AwardPaceCard pace={pace(40000)} />);

    expect(screen.getByText('Ahead of pace')).toBeInTheDocument();
    expect(screen.getByText(/Runs out/)).toBeInTheDocument();
  });

  // The figures are the real ones from day one; only the verdict waits, so the
  // card has to look complete rather than blank during the settling period.
  it('shows the figures while withholding the verdict early on', () => {
    render(<AwardPaceCard pace={pace(0, on(2026, 1, 6))} />);

    expect(screen.getByText('Just getting started')).toBeInTheDocument();
    expect(screen.getByText(/5 of 364 days used/)).toBeInTheDocument();
  });
});

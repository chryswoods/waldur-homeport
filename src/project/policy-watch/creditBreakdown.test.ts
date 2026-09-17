import { describe, expect, it } from 'vitest';
import { CreditTransaction } from 'waldur-js-client';

import { awardCreditBreakdown, buildCreditBreakdown } from './creditBreakdown';

let seq = 0;
const row = (
  transaction_type: string,
  amount: number,
  billing_period: string | null = null,
): CreditTransaction =>
  ({
    uuid: `row-${(seq += 1)}`,
    created: '2026-03-01T00:00:00Z',
    amount: amount.toFixed(5),
    transaction_type,
    transaction_type_display: transaction_type,
    billing_period,
  }) as unknown as CreditTransaction;

describe('buildCreditBreakdown', () => {
  it('separates the floor draw from usage, which invoice items could not', () => {
    // A month that used 2,000 against a 8,000 floor: 6,000 bought nothing.
    const breakdown = buildCreditBreakdown(
      [
        row('staff_grant', 93000),
        row('compensation', -2000, '2026-02-01'),
        row('minimal_draw', -6000, '2026-02-01'),
      ],
      85000,
    );

    expect(breakdown.used).toBe(2000);
    expect(breakdown.lost).toBe(6000);
    expect(breakdown.remaining).toBe(85000);
    expect(breakdown.granted).toBe(93000);
  });

  it('reports no forfeiture for a month that meets its floor', () => {
    const breakdown = buildCreditBreakdown(
      [row('staff_grant', 10000), row('compensation', -2000, '2026-02-01')],
      8000,
    );

    expect(breakdown.used).toBe(2000);
    expect(breakdown.lost).toBe(0);
  });

  it('counts expiry as forfeited rather than used', () => {
    // Acceptance criterion: credit expiry appears as forfeited credit.
    const breakdown = buildCreditBreakdown(
      [row('staff_grant', 5000), row('expiry', -5000)],
      0,
    );

    expect(breakdown.used).toBe(0);
    expect(breakdown.lost).toBe(5000);
    expect(breakdown.granted).toBe(5000);
  });

  it('does not count a re-applied month twice', () => {
    // Applying compensations is a roll-back followed by a re-application, and
    // staff can run it against a pending invoice repeatedly. Both runs leave
    // their rows behind.
    const breakdown = buildCreditBreakdown(
      [
        row('staff_grant', 10000),
        row('compensation', -2000, '2026-02-01'),
        row('rollback', 2000, '2026-02-01'),
        row('compensation', -2000, '2026-02-01'),
      ],
      8000,
    );

    expect(breakdown.used).toBe(2000);
    expect(breakdown.granted).toBe(10000);
  });

  it('keeps a project tail forfeited when the roll-back does not restore it', () => {
    // clear_compensations restores project credits by their compensation sum
    // only, so a re-applied month really does take the floor draw twice. The
    // card states what the balance did, not what it should have done.
    const breakdown = buildCreditBreakdown(
      [
        row('compensation', -2000, '2026-02-01'),
        row('minimal_draw', -6000, '2026-02-01'),
        row('rollback', 2000, '2026-02-01'),
        row('compensation', -2000, '2026-02-01'),
        row('minimal_draw', -6000, '2026-02-01'),
      ],
      0,
    );

    expect(breakdown.used).toBe(2000);
    expect(breakdown.lost).toBe(12000);
  });

  it('treats transfers and payouts as neither used nor forfeited', () => {
    const breakdown = buildCreditBreakdown(
      [
        row('staff_grant', 1000),
        row('affiliate_fee', 30),
        row('payout', -30),
        row('compensation', -100, '2026-02-01'),
      ],
      900,
    );

    expect(breakdown.used).toBe(100);
    expect(breakdown.lost).toBe(0);
    expect(breakdown.granted).toBe(1000);
  });

  it('reconciles to the balance for an empty ledger', () => {
    const breakdown = buildCreditBreakdown([], 500);

    expect(breakdown).toEqual({
      used: 0,
      lost: 0,
      remaining: 500,
      granted: 500,
      source: 'ledger',
    });
  });

  it('survives an unparseable amount rather than reporting NaN', () => {
    const broken = { ...row('compensation', -100), amount: 'n/a' };
    const breakdown = buildCreditBreakdown([broken as CreditTransaction], 100);

    expect(breakdown.used).toBe(0);
    expect(breakdown.granted).toBe(100);
  });
});

// A project backed by an OpenPortal award is accounted for twice over: the
// award's own running totals ("absolute"), and Waldur's credit balance
// ("relative"). OpenPortal sets ProjectCredit.value directly and writes no
// credit transactions, so a ledger-derived breakdown reports a project that has
// spent most of its award as untouched. These are the figures that replace it.
describe('awardCreditBreakdown', () => {
  const summary = (
    allocation: number | null,
    usage: number,
    remaining: number | null,
  ) =>
    ({
      has_award: true,
      allocation_credits: allocation,
      usage_credits: usage,
      remaining_credits: remaining,
    }) as any;

  it('reports the award allocation and its usage, not the ledger', () => {
    const breakdown = awardCreditBreakdown(summary(53750, 38319.58, 15430.42));

    expect(breakdown).toEqual({
      granted: 53750,
      used: 38319.58,
      lost: 0,
      remaining: 15430.42,
      source: 'award',
    });
  });

  it('takes granted from the award rather than summing the parts', () => {
    // The ledger breakdown derives granted as used + lost + remaining, which
    // holds only because those three are the whole of it. An award states its
    // allocation, and usage is measured independently, so the parts need not
    // add up — an over-spent award has to stay over-spent rather than being
    // reconciled into a larger allocation.
    const breakdown = awardCreditBreakdown(summary(1000, 1200, -200));

    expect(breakdown?.granted).toBe(1000);
    expect(breakdown?.remaining).toBe(-200);
  });

  it('falls back to allocation minus usage when remaining is absent', () => {
    expect(awardCreditBreakdown(summary(1000, 250, null))?.remaining).toBe(750);
  });

  it('reports nothing when the award allocation does not resolve', () => {
    // A usage figure with no allocation behind it. Showing it against a zero
    // allocation would read as a fully spent award, and falling back to the
    // ledger would report 0% consumed — both worse than saying nothing.
    expect(awardCreditBreakdown(summary(null, 250, null))).toBeNull();
  });

  it('marks the ledger breakdown as such', () => {
    expect(buildCreditBreakdown([], 500).source).toBe('ledger');
  });
});

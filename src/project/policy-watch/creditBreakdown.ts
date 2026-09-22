import {
  CreditTransaction,
  ManagedProjectAccountingSummary,
} from 'waldur-js-client';

import { CreditBreakdown } from './types';

/** Credit given up against real usage. */
const USAGE_DRAW = 'compensation';

/** Credit given up without buying anything: the minimal-consumption floor took
 *  the shortfall, or the balance expired unspent. Both are forfeiture, and both
 *  are invisible in the invoice items — the floor draw writes none at all. */
const FORFEITURE_DRAWS = ['minimal_draw', 'expiry'];

/** A month's compensation reversed before it is re-applied. */
const REVERSAL = 'rollback';

const amountOf = (transaction: CreditTransaction): number => {
  const n = parseFloat(transaction.amount);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Split a credit's ledger into what it bought, what it forfeited, and what is
 * left.
 *
 * This reads the drawdown rather than inferring it. The previous derivation
 * compared each month's compensation against the cost incurred and called the
 * excess "lost" — but a compensation never exceeds the cost it offsets, so that
 * figure was structurally zero, and the floor draw it was trying to find leaves
 * no invoice item to compare against in the first place.
 *
 * `granted` stays derived rather than summed from the inflow rows, so the three
 * segments always add up to the whole no matter what else moved the balance —
 * a transfer out or a payout is neither usage nor forfeiture, and showing it as
 * a fourth segment would say more about platform mechanics than the project
 * needs to know.
 */
export const buildCreditBreakdown = (
  transactions: CreditTransaction[],
  remaining: number,
): CreditBreakdown => {
  let drawnAgainstUsage = 0;
  let forfeited = 0;
  let reversed = 0;

  for (const transaction of transactions) {
    const amount = amountOf(transaction);
    const type = transaction.transaction_type;
    if (type === USAGE_DRAW) {
      // Draws are negative deltas; the segments are magnitudes.
      drawnAgainstUsage -= amount;
    } else if (FORFEITURE_DRAWS.includes(type)) {
      forfeited -= amount;
    } else if (type === REVERSAL) {
      reversed += amount;
    }
  }

  // A roll-back restores what the compensation items drew, so it nets against
  // usage rather than forfeiture — re-applying a month must not count that
  // month's usage twice. Floor draws are deliberately left alone: the roll-back
  // does not restore a project's tail, so the credit really is gone.
  const used = Math.max(0, drawnAgainstUsage - reversed);
  const lost = Math.max(0, forfeited);

  return {
    used,
    lost,
    remaining,
    granted: used + lost + remaining,
    source: 'ledger',
  };
};

/**
 * The same split, taken from the OpenPortal award accounting instead of the
 * ledger.
 *
 * `granted` is the award's allocation rather than a sum of the parts, because
 * here it is a stated figure rather than something inferred: the award says what
 * it granted. Nothing is forfeited — the award accounting has no equivalent of
 * the minimal-consumption floor or of credit expiring unspent — so `lost` is
 * zero and the card drops that segment rather than showing a permanent 0%.
 *
 * `remaining` comes from the endpoint rather than being computed here, so the
 * figure matches the award card on the same dashboard exactly.
 */
export const awardCreditBreakdown = (
  summary: ManagedProjectAccountingSummary,
): CreditBreakdown | null => {
  // Null when the award has no resolvable project template or no allocation to
  // convert: there is a usage figure but nothing to measure it against, and a
  // breakdown against a zero allocation would read as a fully spent award.
  const granted = summary.allocation_credits;
  if (granted == null) {
    return null;
  }
  const used = summary.usage_credits ?? 0;
  return {
    granted,
    used,
    lost: 0,
    remaining: summary.remaining_credits ?? granted - used,
    source: 'award',
  };
};

import { FC } from 'react';
import { Variant } from 'react-bootstrap/types';

import { Badge } from '@/core/Badge';
import { defaultCurrency } from '@/core/formatCurrency';
import { translate } from '@/i18n';

import { getWatchColors } from '../chartColors';
import { CreditBreakdown } from '../types';

interface Props {
  breakdown: CreditBreakdown;
}

interface Segment {
  key: 'used' | 'lost' | 'remaining';
  label: string;
  value: number;
  color: string;
  variant: Variant;
  hint: string;
}

export const CreditBreakdownCard: FC<Props> = ({ breakdown }) => {
  const { granted, used, lost, remaining } = breakdown;

  if (granted <= 0) {
    return null;
  }

  // Theme colors, matching the app's chart convention (brand green = the
  // consumed/primary series, gray-300 = remaining/inactive, danger = negative).
  const c = getWatchColors();
  // The award accounting has no forfeiture: no minimum-draw floor, and an
  // allocation that is not used is simply not used. Keeping a permanently zero
  // "Lost" badge would imply the award can forfeit and happens not to have.
  const fromAward = breakdown.source === 'award';
  const segments: Segment[] = [
    {
      key: 'used',
      label: translate('Used'),
      value: used,
      color: c.brand300,
      variant: 'success',
      hint: fromAward
        ? translate('Usage counted against the award, converted to credits.')
        : translate('Credit consumed against real usage.'),
    },
    !fromAward && {
      key: 'lost',
      label: translate('Lost'),
      value: lost,
      color: c.danger,
      variant: 'danger',
      hint: translate(
        'Credit forfeited to the minimum-draw floor or expiry — hard to recover.',
      ),
    },
    {
      key: 'remaining',
      label: translate('Remaining'),
      value: remaining,
      color: c.neutral,
      variant: 'secondary',
      hint: fromAward
        ? translate('Allocation still available on the award.')
        : translate('Credit still available to spend.'),
    },
  ].filter(Boolean) as Segment[];

  const pct = (value: number) =>
    Math.max(0, Math.min(100, (value / granted) * 100));
  const consumedPct = pct(used + lost);

  return (
    <>
      <div className="d-flex justify-content-between align-items-baseline mb-2 gap-3">
        <span className="text-muted">
          {fromAward
            ? translate('Award allocation {amount}', {
                amount: defaultCurrency(granted),
              })
            : translate('Allocated {amount}', {
                amount: defaultCurrency(granted),
              })}
        </span>
        <span className="text-muted">
          {translate('{pct}% consumed', { pct: consumedPct.toFixed(0) })}
        </span>
      </div>
      {/* Three segments rather than one progress value: "Lost" is the only
          figure that tells a project it is forfeiting credit, and a single
          consumed bar hides it inside the same band as real usage. */}
      <div
        className="d-flex rounded overflow-hidden mb-3"
        style={{ height: 16 }}
      >
        {segments.map((s) =>
          s.value > 0 ? (
            <div
              key={s.key}
              style={{ width: `${pct(s.value)}%`, backgroundColor: s.color }}
              title={`${s.label}: ${defaultCurrency(s.value)}`}
            />
          ) : null,
        )}
      </div>
      <div className="d-flex flex-wrap gap-2">
        {segments.map((s) => (
          <Badge
            key={s.key}
            variant={s.variant}
            size="sm"
            pill
            outline
            hasBullet
            tooltip={s.hint}
          >
            {translate('{label} {amount} · {pct}%', {
              label: s.label,
              amount: defaultCurrency(s.value),
              pct: pct(s.value).toFixed(0),
            })}
          </Badge>
        ))}
      </div>
    </>
  );
};

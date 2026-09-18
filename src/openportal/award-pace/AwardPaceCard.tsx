import { InfoIcon } from '@phosphor-icons/react';
import { CSSProperties, FC, ReactNode } from 'react';
import { Col, Row } from 'react-bootstrap';
import { Variant } from 'react-bootstrap/types';

import { Badge } from '@/core/Badge';
import { formatDate } from '@/core/dateUtils';
import { defaultCurrency } from '@/core/formatCurrency';
import { StatsCard } from '@/core/StatsCard';
import { Tip } from '@/core/Tooltip';
import { getChartThemeColors } from '@/dashboard/chartColors';
import { WidgetCard } from '@/dashboard/WidgetCard';
import { translate } from '@/i18n';

import { AwardPace, AwardPaceStatus } from './awardPace';

const pct0 = (value: number) => `${Math.round(value * 100)}%`;
const clampPct = (value: number) => `${Math.min(Math.max(value, 0), 1) * 100}%`;

// The "today" tick is centred on its position, except near the ends of the bar
// where centring would push half the label outside the card.
// The "today" tick is what the reader compares the fill against, so it is the
// one mark on the bar that has to be unmissable: a full-height rule in the body
// text colour with a bold label, rather than a hairline in muted grey.
const markerLabel = (fraction: number): CSSProperties => ({
  position: 'absolute',
  transform:
    fraction >= 0.9
      ? 'translateX(-100%)'
      : fraction <= 0.1
        ? 'none'
        : 'translateX(-50%)',
  whiteSpace: 'nowrap',
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: '0.02em',
  top: -24,
});

// Under-spending is the case worth flagging: the allocation is use-it-or-lose-it,
// so credit not spent by the end date is credit given back. Spending ahead is
// not a fault, which is why it is not styled as one — it only becomes news when
// the allocation will not last, and the run-out date says that in words.
const STATUS_VARIANT: Record<AwardPaceStatus, Variant> = {
  settling: 'secondary',
  behind: 'warning',
  'on-track': 'success',
  ahead: 'info',
  exhausted: 'danger',
  ended: 'secondary',
};

const statusLabel = (status: AwardPaceStatus): string =>
  ({
    settling: translate('Just getting started'),
    behind: translate('Behind pace'),
    'on-track': translate('On pace'),
    ahead: translate('Ahead of pace'),
    exhausted: translate('Allocation used up'),
    ended: translate('Award has ended'),
  })[status];

/**
 * The verdict as a sentence rather than two bare percentages side by side.
 *
 * "Even spend by today 31%" next to "12% of the allocation" put two numbers on
 * different axes — one a share of the window, the other a share of the money —
 * beside each other with nothing saying they were different things. Naming both
 * in one sentence is longer, but it is the difference between a reader doing
 * the comparison and a reader guessing at it.
 *
 * Each status gets its own whole string: assembling one from fragments would
 * fix English word order onto every other language.
 */
const paceSentence = (pace: AwardPace): string => {
  const expected = pct0(pace.elapsedFraction);
  const actual = pct0(pace.usedFraction);

  switch (pace.status) {
    case 'settling':
      return translate(
        'Too early to judge. An even spend from the award start would have used {expected} of the allocation by today, and {actual} has been used.',
        { expected, actual },
      );
    case 'behind':
      return translate(
        'An even spend from the award start would have used {expected} of the allocation by today, but only {actual} has been used. Allocation not used by the end date is lost.',
        { expected, actual },
      );
    case 'on-track':
      return translate(
        'An even spend from the award start would have used {expected} of the allocation by today, and {actual} has been used.',
        { expected, actual },
      );
    case 'ahead':
      return translate(
        'An even spend from the award start would have used {expected} of the allocation by today, and {actual} has already been used.',
        { expected, actual },
      );
    case 'exhausted':
      return translate(
        'The whole allocation has been used, with {remaining} days of the award still to run.',
        { remaining: String(pace.remainingDays) },
      );
    case 'ended':
      return translate(
        'The award has ended. {actual} of the allocation was used.',
        { actual },
      );
    default:
      return '';
  }
};

const statusHint = (pace: AwardPace): string | undefined => {
  switch (pace.status) {
    case 'settling':
      return translate(
        'Too early in the award to judge the pace. The figures are real; only the verdict is waiting.',
      );
    case 'behind':
      return translate(
        'Spending more slowly than the allocation needs. Allocation not used by the end date is lost.',
      );
    case 'ahead':
      return translate(
        'Spending faster than the even rate. That is not a problem in itself — what matters is whether the allocation lasts to the end date.',
      );
    case 'exhausted':
      return translate('The whole allocation has been used.');
    case 'ended':
      return translate('The award window has closed.');
    default:
      return undefined;
  }
};

/** An info tip in the tile's corner, for a figure whose derivation is not
 *  obvious from its label. Matches the credit cards below. */
const MetricTip: FC<{ id: string; label: ReactNode }> = ({ id, label }) => (
  <Tip id={id} label={label}>
    <InfoIcon weight="bold" className="text-muted" />
  </Tip>
);

interface Props {
  pace: AwardPace;
}

/**
 * How an award is tracking against its own window, rather than against a
 * monthly target.
 *
 * The monthly pacing card measures a credit against its expected consumption,
 * a minimum-draw floor and a grace coefficient — the banking model. An award
 * has none of those: it is an allocation and a window, and the only question is
 * whether the allocation will be used by the end of it.
 */
export const AwardPaceCard: FC<Props> = ({ pace }) => {
  const c = getChartThemeColors();
  const underspending = pace.projectedDifference < 0;

  return (
    <WidgetCard cardTitle={translate('Award pace')} className="mb-5">
      <div className="separator mt-4 mb-5" />

      <Row className="g-4 mb-5">
        <Col md={4}>
          <StatsCard
            label={translate('Used so far')}
            icon={
              <MetricTip
                id="award-pace-used"
                label={translate(
                  "Usage recorded against this award, converted to credits, over the whole time it has been attached. It is the award's total, so an award that has moved between projects shows the same figure on each.",
                )}
              />
            }
            value={defaultCurrency(pace.used)}
            footer={
              <span className="text-muted fs-7">
                {translate('of {allocation} · {pct} of the allocation', {
                  allocation: defaultCurrency(pace.allocation),
                  pct: pct0(pace.usedFraction),
                })}
              </span>
            }
          />
        </Col>
        <Col md={4}>
          <StatsCard
            label={translate('Spending rate')}
            icon={
              <MetricTip
                id="award-pace-rate"
                label={translate(
                  'What has been used so far divided by the days elapsed since the award started. The figure below it is what is left divided by the days remaining — the rate from today that finishes the allocation exactly, which is the one to aim at.',
                )}
              />
            }
            value={
              <>
                {defaultCurrency(pace.actualPerDay.toFixed(2))}
                <span className="fs-4"> {translate('per day')}</span>
              </>
            }
            footer={
              <span className="text-muted fs-7">
                {pace.requiredPerDay === null
                  ? translate('Last day of the award')
                  : translate('{required} per day from today uses the rest', {
                      required: defaultCurrency(pace.requiredPerDay.toFixed(2)),
                    })}
              </span>
            }
          />
        </Col>
        <Col md={4}>
          {/* The headline is what is at stake, not a date: "At this rate, by
              19 Nov" read as permission to keep spending until the 19th, which
              is the opposite of what an underspend warning should say. */}
          <StatsCard
            label={
              underspending
                ? translate('At this rate you will lose')
                : translate('Over the allocation at this rate')
            }
            icon={
              <MetricTip
                id="award-pace-projection"
                label={
                  underspending
                    ? translate(
                        "Today's rate carried on to the end of the award would leave this much of the allocation unspent. Allocation not used by the end date is lost, so this is what is at stake if nothing changes.",
                      )
                    : translate(
                        "Today's rate carried on to the end of the award would need this much more than the allocation holds. The allocation runs out before the award does.",
                      )
                }
              />
            }
            value={defaultCurrency(Math.abs(pace.projectedDifference))}
            footer={
              <span className="text-muted fs-7">
                {translate('{total} of {allocation} used by {date}', {
                  total: defaultCurrency(pace.projectedTotal),
                  allocation: defaultCurrency(pace.allocation),
                  date: formatDate(pace.endDate),
                })}
              </span>
            }
          />
        </Col>
      </Row>

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
        <div className="d-flex align-items-center gap-2">
          <span className="fw-bold">{translate('Pace')}</span>
          <Badge
            variant={STATUS_VARIANT[pace.status]}
            pill
            outline
            hasBullet
            tooltip={statusHint(pace)}
          >
            {statusLabel(pace.status)}
          </Badge>
        </div>
        <span className="text-muted">
          {translate('{elapsed} of {total} days used', {
            elapsed: String(pace.elapsedDays),
            total: String(pace.totalDays),
          })}
        </span>
      </div>

      {/* One bar, 0 → the whole allocation. The fill is what has been used; the
          tick is where an even spend would have reached by today. The gap
          between them is the pace, which is the thing the card exists to show. */}
      <div style={{ paddingTop: 20 }}>
        <div
          className="rounded position-relative"
          style={{ height: 16, backgroundColor: c.track }}
        >
          <div
            className="rounded"
            style={{
              height: '100%',
              width: clampPct(pace.usedFraction),
              backgroundColor: c.brand300,
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: -8,
              bottom: -8,
              left: clampPct(pace.elapsedFraction),
              borderLeft: `4px solid ${c.text}`,
              borderRadius: 2,
            }}
            title={translate('Where an even spend would be today')}
          >
            <span style={markerLabel(pace.elapsedFraction)}>
              {translate('TODAY')}
            </span>
          </div>
        </div>
      </div>

      <p className="text-muted mt-4 mb-2">{paceSentence(pace)}</p>

      <div className="d-flex flex-wrap gap-2">
        {pace.exhaustionDate && (
          <Badge
            variant="info"
            size="sm"
            pill
            outline
            hasBullet
            tooltip={translate(
              'At the current rate the allocation runs out before the award ends.',
            )}
          >
            {translate('Runs out {date}', {
              date: formatDate(pace.exhaustionDate),
            })}
          </Badge>
        )}
        {pace.remainingDays > 0 && (
          <Badge variant="secondary" size="sm" pill outline hasBullet>
            {translate('{days} days left', {
              days: String(pace.remainingDays),
            })}
          </Badge>
        )}
      </div>
    </WidgetCard>
  );
};

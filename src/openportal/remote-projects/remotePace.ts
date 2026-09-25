import { type RemoteProject } from 'waldur-js-client';

import { translate } from '@/i18n';
import {
  AwardPace,
  buildAwardPace,
  resolveAwardWindow,
} from '@/openportal/award-pace/awardPace';
import { type PaceUnits } from '@/openportal/award-pace/AwardPaceCard';

import { allocationTotal, allocationUnit } from '../allocationUsage';

export interface RemoteProjectPace {
  remoteProject: RemoteProject;
  pace: AwardPace;
  /** The allocation's own unit, e.g. "GPUHR"; undefined when it names none. */
  unit: string | undefined;
}

/**
 * The allocation to pace against, as the awarding portal wrote it.
 *
 * The award details carry the funder's figure; the top-level strings are what
 * the connection last recorded, and stand in when the details do not say.
 */
const allocationText = (rp: RemoteProject): string | null =>
  [
    rp.award_details?.allocation,
    rp.allocation_string,
    rp.current_allocation,
  ].find((text) => allocationTotal(text) > 0) ?? null;

/**
 * How one remote project connection is tracking against its award window.
 *
 * Only an active connection is paced. Until the remote portal has set the
 * project up there is nothing to spend against, and a pending or errored one
 * would read as "behind" for a delay that is not the team's.
 *
 * The window is the award's own dates. Where one is missing the start falls
 * back to when the connection was made — usage is only counted from then — and
 * the end to the project's end date; with no end date at all there is no pace.
 */
export const buildRemoteProjectPace = (
  rp: RemoteProject,
  usage: number | undefined,
  projectEndDate: string | null | undefined,
  today: Date = new Date(),
): RemoteProjectPace | null => {
  if (rp.state !== 'active' || usage === undefined) {
    return null;
  }
  const text = allocationText(rp);
  const details = rp.award_details ?? rp.last_confirmed_details;
  const { startDate, endDate } = resolveAwardWindow(
    details?.start_date,
    details?.end_date,
    rp.created,
    projectEndDate,
  );
  const pace = buildAwardPace(
    {
      startDate,
      endDate,
      allocationCredits: allocationTotal(text),
      usageCredits: usage,
    },
    today,
  );
  return pace ? { remoteProject: rp, pace, unit: allocationUnit(text) } : null;
};

/**
 * Busiest first: the connection furthest through its allocation is the one a
 * team most needs to see, so it is the tab that opens. Ties keep the order the
 * API gave, which is the order of the connection cards above.
 */
export const orderByUsage = (paces: RemoteProjectPace[]): RemoteProjectPace[] =>
  paces
    .map((entry, index) => ({ entry, index }))
    .sort(
      (a, b) =>
        b.entry.pace.usedFraction - a.entry.pace.usedFraction ||
        a.index - b.index,
    )
    .map(({ entry }) => entry);

/** The name a connection goes by in the tabs and the card title. */
export const remoteProjectLabel = (rp: RemoteProject): string =>
  rp.resource_name || rp.destination;

const formatter = (digits: number) =>
  new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });

/**
 * Amounts in the allocation's own unit. Totals are whole-ish figures, so one
 * decimal place is plenty; a per-day rate on a small allocation needs two.
 */
export const remotePaceUnits = (unit: string | undefined): PaceUnits => {
  const suffix = unit ? ` ${unit}` : '';
  return {
    amount: (value) => `${formatter(1).format(value)}${suffix}`,
    rate: (value) => `${formatter(2).format(value)}${suffix}`,
    usedTip: translate(
      'Usage the remote portal has reported for this project, in the unit of its allocation, since the award started.',
    ),
  };
};

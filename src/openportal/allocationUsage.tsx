/**
 * Shared presentation helpers for allocation-versus-usage widgets.
 *
 * Allocations arrive from OpenPortal as free text — "1000 NHR", "500 core
 * hours" — so the number and its unit have to be split apart for display.
 */
import { ArrowSquareOutIcon } from '@phosphor-icons/react';
import { FC, ReactNode } from 'react';

import { BaseButton } from '@/core/buttons/BaseButton';

/** The unit part of an allocation string, e.g. "NHR" from "1000 NHR". */
export const allocationUnit = (
  allocationString: string | null | undefined,
): string | undefined => {
  if (!allocationString) return undefined;
  const parts = allocationString.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(' ') : undefined;
};

/** The numeric part of an allocation string, or 0 if there isn't one. */
export const allocationTotal = (
  allocationString: string | null | undefined,
): number => parseFloat(allocationString?.trim().split(/\s+/)[0] ?? '0') || 0;

/**
 * Usage as a percentage of a total, capped at 100. Zero when there is no
 * usable total, so a missing allocation reads as an empty bar rather than
 * dividing by zero.
 */
export const percentOf = (
  used: number,
  total: number | null | undefined,
): number => {
  if (!total || total <= 0) return 0;
  return Math.min(100, (used / total) * 100);
};

/**
 * Usage as a percentage of the first allocation string that carries a number.
 * For awards whose allocation is free text; where the API gives a number
 * already, use percentOf directly.
 */
export const usagePercent = (
  used: number,
  ...allocationStrings: Array<string | null | undefined>
): number =>
  percentOf(
    used,
    allocationStrings.map(allocationTotal).find((n) => n > 0) ?? 0,
  );

/** Trims trailing zeroes off a usage figure: 12.50 -> "12.5", 12.00 -> "12". */
export const formatUsage = (hours: number): string =>
  parseFloat(hours.toFixed(2)).toString();

/**
 * Where an allocation stops being comfortable.
 *
 * One pair of thresholds for the bar and for the figure above it, so a card
 * cannot show an amber bar under a red number. The bar previously turned red
 * at 95%, which left a band where the two disagreed.
 */
export const USAGE_WARNING_PERCENT = 80;
export const USAGE_DANGER_PERCENT = 90;

/**
 * The text colour for a usage figure, or undefined below the warning
 * threshold — most allocations are healthy, and colouring those too would
 * spend the reader's attention on the normal case.
 */
export const usageTextClass = (percent: number): string | undefined => {
  if (percent >= USAGE_DANGER_PERCENT) return 'text-danger';
  if (percent >= USAGE_WARNING_PERCENT) return 'text-warning';
  return undefined;
};

/**
 * A thin progress bar that turns amber past the warning threshold and red past
 * the danger one.
 */
export const UsageProgressBar: FC<{ percent: number }> = ({ percent }) => {
  const variant =
    percent >= USAGE_DANGER_PERCENT
      ? 'bg-danger'
      : percent >= USAGE_WARNING_PERCENT
        ? 'bg-warning'
        : 'bg-primary';
  return (
    <div className="progress mt-2" style={{ height: 6 }}>
      <div
        className={`progress-bar ${variant}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
};

/**
 * The "Go to award" / "Go to project" button that sits beside a card. Opens
 * the remote portal in a new tab; BaseButton rather than an anchor styled
 * with btn classes, per the design system.
 */
export const ExternalCardLink: FC<{ url: string; children: ReactNode }> = ({
  url,
  children,
}) => (
  <BaseButton
    variant="primary"
    className="d-flex flex-column align-items-center justify-content-center gap-2 px-4"
    onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
    label={
      <>
        <ArrowSquareOutIcon size={22} weight="bold" />
        <span className="fs-7 lh-sm text-center">{children}</span>
      </>
    }
  />
);

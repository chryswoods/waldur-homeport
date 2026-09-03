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
const allocationTotal = (allocationString: string | null | undefined): number =>
  parseFloat(allocationString?.trim().split(/\s+/)[0] ?? '0') || 0;

/** Usage as a percentage of the allocation, capped at 100. */
export const usagePercent = (
  used: number,
  ...allocationStrings: Array<string | null | undefined>
): number => {
  const total = allocationStrings.map(allocationTotal).find((n) => n > 0) ?? 0;
  if (!total) return 0;
  return Math.min(100, (used / total) * 100);
};

/** Trims trailing zeroes off a usage figure: 12.50 -> "12.5", 12.00 -> "12". */
export const formatUsage = (hours: number): string =>
  parseFloat(hours.toFixed(2)).toString();

/**
 * A thin progress bar that turns amber past 80% of the allocation and red
 * past 95%.
 */
export const UsageProgressBar: FC<{ percent: number }> = ({ percent }) => {
  const variant =
    percent >= 95 ? 'bg-danger' : percent >= 80 ? 'bg-warning' : 'bg-primary';
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

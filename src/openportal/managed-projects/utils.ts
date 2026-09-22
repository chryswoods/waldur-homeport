import { ManagedProject } from 'waldur-js-client';

/**
 * The date this project's approval is held until, or null if it is not on
 * hold. Exported for the dashboard card, which shows the date rather than
 * just the fact of the embargo.
 */
export const embargoedUntil = (row: ManagedProject): string | null => {
  const earliest = row.details?.earliest_approve;
  if (earliest && new Date(earliest) > new Date()) {
    return earliest;
  }
  return null;
};

export const isEmbargoed = (row: ManagedProject): boolean =>
  embargoedUntil(row) !== null;

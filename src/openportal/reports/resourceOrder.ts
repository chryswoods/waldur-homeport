import { ProjectUsageReport } from './ProjectUsageReport';

interface Named {
  resource: string;
}

/**
 * The order the resource selector lists OpenPortal resources in: busiest first.
 *
 * These were previously sorted by `r.resource`, which is the offering
 * identifier rather than its name — so the order was effectively arbitrary, and
 * whichever identifier happened to sort first became the default tab. A project
 * holding both a main system and a small ancillary one could open on the
 * ancillary one, showing a near-empty chart where the user expected their real
 * usage.
 *
 * Total usage decides it. Ties — which includes every storage-only resource,
 * since they report no compute hours — fall back to the display name so the
 * order is stable and readable rather than arbitrary, and to the identifier
 * when the name mapping has not resolved yet.
 */
export const sortResourcesByUsage = (
  resources: string[],
  usageReports: ProjectUsageReport[],
  offeringNames: Record<string, string> | undefined = {},
): string[] => {
  const hoursByResource = new Map<string, number>();
  for (const report of usageReports) {
    hoursByResource.set(
      report.resource,
      (hoursByResource.get(report.resource) ?? 0) + report.totalUsageHours(),
    );
  }

  const label = (resource: string) => offeringNames?.[resource] ?? resource;

  return [...resources].sort((a, b) => {
    const difference =
      (hoursByResource.get(b) ?? 0) - (hoursByResource.get(a) ?? 0);
    if (difference !== 0) return difference;
    return label(a).localeCompare(label(b));
  });
};

/** Narrowing helper so callers can pass either report type for the id list. */
export const resourceIdsOf = (reports: Named[] | undefined): string[] =>
  (reports ?? []).map((report) => report.resource);

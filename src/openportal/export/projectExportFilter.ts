/**
 * The request filter for an Excel export of a project list.
 *
 * The table keeps its search box separate from its filter: `filter` holds the
 * filter drawer's values, and the search string is applied under the table's
 * own `queryField`. Building the export from `filter` alone therefore ignored
 * the search box entirely and exported every project however the list had been
 * narrowed — which is what "I filtered to AIRR-IN and got all of them" was.
 *
 * Mirrors how useTableExport assembles the same request, so the Excel export
 * and the built-in one agree about what the current scope is.
 */
export const projectExportFilter = (
  filter: Record<string, any> | undefined,
  query: string | undefined,
  queryField = 'query',
): Record<string, any> => {
  const result = { ...(filter ?? {}) };
  if (query) {
    result[queryField] = query;
  }
  return result;
};

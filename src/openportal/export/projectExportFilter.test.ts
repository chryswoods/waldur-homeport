import { describe, expect, it } from 'vitest';

import { projectExportFilter } from './projectExportFilter';

describe('projectExportFilter', () => {
  it('keeps the filter drawer values', () => {
    expect(projectExportFilter({ customer: 'c1', o: 'name' }, '')).toEqual({
      customer: 'c1',
      o: 'name',
    });
  });

  // The regression: searching "AIRR-IN" narrowed the list to about ten
  // projects, and the export ignored it and wrote out every one.
  it('applies the search box, which is not part of the filter', () => {
    expect(projectExportFilter({ customer: 'c1' }, 'AIRR-IN')).toEqual({
      customer: 'c1',
      query: 'AIRR-IN',
    });
  });

  it('uses the table own query field', () => {
    expect(projectExportFilter({}, 'AIRR-IN', 'name')).toEqual({
      name: 'AIRR-IN',
    });
  });

  it('leaves the filter alone when nothing is searched', () => {
    expect(projectExportFilter({ customer: 'c1' }, undefined)).toEqual({
      customer: 'c1',
    });
  });
});

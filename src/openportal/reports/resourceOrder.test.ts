import { describe, expect, it } from 'vitest';

import { sortResourcesByUsage } from './resourceOrder';

const report = (resource: string, hours: number): any => ({
  resource,
  totalUsageHours: () => hours,
});

describe('sortResourcesByUsage', () => {
  // The real case: a project holding a main system and a small ancillary one.
  // Sorted by identifier, whichever sorted first opened as the default tab.
  it('puts the busiest resource first', () => {
    expect(
      sortResourcesByUsage(
        ['macs-uid', 'i3-uid'],
        [report('macs-uid', 3), report('i3-uid', 5000)],
      ),
    ).toEqual(['i3-uid', 'macs-uid']);
  });

  it('sums a resource reported across several months', () => {
    expect(
      sortResourcesByUsage(
        ['a', 'b'],
        [report('a', 10), report('b', 30), report('a', 40)],
      ),
    ).toEqual(['a', 'b']);
  });

  // Storage-only resources report no compute hours, so they all tie.
  it('falls back to the display name for resources with no usage', () => {
    expect(
      sortResourcesByUsage(['z-uid', 'a-uid'], [], {
        'z-uid': 'Alpha',
        'a-uid': 'Zulu',
      }),
    ).toEqual(['z-uid', 'a-uid']);
  });

  it('falls back to the identifier before the names have resolved', () => {
    expect(sortResourcesByUsage(['b', 'a'], [])).toEqual(['a', 'b']);
    expect(sortResourcesByUsage(['b', 'a'], [], undefined)).toEqual(['a', 'b']);
  });

  it('keeps a resource that has only storage reports', () => {
    expect(
      sortResourcesByUsage(['storage-only', 'busy'], [report('busy', 100)]),
    ).toEqual(['busy', 'storage-only']);
  });

  it('does not mutate the input', () => {
    const resources = ['b', 'a'];
    sortResourcesByUsage(resources, []);
    expect(resources).toEqual(['b', 'a']);
  });
});

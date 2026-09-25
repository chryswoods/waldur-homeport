import { describe, expect, it } from 'vitest';
import { type AwardDetails, type RemoteProject } from 'waldur-js-client';

import {
  buildRemoteProjectPace,
  orderByUsage,
  remotePaceUnits,
} from './remotePace';

const on = (year: number, month: number, day: number) =>
  new Date(year, month - 1, day);

const details = (overrides: Partial<AwardDetails> = {}): AwardDetails => ({
  name: null,
  template: null,
  key: null,
  description: null,
  members: null,
  start_date: '2026-01-01',
  end_date: '2026-12-31',
  allocation: '15000 GPUHR',
  notes: null,
  allowed_domains: null,
  ...overrides,
});

const remote = (overrides: Partial<RemoteProject> = {}): RemoteProject =>
  ({
    uuid: 'rp1',
    destination: 'airr.brics.isambard-ai',
    resource_name: 'Isambard-AI',
    state: 'active',
    allocation_string: null,
    current_allocation: '0',
    award_details: details(),
    last_confirmed_details: null,
    created: '2026-02-01T10:00:00Z',
    ...overrides,
  }) as RemoteProject;

describe('buildRemoteProjectPace', () => {
  it('paces the award window in the allocation unit', () => {
    const result = buildRemoteProjectPace(remote(), 7500, null, on(2026, 7, 1));

    expect(result.unit).toBe('GPUHR');
    expect(result.pace.allocation).toBe(15000);
    expect(result.pace.used).toBe(7500);
    expect(result.pace.startDate).toBe('2026-01-01');
    expect(result.pace.endDate).toBe('2026-12-31');
  });

  // A pending connection has nothing to spend against yet; pacing it would
  // call the team behind for the remote portal's delay.
  it.each(['pending', 'stale', 'error', 'deleted'] as const)(
    'does not pace a %s connection',
    (state) => {
      expect(
        buildRemoteProjectPace(remote({ state }), 10, null, on(2026, 7, 1)),
      ).toBeNull();
    },
  );

  it('waits for the usage figure', () => {
    expect(
      buildRemoteProjectPace(remote(), undefined, null, on(2026, 7, 1)),
    ).toBeNull();
  });

  it('falls back to the connection string when the award has no allocation', () => {
    const result = buildRemoteProjectPace(
      remote({
        award_details: details({ allocation: null }),
        allocation_string: '2000 NHR',
      }),
      100,
      null,
      on(2026, 7, 1),
    );

    expect(result.pace.allocation).toBe(2000);
    expect(result.unit).toBe('NHR');
  });

  it('starts from the connection and ends with the project when undated', () => {
    const result = buildRemoteProjectPace(
      remote({ award_details: details({ start_date: null, end_date: null }) }),
      100,
      '2026-11-30',
      on(2026, 7, 1),
    );

    expect(result.pace.startDate).toBe('2026-02-01');
    expect(result.pace.endDate).toBe('2026-11-30');
  });

  it('has no pace without an end date or an allocation', () => {
    expect(
      buildRemoteProjectPace(
        remote({ award_details: details({ end_date: null }) }),
        100,
        null,
        on(2026, 7, 1),
      ),
    ).toBeNull();
    expect(
      buildRemoteProjectPace(
        remote({ award_details: details({ allocation: 'lots' }) }),
        100,
        null,
        on(2026, 7, 1),
      ),
    ).toBeNull();
  });
});

describe('orderByUsage', () => {
  it('puts the connection furthest through its allocation first', () => {
    const today = on(2026, 7, 1);
    const light = buildRemoteProjectPace(
      remote({ uuid: 'a' }),
      1000,
      null,
      today,
    );
    const heavy = buildRemoteProjectPace(
      remote({ uuid: 'b' }),
      9000,
      null,
      today,
    );
    const alsoLight = buildRemoteProjectPace(
      remote({ uuid: 'c' }),
      1000,
      null,
      today,
    );

    expect(
      orderByUsage([light, heavy, alsoLight]).map((p) => p.remoteProject.uuid),
    ).toEqual(['b', 'a', 'c']);
  });
});

describe('remotePaceUnits', () => {
  it('writes amounts in the allocation unit, not as money', () => {
    const units = remotePaceUnits('GPUHR');

    expect(units.amount(14772.96)).toBe('14,773 GPUHR');
    expect(units.rate(41.096)).toBe('41.1 GPUHR');
  });

  it('writes a bare number when the allocation names no unit', () => {
    expect(remotePaceUnits(undefined).amount(1500)).toBe('1,500');
  });
});

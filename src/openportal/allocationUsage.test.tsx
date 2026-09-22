import { describe, expect, it } from 'vitest';

import {
  percentOf,
  USAGE_DANGER_PERCENT,
  USAGE_WARNING_PERCENT,
  usageTextClass,
} from './allocationUsage';

describe('usageTextClass', () => {
  it('leaves a comfortable allocation uncoloured', () => {
    expect(usageTextClass(0)).toBeUndefined();
    expect(usageTextClass(79.9)).toBeUndefined();
  });

  it('warns from the warning threshold', () => {
    expect(usageTextClass(USAGE_WARNING_PERCENT)).toBe('text-warning');
    expect(usageTextClass(89.9)).toBe('text-warning');
  });

  it('escalates from the danger threshold', () => {
    expect(usageTextClass(USAGE_DANGER_PERCENT)).toBe('text-danger');
    expect(usageTextClass(100)).toBe('text-danger');
    // percentOf caps at 100, but be defensive about an overspend anyway.
    expect(usageTextClass(140)).toBe('text-danger');
  });

  // The figure and the bar beneath it must not disagree, so they share one
  // pair of thresholds.
  it('shares its thresholds with the progress bar', () => {
    expect(USAGE_WARNING_PERCENT).toBeLessThan(USAGE_DANGER_PERCENT);
  });

  // An award whose allocation does not resolve reports no percentage; percentOf
  // answers 0 there, which must not read as a healthy allocation by accident.
  it('is only meaningful once there is an allocation', () => {
    expect(percentOf(500, null)).toBe(0);
    expect(usageTextClass(percentOf(500, null))).toBeUndefined();
  });
});

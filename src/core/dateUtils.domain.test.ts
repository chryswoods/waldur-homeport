import { Settings } from 'luxon';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ENV } from '@/core/config';
import { getOptions } from '@/form/TimeSelectField';

import {
  formatDate,
  formatDateTime,
  formatDateTimeWithZone,
  formatISODate,
  formatLongDate,
  formatLongDateTime,
  formatMediumDateTime,
  formatShortDateTime,
  formatTime,
} from './dateUtils';

const MOMENT = '2027-02-26T14:05:00Z';

describe('display dates follow the translation domain', () => {
  const plugins = ENV.plugins;
  const zone = Settings.defaultZone;
  const locale = Settings.defaultLocale;
  const useDomain = (domain: string) => {
    ENV.plugins = {
      ...plugins,
      WALDUR_CORE: { ...plugins?.WALDUR_CORE, TRANSLATION_DOMAIN: domain },
    };
  };

  beforeEach(() => {
    Settings.defaultZone = 'UTC';
    Settings.defaultLocale = 'en-GB';
  });
  afterEach(() => {
    ENV.plugins = plugins;
    Settings.defaultZone = zone;
    Settings.defaultLocale = locale;
  });

  it('puts the day first, with a 24-hour clock, by default', () => {
    useDomain('');
    expect(formatDate(MOMENT)).toBe('26 Feb 2027');
    expect(formatLongDate(MOMENT)).toBe('26 February 2027');
    expect(formatDateTime(MOMENT)).toBe('26 Feb 2027, 14:05');
    expect(formatShortDateTime(MOMENT)).toBe('26 Feb 2027, 14:05');
    expect(formatLongDateTime(MOMENT)).toBe('26 February 2027, 14:05');
    expect(formatTime(MOMENT)).toBe('14:05');
  });

  it('puts the month first, with a 12-hour clock, on the AIRR portal', () => {
    useDomain('airrportal');
    expect(formatDate(MOMENT)).toBe('Feb 26, 2027');
    expect(formatLongDate(MOMENT)).toBe('February 26, 2027');
    expect(formatDateTime(MOMENT)).toBe('Feb 26, 2027, 2:05 pm');
    expect(formatShortDateTime(MOMENT)).toBe('Feb 26, 2027, 2:05 pm');
    expect(formatLongDateTime(MOMENT)).toBe('February 26, 2027, 2:05 pm');
    expect(formatMediumDateTime(MOMENT)).toBe('February 26, 2027, 2:05 pm UTC');
    expect(formatDateTimeWithZone(MOMENT)).toBe('Feb 26, 2027, 2:05 pm (GMT)');
    expect(formatTime(MOMENT)).toBe('2:05 pm');
    // AM/PM is written as the viewer's locale writes it.
    Settings.defaultLocale = 'en-US';
    expect(formatDateTime(MOMENT)).toBe('Feb 26, 2027, 2:05 PM');
  });

  it('keeps numeric dates and stored times ISO everywhere', () => {
    useDomain('airrportal');
    expect(formatISODate(MOMENT)).toBe('2027-02-26');
    const afternoon = getOptions(60)[14];
    expect(afternoon).toEqual({ label: '2:00 pm', value: '14:00' });
  });
});

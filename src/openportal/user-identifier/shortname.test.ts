import { describe, expect, it } from 'vitest';

import {
  SHORTNAME_MAX_LENGTH,
  SHORTNAME_MIN_LENGTH,
  validateShortname,
} from './shortname';

describe('validateShortname', () => {
  it('accepts a plausible username', () => {
    expect(validateShortname('chris')).toBeUndefined();
    expect(validateShortname('abcd')).toBeUndefined();
    expect(validateShortname('a1b2c3')).toBeUndefined();
  });

  it('requires a value', () => {
    expect(validateShortname('')).toBeTruthy();
    expect(validateShortname(undefined as any)).toBeTruthy();
  });

  it('enforces the length bounds', () => {
    expect(validateShortname('abc')).toBeTruthy();
    expect(validateShortname('a'.repeat(SHORTNAME_MIN_LENGTH))).toBeUndefined();
    expect(validateShortname('a'.repeat(SHORTNAME_MAX_LENGTH))).toBeUndefined();
    expect(
      validateShortname('a'.repeat(SHORTNAME_MAX_LENGTH + 1)),
    ).toBeTruthy();
  });

  it('requires a leading lower-case letter and no other character classes', () => {
    expect(validateShortname('1abc')).toBeTruthy();
    expect(validateShortname('Abcd')).toBeTruthy();
    expect(validateShortname('ab-cd')).toBeTruthy();
    expect(validateShortname('ab.cd')).toBeTruthy();
    expect(validateShortname('ab cd')).toBeTruthy();
  });

  it('rejects the reserved names', () => {
    expect(validateShortname('admin')).toBeTruthy();
    expect(validateShortname('root')).toBeTruthy();
  });

  // The backend validator reads as "contains admin, or ends with root", which
  // rejects ordinary words and admits root-prefixed ones. We implement the
  // intent instead; these cases pin the difference so it is a decision on the
  // record rather than an accident.
  it('does not reject ordinary names that merely contain a reserved word', () => {
    expect(validateShortname('badminton')).toBeUndefined();
    expect(validateShortname('rootkit')).toBeUndefined();
    expect(validateShortname('myroot')).toBeUndefined();
  });
});

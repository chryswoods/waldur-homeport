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

  // Mirrors test_reserved_names_are_rejected_anywhere_in_the_shortname in
  // waldur_openportal/tests/test_user_shortname.py. The backend validator
  // searches rather than matches, so a reserved word anywhere is refused —
  // including in an innocent word that happens to contain one.
  it('rejects a reserved word anywhere in the name', () => {
    for (const name of [
      'admin',
      'root',
      'myadmin',
      'adminuser',
      'rootuser',
      'myroot',
      'xadminx',
      'badminton',
    ]) {
      expect(validateShortname(name), name).toBeTruthy();
    }
  });

  // The backend strips before validating, so we must not refuse a value it
  // would have accepted.
  it('trims before validating', () => {
    expect(validateShortname('  chris  ')).toBeUndefined();
    expect(validateShortname('   ')).toBeTruthy();
  });
});

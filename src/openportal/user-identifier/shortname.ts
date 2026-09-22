import { translate } from '@/i18n';

/**
 * Client-side rules for the OpenPortal username (the `shortname` field of
 * `openportal-userinfo`).
 *
 * These mirror the validators declared on `waldur_openportal.models.UserInfo`,
 * which the backend now enforces: `set_shortname()` calls `full_clean()`, and
 * the `set_shortname` action validates through `SetUserShortnameSerializer`
 * and returns a 400 naming the rule. The rules are restated here so the user
 * is told what is wrong before submitting a choice that cannot be undone, not
 * because the server would let a bad one through.
 *
 * Because the server is now the authority, these must not be *laxer* than it:
 * a value this module accepts and the backend refuses is a confusing failure
 * on a one-shot field. Keep in step with `MAX_USER_SHORTNAME_LENGTH` and the
 * validator list in `src/waldur_openportal/models.py`.
 */
export const SHORTNAME_MIN_LENGTH = 4;
export const SHORTNAME_MAX_LENGTH = 32;
export const SHORTNAME_PATTERN = /^[a-z][a-z0-9]+$/;

/**
 * Words the backend refuses anywhere in the shortname.
 *
 * The model's validator is
 * `RegexValidator(r"admin|root", flags=re.IGNORECASE, inverse_match=True)`, and
 * `RegexValidator` searches rather than matches — so this rejects `myadmin`,
 * `rootuser` and `xadminx` as well as the bare words. A shortname becomes a
 * local account name, and a privileged-looking one is refused wherever it
 * appears. Matched case-insensitively here for the same belt-and-braces reason
 * the backend does it, though the character rule already forces lower case.
 */
export const SHORTNAME_RESERVED = /admin|root/i;

/**
 * Returns an error message, or undefined when `value` is acceptable.
 * Shaped for use as a React Final Form field validator.
 */
export const validateShortname = (rawValue: string): string | undefined => {
  // The backend strips before validating, so a stray space must not produce a
  // client-side error for a value the server would have accepted.
  const value = rawValue?.trim();
  if (!value) {
    return translate('Enter a username.');
  }
  if (value.length < SHORTNAME_MIN_LENGTH) {
    return translate('Must be {count} characters or more.', {
      count: String(SHORTNAME_MIN_LENGTH),
    });
  }
  if (value.length > SHORTNAME_MAX_LENGTH) {
    return translate('Must be {count} characters or less.', {
      count: String(SHORTNAME_MAX_LENGTH),
    });
  }
  if (!SHORTNAME_PATTERN.test(value)) {
    return translate(
      'Must start with a lower-case letter and contain only lower-case letters and digits.',
    );
  }
  if (SHORTNAME_RESERVED.test(value)) {
    return translate("Cannot contain 'admin' or 'root'.");
  }
  return undefined;
};

/**
 * The help text shown under the field and as the edit dialog's subtitle.
 *
 * The first sentence is the model's own `help_text`, restated here so the
 * length rule can be folded in; the closing sentence is the part users most
 * need, because the choice is irreversible.
 */
export const shortnameDescription = (): string =>
  translate(
    'A short, unique name for you. It will be used to form your local username on any systems. Should only contain lower-case letters and digits and must start with a letter. Must be between {min} and {max} characters long. Once set, it cannot be changed.',
    { min: String(SHORTNAME_MIN_LENGTH), max: String(SHORTNAME_MAX_LENGTH) },
  );

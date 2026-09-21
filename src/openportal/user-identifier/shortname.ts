import { translate } from '@/i18n';

/**
 * Client-side rules for the OpenPortal username (the `shortname` field of
 * `openportal-userinfo`).
 *
 * These mirror the validators declared on `waldur_openportal.models.UserInfo`.
 * They are duplicated here deliberately rather than derived from the API,
 * because the write path — `PUT /api/openportal-userinfo/<user>/set_shortname/`
 * — reads `request.data["shortname"]` directly and calls `set_shortname()`
 * followed by `save()`. Neither runs `full_clean()`, and `full_clean` appears
 * nowhere in the module, so Django never executes the field validators on that
 * endpoint. The view also answers every failure with a bare 400 carrying no
 * body. This module is therefore the only thing standing between a user and an
 * unusable username, for a choice that cannot be undone.
 *
 * Keep in step with `MAX_USER_SHORTNAME_LENGTH` and the validator list in
 * `src/waldur_openportal/models.py`.
 */
export const SHORTNAME_MIN_LENGTH = 4;
export const SHORTNAME_MAX_LENGTH = 32;
export const SHORTNAME_PATTERN = /^[a-z][a-z0-9]+$/;

/**
 * Names the backend means to refuse.
 *
 * The model's validator is `RegexValidator(r"(admin)|(root)$", inverse_match=True)`,
 * which — because `|` binds loosest and `RegexValidator` uses `re.search` — reads
 * as "contains `admin`, or ends with `root`". That rejects `badminton` while
 * admitting `rootkit`, which cannot be what was meant. We implement the evident
 * intent (these two names exactly) rather than reproducing the asymmetry; see
 * docs/guides/openportal-username.md.
 */
export const SHORTNAME_RESERVED = ['admin', 'root'];

/**
 * Returns an error message, or undefined when `value` is acceptable.
 * Shaped for use as a React Final Form field validator.
 */
export const validateShortname = (value: string): string | undefined => {
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
  if (SHORTNAME_RESERVED.includes(value)) {
    return translate('"{value}" is reserved. Choose another username.', {
      value,
    });
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

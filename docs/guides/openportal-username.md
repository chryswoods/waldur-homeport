# The OpenPortal username on the user profile

How HomePort shows and sets a user's OpenPortal username (`shortname`), why it
is wired the way it is, and what still needs fixing in mastermind.

## What the user sees

With `user.minimal_user_profile` and `user.show_openportal_identifier` both on,
the profile panel holds four rows and one tab:

| Row        | Source                            | Editable?                       |
| ---------- | --------------------------------- | ------------------------------- |
| First name | `user.first_name`                 | Read-only where the IdP owns it |
| Last name  | `user.last_name`                  | Read-only where the IdP owns it |
| Email      | `user.email`                      | Read-only where the IdP owns it |
| Username   | `openportal-userinfo` `shortname` | Once, while unset               |

## The four switches, and why they are separate

| Question                     | Mechanism                              |
| ---------------------------- | -------------------------------------- |
| Which fields show?           | `user.minimal_user_profile`            |
| Which are read-only?         | `identity_provider_fields` on the user |
| Does the Username row exist? | `user.show_openportal_identifier`      |
| Is that row editable?        | `shortname === null`                   |

Read-only-ness is deliberately _not_ folded into `minimal_user_profile`.
Upstream documents that flag as "Show and allow editing of minimal set of user
profile fields", so making it also mean "and freeze them" would leave the flag
not matching its own description, and stop the restoration being something we
can offer upstream. The existing protected-field machinery is a better fit
anyway: `getProtectedFieldProps` renders a padlock and a tooltip naming the
identity provider, so the user learns _why_ a field is fixed.

Use `identity_provider_fields` (per field) rather than
`PROTECT_USER_DETAILS_FOR_REGISTRATION_METHODS` (per registration method). The
latter is blanket — read `fieldIsProtected` — and would protect every field
including the Username row, so nobody could ever choose one.

## Reading versus writing

Writes go through `PUT /api/openportal-userinfo/<user>/set_shortname/`, which
is the only way in: mastermind mirrors the shortname onto `user.slug` and keeps
them in step, and the slug is set-once everywhere else.

Reads split by purpose:

- **The profile** reads `openportal-userinfo`. It needs the set-once state, not
  just the value, to decide whether the row is editable.
- **Lists of other users** read the mirrored `user_slug` already carried on
  those serializers — same value, no extra request.

### The Username column

Where `user.show_openportal_identifier` is on, the Username column in user
lists shows the slug rather than `user.username`. A deployment may set
`user.username` to the email address, or take it from whatever the identity
provider supplies, and neither is the name a user types at a shell prompt.

`getDisplayUsername` in `@/openportal/user-identifier/displayUsername` makes
that choice once for all four lists: `TeamTableComponent` (the project and
organization team tables), `SummaryTeamTable`, `ResourceProjectExpandable` and
`UserList`. The separate slug columns — the "ID" column in `TeamTableComponent`
and the "Shortname" column in `UserList` — are suppressed when it is on, since
they would then duplicate the Username column.

**An absent slug renders as a dash, never as `user.username`.** Falling back
would put an email under a "Username" heading, which is the confusion the
column exists to remove. Empty counts as absent as well as null: `User.slug` is
a non-null `SlugField`, so a slug mastermind has cleared arrives as `''`.

### Why an absent slug means "not chosen"

`User.get_slug_source_field()` returns `"username"`, and `SlugMixin.save()`
fills the slug whenever it is empty:

```python
def save(self, *args, **kwargs):
    if not self.slug:
        self.slug = self.generate_slug()
```

So historically every user got a slugified `username` — an email, in a
deployment that identifies users that way — long before choosing a shortname,
and nothing reading `user_slug` could tell that value from one `set_shortname`
had written. That is what made a slug look like a chosen OpenPortal username
when none had been set.

The fix is in mastermind, not here: stop auto-generating the user slug where
OpenPortal owns it, and clear the ones already generated. The frontend then
needs no heuristic — a slug is present or it is not. See the prompt below.

## Validation

The backend is the authority, as of `638c11df` on
`claude/waldur-mastermind-resync-analysis-w824hs`. Before that commit the
validators declared on `UserInfo.shortname` never ran — the action read
`request.data["shortname"]` directly and called `save()`, which does not run
them — so `admin`, `UPPER`, `1leading` and even `ok name` were all accepted.
Now `set_shortname()` calls `full_clean()` and the action validates through
`SetUserShortnameSerializer`, so a violation comes back as a 400 naming the
rule.

`src/openportal/user-identifier/shortname.ts` restates the rules so a user is
told what is wrong before submitting a choice that cannot be undone. It must
never be _laxer_ than the backend: a value the frontend accepts and the server
refuses is a confusing failure on a one-shot field.

| Rule       | Backend                                   | Frontend                               |
| ---------- | ----------------------------------------- | -------------------------------------- |
| Characters | `^[a-z][a-z0-9]+$`                        | same                                   |
| Length     | 4 to `MAX_USER_SHORTNAME_LENGTH` (32)     | same                                   |
| Reserved   | `admin\|root`, searched, case-insensitive | same, as a regex `test`                |
| Whitespace | stripped before validating                | trimmed before validating              |
| Uniqueness | database                                  | server only — reported through the 400 |

### The reserved-name rule rejects more than the two words

It is a search, not a match, so a reserved word **anywhere** in the shortname is
refused: `myadmin`, `adminuser`, `rootuser`, `myroot` and `xadminx` are all
rejected, and so is an innocent word like `badminton`. That is deliberate — the
shortname becomes a local account name, and a privileged-looking one is worth
refusing wherever it appears.

The frontend previously implemented the two words exactly, because the old
backend regex `(admin)|(root)$` read as "contains `admin`, or ends with `root`"
and so admitted `rootkit` while rejecting `badminton` — an asymmetry that could
not have been intended. The fix anchored it to `admin|root`, and the frontend
now matches. `shortname.test.ts` mirrors
`test_reserved_names_are_rejected_anywhere_in_the_shortname`.

### Errors carry a reason

A rejection returns `{"shortname": [...]}`, which `showErrorResponse` appends to
the notification. The message in `useOpenPortalUsername` therefore says only
that the username could not be set and lets the server say why.

### Users can set their own

The viewset is staff-write (`IsAdminOrReadOnly`), which used to reject the owner
with a 403 before the action's own owner-or-staff check could run — so the one
person the endpoint exists for could not use it. The action now requires only
authentication and leaves authorisation to that check. Without this the Username
row would be unusable for everyone but staff.

## Open mastermind issues

Fixed in `638c11df`: the validators now run; the reserved-name regex is
anchored; a rejected change no longer leaves the slug moved, because
`set_shortname` validates before writing and puts the shortname and its copy in
one transaction; the 400 carries a body; and a user can set their own.

Fixed in the schema, and carried by `waldur-js-client`
`8.1.3-rc.15-openportal.2`: the `{user}` path parameter is declared a UUID
string, and `set_shortname` has its own `SetUserShortnameRequest` whose only
field is `shortname`. Both workarounds this guide used to describe —
`userPathParam`, and the redundant `user` in the request body — are gone, and
`useOpenPortalUsername.ts` now holds no casts at all.

What remains:

### 1. `ProjectInfo` has every gap `UserInfo` had

`638c11df` says so explicitly and leaves it alone: the project shortname's
validators are bypassed the same way, and its reserved-name ban is
`(-admin)|(-root)$`, with the same search-versus-match asymmetry that let
`rootuser` through on the user side. Not urgent for HomePort, which does not
offer a project shortname row, but it is the same bug waiting in the same
place.

### 2. Latent bug in `save()`, in two models

```python
kwargs["update_fields"] = set(kwargs["update_fields"]).add("query_field")
```

`set.add()` returns `None`, so `update_fields` becomes `None` — which Django
reads as "save every field". It degrades to a full save rather than crashing,
and `query_field` is not a field on either model. Present on both `UserInfo`
and `ProjectInfo`.

## Prompt for waldur-mastermind: the feature flag

`user.show_openportal_identifier` is carried by hand in HomePort's generated
`FeaturesEnums.ts` and `FeaturesDescription.ts`. Until mastermind declares it,
those two files disagree with their generator and the next
`./docs/update-local-sdk.sh` run silently drops the entry.

> In `src/waldur_core/core/features.py`, add a feature to `UserSection`:
>
> ```python
> show_openportal_identifier = Feature(
>     "Identify users by their OpenPortal username: show it in place of the username in user lists, show it on the user profile, and let a user choose it once if it has not been set."
> )
> ```
>
> Reproduce the description string exactly as given. HomePort's
> `src/FeaturesEnums.ts` and `src/features/FeaturesDescription.ts` are generated
> from this file by `waldur print_features_enums` and
> `waldur print_features_description`, and both already carry this entry by
> hand; the strings must match or the next regeneration will change them.
>
> Declaration order within the section does not matter — both generators sort
> alphabetically, so the entry lands between `show_identity_bridge` and
> `show_slug` in the output either way. Put it next to `minimal_user_profile`,
> which it composes with.
>
> Verify by running both generators and diffing against HomePort's checked-in
> files: the only new lines should be
>
> ```
> show_openportal_identifier = 'user.show_openportal_identifier',
> ```
>
> and the description entry, both verbatim. Check that ruff leaves the long
> string alone, as it did for `show_openportal_accounting_only`.
>
> This is presentational only and needs no backend reader. It gates a profile
> row whose data — the `shortname` on `openportal-userinfo`, and its copy on
> `user.slug` — stays readable through the API either way, so it is not an
> access control. The precedent is `show_openportal_accounting_only`
> (`d6499945`), which confirmed that the only backend reader of a core feature
> is `invoices.utils.affiliates_feature_enabled()`, and that it reads the
> Constance setting rather than the feature entry.

## Prompt for waldur-mastermind: the remaining bugs

> In `src/waldur_openportal`, three follow-ups to the shortname work in
> `638c11df`.
>
> 1. Make an absent user slug mean "no OpenPortal username has been chosen".
>    Today `User.get_slug_source_field()` returns `"username"` and
>    `SlugMixin.save()` fills the slug whenever it is empty, so every user gets
>    a slugified username — an email, in a deployment that identifies users
>    that way — before they ever choose a shortname. Nothing reading
>    `user.slug` can then tell that value from one `set_shortname` wrote, and
>    HomePort shows it as though it were a chosen username.
>
>    Stop auto-generating the user slug where the OpenPortal plugin owns it,
>    and clear the ones already generated. Two things to watch:
>
>    - Clearing alone is not enough: `SlugMixin.save()` regenerates the moment
>      the user record is saved again for any reason, so the auto-generation
>      has to be suppressed too.
>    - The backfill will trip the guard added in `1bc8dd35`, which raises
>      `ValidationError` when the slug changes and a previous value was set —
>      exactly what clearing does. It has to set `_syncing_to_userinfo`, the
>      way the existing bulk reconciliation in `waldur_openportal.utils` does.
>
>    `UserInfo.shortname` is the authority for the backfill: clear the slug of
>    any user whose `UserInfo` has no shortname. Nothing looks a user up by
>    slug — there is no `lookup_field = "slug"` in `waldur_core`, and HomePort
>    does not route on it — and `slug = models.SlugField()` carries no
>    `unique=True`, so empty values are fine. Add a test that a user with no
>    shortname has an empty slug, and that it stays empty across a later save.
>
> 2. `ProjectInfo.shortname` has the gaps `UserInfo.shortname` had: its
>    validators are bypassed because the `set_shortname` action reads
>    `request.data` directly, and its reserved-name ban is `(-admin)|(-root)$`,
>    which `RegexValidator` searches rather than matches. Give the action a
>    request serializer so the declared rules are enforced and a violation
>    returns a 400 naming the rule, and anchor the ban the way the user one now
>    is. Mirror the tests in `tests/test_user_shortname.py`.
>
> 3. In both `UserInfo.save` and `ProjectInfo.save`,
>    `set(kwargs["update_fields"]).add("query_field")` evaluates to `None`
>    because `set.add` returns `None`, and `query_field` is not a field on
>    either model. Work out what was intended and fix or remove it.

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
them in step, and the slug is immutable everywhere else.

Reads split by purpose:

- **The profile** reads `openportal-userinfo`, because only `shortname`
  distinguishes "never chosen" from "chosen", and that is what decides whether
  the row is editable. An empty `slug` does not mean the same thing — Waldur
  auto-populates slugs.
- **Lists of other users** should keep using the mirrored `user_slug` already
  carried on those serializers. It is the same value, needs no extra request,
  and is already rendered in `RoleUsersExpandableRow`, `ProviderOfferingUsersList`
  and others.

The row nests its own `EditFieldProvider`, overriding the panel's for that
subtree only, so it looks and behaves like every other field while writing to a
different endpoint entirely.

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

## Prompt for waldur-mastermind

> In `src/waldur_openportal`, two follow-ups to the shortname work in
> `638c11df`.
>
> 1. `ProjectInfo.shortname` has the gaps `UserInfo.shortname` had: its
>    validators are bypassed because the `set_shortname` action reads
>    `request.data` directly, and its reserved-name ban is `(-admin)|(-root)$`,
>    which `RegexValidator` searches rather than matches. Give the action a
>    request serializer so the declared rules are enforced and a violation
>    returns a 400 naming the rule, and anchor the ban the way the user one now
>    is. Mirror the tests in `tests/test_user_shortname.py`.
>
> 2. In both `UserInfo.save` and `ProjectInfo.save`,
>    `set(kwargs["update_fields"]).add("query_field")` evaluates to `None`
>    because `set.add` returns `None`, and `query_field` is not a field on
>    either model. Work out what was intended and fix or remove it.

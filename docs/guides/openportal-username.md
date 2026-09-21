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

## Validation lives in the frontend, of necessity

`src/openportal/user-identifier/shortname.ts` is the real gate. The backend's
is not, for three reasons.

**The model validators never run.** `UserInfo.shortname` declares
`RegexValidator`, `MinLengthValidator(4)` and `MaxLengthValidator(32)`, but the
`set_shortname` action reads `request.data["shortname"]` directly and calls
`set_shortname()` then `save()`. Neither runs `full_clean()`, and `full_clean`
appears nowhere in `waldur_openportal`, so Django never executes them. What is
actually enforced is: non-empty (a `ValueError` in `set_shortname`), no second
change (`ValueError`, plus the `FieldTracker` guard in `save`), and uniqueness
and length at the database.

`admin` is therefore accepted today.

**The reserved-name regex would not do what it looks like.** It is
`RegexValidator(r"(admin)|(root)$", inverse_match=True)`. `|` binds loosest and
`RegexValidator` uses `re.search`, so it reads as "contains `admin`, or ends
with `root`":

| Value       | Rejected?                           |
| ----------- | ----------------------------------- |
| `admin`     | yes                                 |
| `root`      | yes                                 |
| `badminton` | yes — almost certainly not intended |
| `rootkit`   | **no** — slips through              |
| `myroot`    | yes                                 |

It also carries no `message=`, so it would emit Django's default "Enter a valid
value."

The frontend implements the evident intent — those two names exactly — rather
than reproducing the asymmetry. If mastermind's regex is fixed to
`^(admin|root)$` the two agree exactly; until then a name like `badminton`
would pass here and, once `full_clean` is wired up, fail there.

**Failures carry no message.** The view answers every exception with a bare
`Response(status=HTTP_400_BAD_REQUEST)`; the reason is only logged server-side.
There is nothing for the client to unpack, which is why the error notification
has to name the likely causes itself.

## Open mastermind issues

### 1. A rejected second change still overwrites the slug

In `UserInfo.set_shortname`, the slug is written and the user saved _before_
the "cannot change" check:

```python
self.user.slug = shortname
self.user.save(update_fields=["slug"])

if self.shortname and self.shortname != shortname:
    raise ValueError(f"Cannot change shortname ... ")
```

So a second attempt is refused — the caller gets a 400 and `shortname` is
unchanged — but the user's slug has already been overwritten with the rejected
value. Slug and shortname then disagree, which is exactly the drift the
mirroring exists to prevent. The guard needs to run first.

### 2. The `{user}` path parameter is typed as an integer

The generated client declares `path: { user: number }`, but `UserInfoViewSet`
sets `lookup_field = "user"` and `_get()` resolves it with
`User.objects.get(uuid=user)` — the segment is a UUID string. HomePort has no
numeric user id at all. The single workaround is `userPathParam` in
`useOpenPortalUsername.ts`; annotate the path parameter in mastermind,
regenerate the SDK, and delete it.

### 3. `set_shortname`'s request body demands a redundant `user`

The action reads only `shortname`, but `UserInfoSerializer` is reused as the
request body, so the generated type makes `user` required. A dedicated request
serializer would make the signature honest.

### 4. Latent bug in `UserInfo.save`

```python
kwargs["update_fields"] = set(kwargs["update_fields"]).add("query_field")
```

`set.add()` returns `None`, so `update_fields` becomes `None` — which Django
reads as "save every field". It degrades to a full save rather than crashing,
and `query_field` is not a field on the model in any case.

## Prompt for waldur-mastermind

> In `src/waldur_openportal`, fix four issues with the user shortname.
>
> 1. `UserInfo.set_shortname` writes `self.user.slug` and saves the user before
>    checking whether the shortname may be changed, so a rejected second change
>    still overwrites the slug and leaves it disagreeing with the shortname.
>    Move the "cannot change" guard ahead of the slug write. Add a test that a
>    second `set_shortname` leaves both `shortname` and `user.slug` untouched.
>
> 2. The model's validators never run on the `set_shortname` action, because the
>    view reads `request.data["shortname"]` directly and calls `set_shortname()`
>    and `save()`, neither of which calls `full_clean()`. Validate the input —
>    either by calling `full_clean(exclude=...)` before saving, or by giving the
>    action a small request serializer that carries the same validators. Add
>    tests that `admin`, `abc` (too short), `1abc` and a 33-character name are
>    all refused.
>
> 3. The reserved-name validator is
>    `RegexValidator(r"(admin)|(root)$", inverse_match=True)`. Because `|` binds
>    loosest and `RegexValidator` uses `re.search`, this means "contains admin,
>    or ends with root": it rejects `badminton` and accepts `rootkit`. Change it
>    to `^(admin|root)$` and give it a `message=` so the reason reaches the
>    client. If the reserved list is expected to grow, put it in a module-level
>    constant.
>
> 4. `UserInfoViewSet.set_shortname` answers every failure with a bare
>    `Response(status=HTTP_400_BAD_REQUEST)`, so the client gets no reason at
>    all. Return the validation message in the body, in DRF's usual shape.
>
> Also two schema fixes so the generated TypeScript client matches reality:
>
> - The `{user}` path parameter on `openportal-userinfo` is a UUID
>   (`lookup_field = "user"`, resolved with `User.objects.get(uuid=user)`), but
>   drf-spectacular infers an integer. Annotate it with an `OpenApiParameter` of
>   type UUID. The same applies to `{project}` on `openportal-projectinfo`.
> - `set_shortname` reuses `UserInfoSerializer` as its request body, which makes
>   `user` a required field even though the action ignores it. Give it a request
>   serializer carrying only `shortname`.
>
> Finally, in `UserInfo.save`, `set(kwargs["update_fields"]).add("query_field")`
> evaluates to `None` because `set.add` returns `None`, and `query_field` is not
> a field on the model. Work out what was intended and fix or remove it.

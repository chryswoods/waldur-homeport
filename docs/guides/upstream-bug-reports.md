# Bugs found in upstream, with fixes carried in this fork

Eight defects in `waldur/waldur-homeport` that this fork has already fixed
locally, written up so they can be discussed with the upstream maintainers and,
if they agree, offered back as patches.

**Nothing here has been sent upstream.** These are notes for review.

| | |
| --- | --- |
| Verified against | `upstream/develop` at `3e867acb3` (2026-09-04) |
| Also confirmed present in | tag `8.1.3-rc.8` (`9fdb3e812`, 2026-09-01), which this fork is based on |
| Fork branch carrying the fixes | `claude/waldur-homeport-resync-ttwxn2` |
| How they were found | Resyncing this fork onto upstream, September 2026 |

All eight are present in both the newest release candidate and the current
development head, so none of them is something upstream has already fixed and
not yet tagged.

Every line reference below is to **upstream's** file at `3e867acb3`, not to this
fork's copy. Each finding states what was actually checked, so a maintainer can
confirm it without re-deriving the analysis.

None of these are specific to this fork's OpenPortal work. They affect any
Waldur deployment.

---

## 1. ECharts: `dataZoom` and `treemap` are used but never registered

**Severity:** medium — one default-on widget silently loses a control, one
opt-in feature does not render at all.
**Fork fix:** `78dbb78c3` (`src/echarts/index.ts`)

### What is wrong

`src/echarts/index.ts` builds a tree-shaken ECharts bundle and registers six
modules:

```ts
import * as echarts from 'echarts/lib/echarts';

import 'echarts/lib/component/legend';
import 'echarts/lib/component/tooltip';
import 'echarts/lib/component/toolbox';
import 'echarts/lib/chart/bar';
import 'echarts/lib/chart/line';
import 'echarts/lib/chart/pie';
import './themes';
```

`src/core/EChart.tsx` loads exactly this bundle (`import('@/echarts')`, lines 57
and 84), so a chart option naming anything outside that list is dropped: ECharts
logs a console warning and renders the rest of the chart without it.

Upstream's own chart options ask for two modules that are not on the list:

| Module | Used at |
| --- | --- |
| `dataZoom` | `src/marketplace/aggregate-limits/utils.ts:184` |
| `dataZoom` | `src/marketplace/aggregate-limits/usage-views/utils.ts:164` |
| `dataZoom` | `src/openportal/reports/usageChartOptions.ts:293` |
| `dataZoom` | `src/openportal/reports/storageChartOptions.ts:506, 791` |
| `dataZoom` | `src/openportal/reports/OrganisationAllocationTab.tsx:215, 360` |
| `treemap` | `src/marketplace/aggregate-limits/usage-views/views/TreemapView.tsx:157` |

### Why it matters

Two distinct consequences, one of them on a widget that is on by default:

- **`AggregateLimitWidget`** is rendered from `src/project/ProjectDashboard.tsx`
  whenever a project has components (line 135, `shouldShowAggregateLimitWidget`)
  — no feature flag. Its options add a zoom slider once a project has more than
  15 components (`aggregate-limits/utils.ts:184`). Those are exactly the
  projects whose bars are too crowded to read, and the slider that would fix
  that never appears.
- **`TreemapView`** is the entire content of one usage view. It is gated behind
  `DashboardFeatures.usage_treemap`
  (`usage-views/UsageViewsSection.tsx:49`), so it is invisible until an operator
  enables it — at which point the tab appears and draws nothing. That is
  probably why this has gone unnoticed.

Two signs that this was an oversight rather than a decision:

- `src/echarts/themes.ts` styles `dataZoom` in both themes (lines 96 and 225).
  The styling exists for a component that cannot currently render.
- The docblock at the top of `src/openportal/reports/storageChartOptions.ts`
  says of its treemap mode: *"Requires the treemap chart type to be registered
  in echarts/index.ts."* The requirement was known and written down; the
  registration was never added. (That file no longer builds a treemap series
  itself — the docblock is stale on that point — but `TreemapView.tsx` does.)

### Suggested fix

Two import lines in `src/echarts/index.ts`:

```ts
import 'echarts/lib/component/dataZoom';
import 'echarts/lib/chart/treemap';
```

### Worth checking alongside

The same class of mistake is easy to reintroduce, since nothing fails at build
time. A lint rule or a test that cross-references the module names appearing in
chart options against the registrations in `src/echarts/index.ts` would catch
the next one.

---

## 2. `checkScope` only considers the first role a user holds on a scope

**Severity:** medium — permissions are denied that should be granted, and which
role wins depends on API ordering.
**Fork fix:** `78dbb78c3` (`src/permissions/hasPermission.ts`)

### What is wrong

`src/permissions/hasPermission.ts:19`:

```ts
const userRole = user.permissions?.find(
  ({ scope_uuid, scope_type }) =>
    scope_uuid === targetScopeId && scope_type === targetScopeType,
);
if (userRole) {
  const role = ENV.roles.find(({ name }) => name === userRole.role_name);
  if (role && role.permissions.includes(targetPerm)) {
    return true;
  }
}
```

`find` stops at the first permission matching the scope. A user may hold
several roles on the same scope — `CALL.MANAGER` and `CALL.REVIEWER` on one
call is the ordinary case — and only the first is ever consulted.

### Why it matters

If the first matching permission's role does not grant the requested
permission, the check returns false even when a second role on the same scope
does grant it. Whether a user can do something therefore depends on the order
`user.permissions` happens to arrive in, which is not a guarantee the API
makes. The symptom is an action or tab missing for someone who should have it,
and it will look intermittent: two users with the same two roles can behave
differently, and one user can behave differently after a re-login.

### Secondary issue in the same function

The function has no explicit `return false`. When the scope matches but the
role does not grant the permission, control falls off the end at line 29 and it
returns `undefined`. Callers treat that as falsy so behaviour is unaffected
today, but the inferred return type is `boolean | undefined`, which will quietly
defeat any future strict-boolean check.

### Suggested fix

Filter rather than find, and return an explicit boolean:

```ts
const userRoles =
  user.permissions?.filter(
    ({ scope_uuid, scope_type }) =>
      scope_uuid === targetScopeId && scope_type === targetScopeType,
  ) ?? [];

for (const userRole of userRoles) {
  const role = ENV.roles.find(({ name }) => name === userRole.role_name);
  if (role && role.permissions.includes(targetPerm)) {
    return true;
  }
}

return false;
```

---

## 3. Two marketplace pages crash when an offering's plugin is not in the list

**Severity:** medium — an uncaught `TypeError` takes down the whole page.
**Fork fix:** `78dbb78c3` (both files)

### What is wrong

`src/marketplace/details/DetailsPage.tsx:25-28`:

```ts
const plugins = await marketplacePluginsList();
const pluginLimits = plugins.data.find(
  (plugin) => plugin.offering_type === offering.type,
).available_limits;
const limits = offering.effective_available_limits || pluginLimits;
```

and the same shape in `src/marketplace/orders/OrderDetailsContainer.tsx:36-39`.

`Array.prototype.find` returns `undefined` when nothing matches, and
`.available_limits` is read off it unguarded.

### Why it matters

`marketplacePluginsList()` returns the plugin types the backend currently has
registered. An offering whose `type` is not among them is not hypothetical: a
plugin disabled or removed on the backend while offerings of that type still
exist will do it, as will an imported or remote offering of a type this
deployment does not run. In that case `loadData` throws a `TypeError` and the
offering details page — or the order details page — fails to load entirely,
rather than degrading to "no limits available".

Note the line immediately after: `offering.effective_available_limits ||
pluginLimits` is a fallback for exactly this situation, but it can never run,
because the throw happens while computing `pluginLimits` on the line before.

### Suggested fix

Optional-chain the lookup in both files, which also lets the existing fallback
do its job:

```ts
const pluginLimits = plugins.data.find(
  (plugin) => plugin.offering_type === offering.type,
)?.available_limits;
```

---

## 4. Notification template edits can be silently discarded

**Severity:** medium — a saved edit is dropped with a success message.
**Fork fix:** `d0577b53d` (`src/administration/notifications/NotificationUpdateDialog.tsx`)

### What is wrong

`src/administration/notifications/NotificationUpdateDialog.tsx:18-31`:

```ts
function findDifferentTemplates(formTemplate, initTemplate) {
  const formTemplates = formTemplate.templates;
  const initTemplates = initTemplate.templates;

  return formTemplates.filter((template1) => {
    const matchingTemplate2 = initTemplates.find(
      (template2) => template2.content === template1.content,
    );
    return !matchingTemplate2;
  });
}
```

Each edited template is compared against **every** original template by content,
rather than against its own original by `uuid`. A template counts as unchanged
if *any* template in the notification started out with the content it now has.

### Why it matters

Reproduction, on any notification with two or more templates:

1. Template A has content `"X"`, template B has content `"Y"`.
2. Edit A so its content is `"Y"`. Leave B alone.
3. Save.

`findDifferentTemplates` looks for an original template whose content is `"Y"`,
finds B, and concludes A is unchanged. A is excluded from
`templatesToUpdate`, no override is sent for it, and — because the list is not
empty only if *something* differs — the dialog reports success. The edit is
gone on reload.

Swapping two templates' contents fails the same way, and neither is saved.

Copying one template's wording to another is a natural thing for an operator
to do, so this is reachable in normal use.

### Suggested fix

Compare each template against its own original:

```ts
function findDifferentTemplates(
  formTemplates: NotificationTemplateDetailSerializers[],
  baseTemplates: NotificationTemplateDetailSerializers[],
) {
  return formTemplates.filter((formTemplate) => {
    const base = baseTemplates.find((t) => t.uuid === formTemplate.uuid);
    return base && formTemplate.content !== base.content;
  });
}
```

called as `findDifferentTemplates(formData.templates, normalizedTemplates)`.

---

## 5. Non-overridden notification templates preview as blank

**Severity:** low — cosmetic, but it makes a whole panel look broken.
**Fork fix:** `4d20ffca1` (`src/administration/notifications/NotificationExpandableRow.tsx`)

### What is wrong

`src/administration/notifications/NotificationExpandableRow.tsx:55` and `63`
render `template.content` directly, both as the copy-button payload and as the
`<pre>` body.

The API models an un-customised template as `content: null`, with the default
text in a separate field. From the generated client:

```ts
export type NotificationTemplateDetailSerializers = {
  readonly content: string | null;
  readonly original_content: string | null;
  readonly is_content_overridden: boolean;
  // ...
};
```

### Why it matters

Any template an operator has not customised — the common case, and the state
every template starts in — shows an empty preview and copies an empty string.
There is no indication that a default exists.

`NotificationUpdateDialog` in the same directory already handles this correctly
(line 42, `content: t.content ?? t.original_content ?? ''`), so the read-only
view and the edit dialog currently disagree about what a template contains.

### Suggested fix

Fall back the same way the dialog does:

```tsx
value={template.content ?? template.original_content}
```

in both places. `is_content_overridden` is also available if the UI should
distinguish a customised template from a default one.

---

## 6. End-date countdowns are one day long

**Severity:** medium — users plan around a day of access they do not have.
**Fork fix:** see `src/core/dateUtils.ts` (`lastAccessDate`,
`daysUntilAccessEnds`, `formatRelativeEndDate`) and its three call sites.

### What is wrong

An end date in Waldur is **exclusive**: on the date itself, access is already
gone. From `waldur_core/structure/models.py`:

```python
@property
def is_expired(self):
    effective_end_date = self.get_effective_end_date()
    return effective_end_date and effective_end_date <= timezone.now().date()
```

Note `<=`. A project whose `effective_end_date` is 30 Sep is expired **on** 30
Sep, and its resources are gone. The last day anyone can use it is 29 Sep.

The frontend counts to the end date itself, so every countdown is one day long
and every "until" sentence names a day that is already too late:

- `src/project/GracePeriodWarningBar.tsx:71-77` computes
  `Math.ceil((effectiveEndDate - now) / 86400000)`, and line 89 renders
  "Resources will remain active until {effectiveEndDate}". On 16 Sep, for an
  effective end of 30 Sep, the bar reads:

  > Grace period active: This project ended on 31 Aug 2026. Resources will
  > remain active until 30 Sep 2026. 14 days remaining.

  The resources are deleted at the start of 30 Sep. The true reading is
  "until the end of 29 Sep 2026. 13 days remaining."

- `src/project/ProjectLifecycleBadge.tsx:41` and `:60` compute the same way,
  giving "In grace, 14d left" and "Ends in 14d" for the same project. Line 67's
  "Ends today" fires on the end date, by which time the project has ended.

- `src/marketplace/resources/details/EndDateField.tsx` passes the termination
  date and both tooltip dates through `formatRelative`, giving
  "30 Sep 2026 (in 14 days)".

- `src/project/ProjectProfile.tsx:136` and `:145` repeat the calculation a
  third time for the dashboard hero, so the hero and the warning bar disagree
  by a day about the same project: "End date: 31 Aug 2026 (in grace period,
  14 days left)" under a bar reading "13 days remaining".

### Why it matters

This is the failure mode users actually hit. People read "ends 30 Sep" as "I
have until the 30th", schedule the last of their work for that day, and find
the project gone when they arrive. For a grace period the cost is not an
inconvenience: the grace period exists so people can copy their data out, and
the banner is the thing telling them how long they have to do it.

The error is small enough to be invisible in review and large enough to matter
in practice, because it is always in the direction of promising more time than
exists.

### Suggested fix

Count to the last day of access rather than to the end date, and phrase
"until" sentences against that day. In this fork that is three helpers in
`src/core/dateUtils.ts`:

```ts
export const lastAccessDate = (endDate: DateInput): DateTime =>
  parseDate(endDate).startOf('day').minus({ days: 1 });

export const daysUntilAccessEnds = (endDate: DateInput): number => ...
export const formatRelativeEndDate: DateFormatter = ...
```

with the three call sites above using them, and the zero case worded ("Today
is the last day", "Last day") rather than shown as "0 days remaining".

### Worth checking alongside

`Project.is_in_grace_period` uses `today <= effective_end_date` while
`is_expired` uses `effective_end_date <= today`, so on the effective end date
itself **both** are true. The frontend happens to resolve this in the right
order (`GracePeriodWarningBar` tests `isExpired` first), but the model is
ambiguous about a date that should belong to exactly one state.

Separately, with a non-zero grace period `is_in_grace_period` requires
`end_date < today`, so on `end_date` a project is neither active-with-warning
nor in grace. This fork treats `end_date` as exclusive everywhere for
consistency; upstream may want to decide that boundary deliberately.

---

## 7. Impersonation is refused for users who have never logged in

**Severity:** medium — blocks the workflow the feature exists for.
**Fork fix:** `src/user/support/UserImpersonateButton.tsx`

### What is wrong

`src/user/support/UserImpersonateButton.tsx:23` disables the action unless the
target holds an auth token:

```tsx
disabled={isPending || !row.has_active_session}
tooltip={
  !row.has_active_session &&
  translate('Impersonation is not available for users without active session.')
}
```

The backend asks for no such thing. Impersonation sends
`X-IMPERSONATED-USER-UUID` alongside the **caller's** token, and
`waldur_core/core/authentication.py` swaps the identity on that request:

```python
if impersonated_user_uuid and token.user.is_staff:
    if passkey_policy.is_enforced_for(token.user) and not is_session_verified(token):
        raise exceptions.AuthenticationFailed(
            _("Impersonation requires a passkey-verified session.")
        )
    impersonated_user = models.ImpersonatedUser.all_objects.filter(
        uuid=impersonated_user_uuid
    ).first()
```

Three conditions: the caller is staff, the caller's session is passkey-verified
where the policy demands it, and the target exists. The target's own session is
never consulted, and could not be — the request authenticates as the staff
member throughout. There is no session to take over.

`has_active_session` is `hasattr(user, "auth_token") and user.auth_token is not
None` (`waldur_core/structure/serializers.py`, `get_has_active_session`), so the
guard turns on whether the target happens to hold a token right now.

### Why it matters

It refuses exactly the case staff most need: checking what a newly created
account will see before handing it over. The tooltip also states a reason that
is not the real one, so an operator has no way to tell that the restriction is
imposed by the frontend alone.

It is not a security control. Removing it grants nothing the backend would not
already have allowed — the real gates (staff, passkey verification) are
server-side and unaffected.

### Suggested fix

Drop the condition and the tooltip:

```tsx
disabled={isPending}
```

If a hint is still wanted for a user who has never logged in, it belongs as an
informational note rather than as a block.

---

## 8. A column added after a reader's column state was stored never appears

**Severity:** medium — silent, and the only way out is a button most people
will not think to press.
**Fork fix:** `src/table/Table.tsx`

### What is wrong

`src/table/Table.tsx:541-551` initialises column visibility once, on mount,
with an empty dependency list:

```tsx
// Initialize optional columns
useEffect(() => {
  if (columns?.length && hasOptionalColumns) {
    columns.forEach((column) => {
      toggleColumn(column.id, column, column.optional ? false : true);
    });
    if (rowActions) {
      toggleColumn(COLUMN_ACTIONS_KEY, { keys: [] }, true);
    }
  }
}, []);
```

Column visibility is persisted per reader. A column that does not exist at that
moment — added in a later release, or pushed once a feature flag resolves — is
never passed to `toggleColumn`, so `activeColumns[id]` stays undefined and the
column does not render. The effect never runs again, so it never recovers.

### Why it matters

It is silent and it is permanent. Every release that adds a column to an
existing table ships it invisible to everyone who has used that table before,
while appearing correctly for anyone who has not. The column *is* listed in the
column menu, unticked, so a reader who goes looking can find it — but nothing
indicates there is anything to look for, and the obvious remedy (Reset) also
discards every other choice they have made.

### Suggested fix

Re-run when the set of column ids changes, and initialise only ids not seen
before — re-applying the default to a column the reader has already shown or
hidden would undo their choice every time the column set shifted:

```tsx
const initialisedColumnsRef = useRef<Set<string>>(new Set());
const columnIdsKey = columns?.map((column) => column.id).join(',');
useEffect(() => {
  if (columns?.length && hasOptionalColumns) {
    columns.forEach((column) => {
      if (initialisedColumnsRef.current.has(column.id)) return;
      initialisedColumnsRef.current.add(column.id);
      toggleColumn(column.id, column, column.optional ? false : true);
    });
    // ... same for COLUMN_ACTIONS_KEY
  }
}, [columnIdsKey, hasOptionalColumns]);
```

---

## Observation, not a bug: a dropped query parameter reads as "no filter"

Raising this because it caused a visible defect in this fork and the same
pattern is widespread upstream, not because a specific upstream call site is
known to be broken.

Two behaviours combine badly:

- The generated client's query serializer
  (`node_modules/waldur-js-client/dist/client/utils.gen.js`,
  `createQuerySerializer`) iterates whatever object it is given and **skips
  `undefined` and `null` values silently**.
- Every `*_uuid` query parameter is optional in the schema, so the API treats an
  absent filter as "no filter" and returns everything the caller may see.

So a filter value that is momentarily undefined does not produce an error or an
empty result. It produces a **complete, unfiltered list**, rendered by a
component that believes it is scoped. For a staff user, whose querysets are not
narrowed, that is every row in the deployment.

The usual mitigation is already applied in most places — `enabled:
Boolean(x?.uuid)` on the `useQuery` — for example
`src/proposals/review/tabs.tsx:51` and
`src/marketplace/resources/request-end-date-change/RequestEndDateChangeFlowDialog.tsx:37`.

One upstream site relies on an invariant instead of a guard:
`src/project/manage/ProjectCredit.tsx:27-37` queries
`projectCreditsList({ query: { project_uuid: project?.uuid } })` with no
`enabled`, and then displays `response.data[0]` as this project's credit. If
`project` were ever undefined, the widget would show **another project's credit
figures** as though they belonged to this one.

As far as we can tell this is not currently reachable: the "Credit management"
tab is only registered when `project.project_credit` is set
(`src/project/ProjectManageContainer.tsx:106`), and `project` is dereferenced
unguarded on that same line, so it must be defined by then. It is defence in
depth rather than a live defect — but the failure mode is bad enough, and cheap
enough to close, that it seems worth mentioning.

A generic guard would be worth considering: where a list is scoped by a
parameter, a missing parameter should yield nothing rather than everything.

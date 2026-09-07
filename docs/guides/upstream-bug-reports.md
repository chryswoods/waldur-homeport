# Bugs found in upstream, with fixes carried in this fork

Five defects in `waldur/waldur-homeport` that this fork has already fixed
locally, written up so they can be discussed with the upstream maintainers and,
if they agree, offered back as patches.

**Nothing here has been sent upstream.** These are notes for review.

| | |
| --- | --- |
| Verified against | `upstream/develop` at `3e867acb3` (2026-09-04) |
| Also confirmed present in | tag `8.1.3-rc.8` (`9fdb3e812`, 2026-09-01), which this fork is based on |
| Fork branch carrying the fixes | `claude/waldur-homeport-resync-ttwxn2` |
| How they were found | Resyncing this fork onto upstream, September 2026 |

All five are present in both the newest release candidate and the current
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

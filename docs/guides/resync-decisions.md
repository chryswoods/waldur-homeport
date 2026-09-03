# Homeport resync: decisions and findings

Working record for the resync of `chryswoods/waldur-homeport` onto
`waldur/waldur-homeport` `develop`, carried out against the plan in
`chryswoods/waldur-mastermind:docs/guides/homeport-resync-plan.md`
(branch `claude/waldur-mastermind-resync-analysis-w824hs`).

Measured at `upstream/develop` = `abd2f89e2` (2026-09-03).

## 1. Divergence: the plan's figures hold

Re-measured against the fork point the plan names, `e506ac8e1` (2025-11-02):

| Fact | Plan | Measured | |
| --- | --- | --- | --- |
| Local diff since fork | 325 files, +29,488 / -662 | 325 files, +29,488 / -662 | exact |
| Upstream ahead | 2851 | 2853 | +2 commits landed since |
| `src/openportal` files in both, by path | 56 | 56 | exact |
| `src/openportal` local-only by path | 72 | 72 | exact |
| `src/openportal` upstream-only by path | 9 | 9 | exact |
| `src/openportal` in both, by basename | 58 | 58 | exact |
| `src/openportal` local-only by basename | 63 | 63 | exact |
| `src/openportal-remote` | 26 local vs upstream 4 | 26 vs 4 | exact |

Two figures do not reproduce, and both are artefacts rather than errors:

- **"This fork ahead: 4777 commits."** The real count of commits reachable
  from the fork head but not from `e506ac8e1` is **393**. The plan flags its
  commit counts as indicative from a bounded fetch, so this is expected; the
  file-level figures, which it presents as exact, are exact.
- **The area table in section 2 is incomplete.** It lists 13 areas. There are
  13 more with local changes it does not mention: `src/table` (2 files, +104),
  `src/core` (2, +150), `src/modal` (2, +83), `src/theme` (1, +66),
  `src/features` (1, +49), `src/workspace` (1, +42), `src/transitions.ts`
  (+28), `src/issues` (1, +18), `src/FeaturesEnums.ts` (+13), `src/form`
  (1, +9), plus `src/echarts`, `src/store`, `src/states.ts`, `src/resource`.
  Outside `src/`: `Dockerfile`, `.dockerignore`, `package.json`,
  `tsconfig.json`, `vite.config.ts` and three `locales/*.json`. All are
  handled under section 6 below.

## 2. What the plan did not anticipate: upstream's restructure

Section 1 of the plan lists seven upstream migrations. Since it was written
upstream has gone further, and the extra moves matter more than any of them:

- **Yarn 1 -> Yarn 4 (Berry)**, `nodeLinker: node-modules`, with a
  `packageManager` pin. `corepack` cannot reach `repo.yarnpkg.com` through
  this environment's proxy; `COREPACK_NPM_REGISTRY=https://registry.npmjs.org`
  fetches the same Yarn build from npm and works.
- **A workspace monorepo.** `packages/*` now holds `waldur-shell`,
  `waldur-ui`, `waldur-auth-core`, `waldur-api-client`, `waldur-telemetry`,
  `waldur-design-tokens`, `waldur-i18n-runtime`, `waldur-runtime-config`,
  `waldur-eslint-plugin-waldur`, plus `apps/micro-app-poc`.
- **The `@waldur/*` import alias is now `@/*`.** Every carried file needs
  rewriting; this is the single most mechanical part of the job.
- **Vite 7 -> 8, Vitest 3 -> 4, Tailwind v4**, Storybook added, Cypress
  replaced by Playwright (`e2e/`, `e2e-visual/`).
- Typecheck is `yarn tsgo -b` (`@typescript/native-preview`), not `tsc`.

## 3. `waldur-js-client` 7 -> 8: settled

**Adopt upstream's pin,** `8.1.3-rc.7.dev.20260901180117.270`, unchanged.

This is close to free. The fork's entire local delta to `package.json` since
the fork point was three lines — an `attr-accept` bump, a `core-js` addition
and a Yarn 1 `packageManager` pin — none of which survive contact with
upstream's dependency set, and none of which the fork's own code depends on.
Upstream's `package.json`, `yarn.lock` and `tsconfig.json` are taken as they
stand. Verified: install, `tsgo -b` and `lint:check` all pass on the adopted
tree with no local edits.

**The plan's section 5 concern 1 is real and is now confirmed.** The
published client predates the mastermind resync's accounting-summary work.
In `node_modules/waldur-js-client/dist/types.gen.d.ts`,
`OpenportalAccountingSummaryListData['query']` offers only
`customer_uuid`, `is_active`, `page`, `page_size` and `project_uuid`. The
resynced mastermind branch adds two things the client does not know about:

- `offering_name`, a filter — `waldur_openportal/filters.py:159`
- `include_offering_names`, an option — `waldur_openportal/serializers.py:598`

Regenerating and publishing a client is a cross-repository release step that
cannot be done from here, and pinning a locally generated build would
immediately desync this fork from upstream again. So the resolution is the
plan's own second option: **call those two parameters without the generated
helper's typed query**, and leave the pin alone. See section 4.

Concern 2, the eight feature flags, is unaffected: they are read through
`ENV.plugins` and `FeaturesEnums`, not through the generated client, and are
carried in section 6.

## 4. OpenPortal: upstream superseded nearly all of it

This is the plan's largest miscall, and it runs the same way the mastermind
resync did — the carry-forward list collapses on inspection.

The plan's section 3.2 reads: "42 are real components upstream did not take
... Treat this as the bulk of the job." The file *counts* are right (they
reproduce exactly, section 1 above). The *conclusion* is not. Upstream did
not omit those components; it reimplemented them, usually in a better form,
as part of the same migrations section 1 of the plan lists.

Of 82 local-only files across `src/openportal` and `src/openportal-remote`
(counting by basename, so upstream's move of e.g. `PullAllocationAction.tsx`
into `actions/` is not miscounted as a gap), **80 are superseded**:

| Local files | Superseded by |
| --- | --- |
| `ManagedProjectsFilter`, `RemoteProjectsFilter`, `ManagedProjectAuditFilter`, `RemoteProjectAuditFilter`, `AuditDateRange` | `src/table/generated/Openportal*Filter.tsx`, generated from `generate-filters-config.yaml`. Regenerate, never hand-edit. |
| `ManagedProjectLink`, `ProjectTemplateLink` | Inlined into upstream's `ManagedProjectExpandableRow.tsx` as `ProjectLink` / `ProjectTemplateLink`, on `@/core/Link`. |
| `ProjectTemplateCreateDialog`, `ProjectTemplateEditDialog`, `OfferingAutocompleteField`, `OrganizationAutocompleteField` | `ProjectTemplateDialog` + `ProjectTemplateFormFields`, using shared `@/marketplace/common/autocompletes` and the `AsyncSelectGroup` Group pattern. |
| `ProjectAutocompleteField` | Upstream's `AttachManagedProjectDialog`, via `createLoadOptions` + `AsyncSelectGroup`. |
| `ProjectTemplateDetail` (+ its route) | `ProjectTemplateExpandableRow` in the list, plus `ProjectTemplateEditButton` / `ProjectTemplateDeleteButton`. |
| The separate per-project managed-audit route | Upstream embeds `ManagedProjectAuditLog` inside `ManagedProjectDetail`. |
| `EditAction`, `EditDialog` (both dirs) | `EditModalButton` from `@/core/buttons`. |
| `OpenPortalAllocationActions`, `OpenPortalRemoteAllocationActions` | Upstream's declarative `actions.ts` (`ActionConfiguration`), registered in `src/resource/actions/registry.ts`. The fork's JSX `ActionGroup` form belongs to the old registry that no longer exists. |
| `RequestLimitsChangeAction`, `RequestLimitsChangeDialog` (both dirs) | Generic `src/marketplace/resources/request-limits-change/`. |
| `OpenPortalCredentialsForm`, `OpenPortalRemoteCredentialsForm` | `OpenPortalCredentialsSection` / `OpenPortalRemoteCredentialsSection`. |
| `FormFinalConfigurationStep`, `ResourceNameGroup` | `@/marketplace/deploy/steps/`; upstream's `constants.ts` already imports the shared step. |
| `bindings/` (28 files) | `waldur-js-client` generated types. Upstream's `reports/api.ts` already imports `ProjectTemplate`, `ManagedProject`, `OpenportalProjectUsageReportsListData` and friends directly. This is exactly what the plan's section 3.2 recommended; upstream got there first. |
| `details/` in both dirs, `QuotaPie` (+ test + snapshot), `SubmitJobAction`, `SubmitJobDialog`, `AllocationUsersTable`, `provider.ts`, `reports/index.ts`, `RemoteProjectExpandableRow` (~26 files) | Dead code. Nothing outside `src/openportal*` imports them; within it, only each other and their own tests. The one external consumer of the pattern, `src/slurm/`, was deleted upstream entirely, and the fork never modified it. |

Upstream's `src/openportal/routes.ts` is a strict superset of the fork's,
route for route, plus `support.access-for-email`.

**Two files are genuinely new**, both from `72b74c6ca` (2026-08-18):
`ManagedProjectDashboardCards.tsx` and `RemoteProjectDashboardCards.tsx`.

### The tail commits

As on the mastermind side, only the local commits that postdate upstream's
port are real work. Upstream ported OpenPortal in `0b0171df3` (2026-08-06);
exactly **four** local OpenPortal commits are later than that:

| Commit | Date | What |
| --- | --- | --- |
| `9edb6ff5c` | 2026-08-13 | localStorage cache: quota-driven eviction and stale-version purge |
| `a7cf91072` | 2026-08-13 | Bound uncached user-mapping fetches to 100 |
| `37e0466c6` | 2026-08-17 | Offering filter on the allocation summary |
| `72b74c6ca` | 2026-08-18 | Project usage/allocation dashboard cards |

Everything earlier was available to upstream's port and is either in
upstream already or superseded per the table above. These four are reshaped
onto upstream's code rather than cherry-picked — `37e0466c6` in particular
is the one that needs the untyped call described in section 3.

## 5. Grace period

Handled per the plan's section 4: rebuilt on `grace_period_days` and
`is_in_grace_period`, after checking what upstream already renders.

## 6. Remaining deltas

Reviewed one at a time against upstream before carrying, per the plan's
section 3.4. Six of the locally modified files no longer exist upstream at
all (`customer/credits/ProjectCreditFormDialog.tsx`,
`customer/details/EditFieldDialog.tsx`, `form/WizardFormContainer.tsx`,
`store/config.ts`, `user/support/UserEditRow.tsx`,
`user/support/UserEditRows.tsx`); the last two are `unix_username` /
`short_name` UI that the plan's section 3.3 deletes anyway.

`unix_username` and `Project.short_name` need no deletion work: the reset
onto upstream removed every file and hunk the plan's section 3.3 lists.
OpenPortal's own `userData.short_name` in `AccessForEmail.tsx` is untouched
and still present, as required.

## 7. Outcome

The fork's delta against `upstream/develop` at the end of the resync:

| | Files | Insertions | Deletions |
| --- | --- | --- | --- |
| Before (fork point `e506ac8e1` -> `e3872e5`) | 325 | 29,488 | 662 |
| After | 59 | 2,510 | 179 |

Fifteen of those files are new; the rest are edits to upstream files. The
reduction is almost entirely section 4 — OpenPortal, which the plan expected
to be "the bulk of the job", came down to two new components, four tail
commits and a policy module.

### Verification

Run with Yarn 4 via corepack. `repo.yarnpkg.com` is unreachable through this
environment's proxy, so corepack needs pointing at npm:

```bash
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
export COREPACK_NPM_REGISTRY=https://registry.npmjs.org
yarn install
```

| Check | Result |
| --- | --- |
| `yarn tsgo -b` | clean |
| `yarn lint:check` | 0 errors, 419 warnings — exactly upstream's baseline |
| `yarn test --run` | 3,529 pass, 6 skipped, 0 fail |
| `yarn build` | succeeds |

The 419 lint warnings are upstream's own and were measured on the untouched
tree before any local work; nothing here adds to them.

`yarn i18n:validate` warns about 13,273 potential missing translations. That
is also upstream's baseline, measured the same way — `locales/en.json` holds
a handful of overrides rather than a full catalogue.

### Not carried, but worth knowing

Three things the fork did in code are better done in mastermind settings now:

- **Hiding the marketplace.** Set `WALDUR_CORE.SERVICE_ACCESS_MODE` to
  `'calls'`. Upstream's sidebar reads it, along with
  `hide_marketplace_from_end_users`. The fork's two hardcoded booleans are
  gone.
- **`show_slug_as_id` and `make_slugs_immutable`** still work as before, but
  the `unix_username` precondition the fork put in front of the first is gone
  with the field itself.
- **`application_portal_only`** is now unread by the frontend. Both its uses
  were in code deleted here.

Three call sites cast their query object because the published
`waldur-js-client` lags the resynced mastermind branch. All three carry a
comment pointing here. They can be simplified once a client generated from
the resynced schema is published:

| Call site | Missing from the client |
| --- | --- |
| `openportal/reports/OrganisationAllocationTab.tsx` | `include_offering_names`, and `offering_names` on the response |
| `project/ProjectProfile.tsx` | `project_uuid` on the proposals list |
| `customer/team/CustomerUsersList.tsx` | `slug` in `CustomerUserFieldEnum` |

The second of these is a correction to the plan's section 6, which concluded
that every field dropped with the local proposal work sat inside
`src/proposals`. `ProjectProfile` is outside it and depends on the proposals
list's `project_uuid` filter.

One upstream bug found and fixed here, worth offering back: upstream's
`src/echarts/index.ts` does not register the `dataZoom` component or the
`treemap` chart, both of which its own ported OpenPortal report charts use.

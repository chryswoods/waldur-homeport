# The proposal archive

A read-only record of the calls and proposals the awards site ran before the
upgrade: 2,263 proposals, 7 calls, 1,783 reviews, 3,434 documents and 5,897
role assignments, archived rather than migrated when the resync deleted the
fork's own proposal app.

Upstream's proposal app runs alongside it, empty, ready for new calls. The
archive is inert: nothing in it is editable, and nothing in it grants access.

The backend design is in the mastermind repo at
`docs/guides/awards-site-upgrade-plan.md` §4–§6.

## What the UI must not widen

The API enforces every rule below by filtering the queryset, so the UI cannot
leak anything by getting it wrong. What it _can_ do is show empty panels and
dead links, which tell a reader something exists that they cannot have.

| Object                     | Visible to                                            |
| -------------------------- | ----------------------------------------------------- |
| Call, round                | staff, support, the call's managing organisation      |
| Proposal                   | the above, plus the proposal's creator                |
| Document                   | as for its parent call or proposal                    |
| Review, call-manager notes | staff, support, the call's managing organisation only |

Three consequences the components are built around:

- **Reviews are never shown to applicants.** The archived call record still
  carries `reviews_visible_to_submitters` and
  `reviewer_identity_visible_to_submitters`, but those are history, not
  instructions, and nothing reads them. `ArchivedReviewsPanel` renders nothing
  at all for an empty list rather than an empty "Reviews" heading, because the
  heading alone would say reviews exist.
- **Notes are a separate request.** `proposalArchiveProposalsNotesRetrieve`
  404s for the applicant; `useArchivedProposalNotes` treats that as "no notes"
  rather than an error, since being refused is the normal case for most
  viewers.
- **A proposal cannot assume it can load its call.** An applicant may read
  their own archived proposal but not the call it belongs to, so the proposal
  views show the recorded `call_name` and never link to the call.

## References out are names, not links

Every reference out of the archive is a UUID plus the display value as it stood
when the archive was taken — `created_by_uuid` + `created_by_full_name`,
`project_uuid` + `project_name`, and so on. That is deliberate: a real foreign
key would let an archived proposal block the deletion of the user who wrote it,
or be cascade-deleted along with a customer years from now.

The consequence for the UI is that **the referenced object may no longer
exist**. `RecordedName` renders the recorded name and does not link. A dangling
link is worse than a plain name.

## Memberships are a record, not access

`ArchivedMembership` says who held `PROPOSAL.MANAGER`, `CALL.REVIEWER` and the
rest. The underlying roles were deleted during the upgrade, so none of it
confers anything now, and there are deliberately no revoke or edit affordances —
there is nothing left to revoke.

`is_active` is genuine tri-state history: some rows were revoked before the
archive was taken. Those are shown as "Revoked" rather than hidden, because the
fact that access was removed is part of the record.

## Old links keep working

`/proposals/{uuid}` links are in people's inboxes, tickets and bookmarks. The
archive preserved the original UUIDs, so such a link still identifies the right
record — it just is not a live proposal any more.

`ProposalManagePage` falls back: when the live lookup 404s it renders
`ArchivedProposalRedirect`, which calls `proposalArchiveResolveRetrieve` and
sends the browser to the matching archive view. Only a 404 is followed up — a
403 is a live proposal the reader may not see, and redirecting them would turn
a clear refusal into a dead end.

`archiveTargetFor` maps the three kinds. A round has no page of its own, so it
resolves to that round's proposals, which is the useful answer to "what was
this round?".

The resolver answers 404 both for "unknown" and for "you may not see it", so
that it cannot be used to test whether a confidential proposal exists. The UI
therefore shows one not-found message for both.

A database search-and-replace of stored links was rejected: it could only fix
links already inside Waldur, and does nothing for the ones in email and
tickets, which is most of them.

## Reaching the archive

No feature flag. Only the site that ran the old proposal app has any archived
records, and everywhere else `proposalArchiveCallsCount` answers zero, so
`useHasProposalArchive` decides whether the menu entries appear. Presence of
data is a better switch than a setting nobody would remember to turn on, and it
cannot drift out of step with the data.

The entries sit in the Calls menu, below a separator. That menu is otherwise
switched off entirely where `show_call_management_functionality` is off, but a
deployment that runs no calls may still hold an archive of ones it ran before,
so the section now renders for the archive alone in that case.

## Known gap: no round selector

`proposal-archive-rounds` has no text filter, so the filter generator can only
emit `createLoadOptions(..., 'name')`, which that endpoint rejects. The round
filter is therefore left out of `generate-filters-config.yaml` rather than
hand-written.

It is not currently missed: rounds are reachable from their call, and an old
link to a round still lands on its proposals through the `?round=` parameter
the resolver sets. Adding a `slug` filter to that endpoint would let the
selector be generated — worth doing if anyone asks to filter proposals by round
from the UI.

## From a project to its proposal

The project hero shows a "Proposal:" line linking to the proposal the project
came from. Upstream offers no route for this — `Proposal.project` is a URL with
nothing on the other side, and no proposal endpoint accepts `project_uuid` — so
the link is found by the **award ID**, which an accepted proposal and the
project it creates share as their slug.

`useProjectProposals` looks in two places, in order:

1. **Live proposals, by `slug`.** The filter is `lookup_expr="exact"`, so
   `0261-7825-6844-1` does not catch the follow-on `0261-7825-6844-10`.
2. **Archived proposals, by `project_uuid`**, only when nothing live matched.
   The archive has no slug filter, and it holds the recorded project link
   anyway, which is the more exact of the two.

A project has one or the other, never both: the archive holds the proposals
that created projects before the upgrade, the live app everything since.

**Gated on both `deployment.application_portal_only` and
`proposal.auto_assign_award_id`.** Without award IDs a slug is only
`slugify(name)` on each side, and equal slugs mean nothing — a project named
"Priority Aware" would link to any unrelated proposal that slugified the same
way. Without `application_portal_only`, `ProjectInfo.set_shortname()` can
overwrite the project slug with an OpenPortal shortname, and the award ID is
gone.

`pickProjectProposals` re-checks every row rather than trusting the filters.
This replaces a lookup whose `project_uuid` filter the backend dropped while
the frontend kept sending it, and an unrecognised filter reads as no filter —
which is how the line once listed every proposal in the deployment. If either
parameter is ever dropped again, it fails closed.

Live proposals link to `/proposals/{uuid}`, the applicant route. The line used
to link into `call-management` under the project's customer, which on the
awards site is the call's _managing_ organisation — a workspace an award holder
may have no access to.

`proposal.auto_assign_award_id` is declared in mastermind's own `proposal`
feature section ("Proposals and calls"), and mastermind's description says the
same thing this gate does: it only takes effect together with
`application_portal_only`.

It is deployment-wide rather than per-call because this is the only level
HomePort can read here: a per-call setting would need the proposal to find the
call, and finding the proposal is the problem. Per-call configuration — an ID
prefix or format for a particular funder — can still become a field on `Call`
later without changing this gate.

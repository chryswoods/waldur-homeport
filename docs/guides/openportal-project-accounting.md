# Accounting on the project dashboard

Which figures a project dashboard shows, and why there are three answers rather
than two.

## The three modes

`getAccountingMode` in `@/openportal/project-accounting/accountingMode` makes
the choice once, from two inputs:

| Mode          | When                                                           | Shows                                                                   |
| ------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `award`       | An OpenPortal award is attached                                | Award cards, the award pace card, monthly usage over the award's window |
| `project`     | No award, but `customer.show_openportal_accounting_only` is on | The project spend card and monthly usage over the project's own window  |
| `marketplace` | Otherwise                                                      | Waldur's balance, aggregate-limit and credit-consumption widgets        |

They are mutually exclusive because the two accounting systems describe the
same money differently — OpenPortal's absolute model (an allocation, and usage
counted against it) against Waldur's relative one (a credit balance drawn down
month by month). Shown together they read as a contradiction rather than a
summary, which is what the feature exists to prevent.

An award wins over the feature: a project holding one has stated figures worth
showing whatever the organisation has configured.

## Why the middle mode exists

A project can have OpenPortal resources, and therefore real absolute accounting
visible in its usage reports, without ever being attached to a ManagedProject.
Before this, such a project fell through to the marketplace widgets — and where
the organisation had set `show_openportal_accounting_only`, it got them anyway,
because that feature was only honoured on `CustomerDashboard` and the project
dashboard ignored it entirely.

## What the `project` mode deliberately does not show

**No pace card, and no allocation.** Pacing needs an allocation, and without an
award there is no stated one.

It is tempting to derive it. For a project whose credits OpenPortal sets,
`set_project_credits` writes `ProjectCredit.value = allocation − spend
excluding the current month` — and it is called from the RemoteAllocation
handler, not only from the award path — so `allocation = total_credits +
total_spend` exactly. But the same arithmetic on an ordinary Waldur project,
whose balance is a real ledger that is drawn down monthly and can be topped up,
gives a number that is simply wrong, and nothing in the response distinguishes
the two. A figure that is right for some projects and quietly wrong for others
is worse than no figure.

If the pace card is ever wanted here, the fix is for
`ProjectAccountingSummarySerializer` to report the allocation directly — it
computes both halves already — rather than for HomePort to infer it. The gate
that separates the two cases is `RemoteAllocation`, which only the backend can
see.

## The arithmetic the endpoint needs

`/api/openportal-accounting-summary/` names its fields in a way that invites
two mistakes, so `buildProjectSpend` does the arithmetic in one place:

- `total_spend` **excludes** the current month. It is not the total.
- `current_month_spend` is that month alone.
- `total_credits` is `ProjectCredit.value`: the balance at the **start** of the
  current month, because credit is drawn down when a month is invoiced rather
  than as usage accrues.

So used to date is `total_spend + current_month_spend`, and the credit left now
is `total_credits − current_month_spend`.

## Shared pieces

`MonthlyUsageChart` (`@/openportal/consumption`) serves both OpenPortal modes.
It takes a window rather than an award — it reads invoice items directly
through `/api/invoice-items/costs/` and never needed the award for anything but
the dates. It was previously `AwardConsumptionChart`, which would have been a
misleading name on a dashboard with no award.

It replaces the stock `ProjectDashboardCredit` wherever OpenPortal owns the
accounting: that chart plots credit _compensation_ per month, which is flat
zero for an award-backed project because OpenPortal sets the balance directly
and writes no compensation items.

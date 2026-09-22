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

## Recovering the allocation

The card shows allocation, usage and a bar — the same shape as the award card,
because it is the same absolute accounting. The allocation is not stated by an
award here, so it is recovered:

```
allocation = ProjectCredit.value + total_spend
```

This is not a guess. It is what `waldur_openportal.utils.get_project_credits()`
computes, under the name "the total lifetime credits awarded to the project",
and it holds because `set_project_credits` writes

```python
ProjectCredit.value = allocation − spend-excluding-the-current-month
```

so adding that spend back recovers the allocation exactly. That writer runs for
any project with active `RemoteAllocation`s, not only for award-backed ones.

`remaining` is then `allocation − usedTotal`, which reduces to
`ProjectCredit.value − current_month_spend` — the start-of-month balance less
what this month has booked against it, which is exactly the "estimated balance
at the end of this month" the stock Accounting widget reports.

### Not the summary's `total_credits`

The balance comes from `/api/project-credits/`, **not** from the summary
endpoint's `total_credits`. That field starts at `ProjectCredit.value` and then
adds back every credit that ever arrived as a negative invoice item:

```python
total_credits = project_credit.value
for invoice_item in invoice_items:
    if usage < 0:
        total_credits += abs(usage)
```

On a project with any compensation history that is not the start-of-month
balance at all. Using it inflated one real project's allocation from about
289,000 to 432,000 — the gap being its whole accrued compensation. It also
means the earlier assumption that OpenPortal projects carry no compensation
items was wrong: it holds for award-backed projects, not for these.

`useProjectSpend` therefore makes two requests, the credit one under the same
query key `useProjectCreditChart` uses, so the figures agree with the stock
widget and no duplicate call is made.

### Why this is safe here and not in general

The identity does **not** hold for an ordinary Waldur project. There the
balance is a genuine ledger: credit is drawn down by compensation items, which
arrive as negative invoice items, and `get_project_spend_info` already nets
those back into `total_credits`. Adding the spend as well would double-count
it.

Nothing in the endpoint's response distinguishes the two cases. What does is
the gate: none of this renders unless
`customer.show_openportal_accounting_only` is set, and an organisation
declaring that its accounting is OpenPortal's absolute model is exactly the
condition under which the identity is sound.

If the derivation is ever wanted outside that gate, the clean fix is for
`ProjectAccountingSummarySerializer` to report the allocation directly — it can
call the `get_project_credits()` it already has — rather than for HomePort to
infer it.

## No pace card

Pacing needs a window to measure against, and a project's own start and end
dates are not an award's. That was the request, and it is right on the merits:
a project may run across several awards, so its own dates say nothing about
when the current budget was meant to be spent.

The credit health block goes for the same reason and one more: it is the
relative model throughout — this month's drawdown, its pacing, the credit
lifecycle. With an award it shows the award pace instead, so it stays; without
one it is exactly what the feature is meant to suppress, and its "Overall
credit" figures disagreed on screen with the absolute ones beside them.

## The arithmetic the endpoint needs

`/api/openportal-accounting-summary/` names its fields in a way that invites a
mistake, so `buildProjectSpend` does the arithmetic in one place:
`total_spend` **excludes** the current month and `current_month_spend` is that
month alone, so neither field is the total and the two have to be added.
`total_credits` is the balance at the **start** of the current month, because
credit is drawn down when a month is invoiced rather than as usage accrues.

## Colouring the usage figure

`usageTextClass` in `@/openportal/allocationUsage` turns the "Used" figure
amber at `USAGE_WARNING_PERCENT` (80) and red at `USAGE_DANGER_PERCENT` (90),
on both this card and the ManagedProject one. Below the warning threshold it
returns nothing: most allocations are healthy, and colouring those would spend
the reader's attention on the normal case.

The bar underneath shares those constants. It used to turn red at 95%, which
left a 90–95% band where an amber bar sat under a red number; one pair of
thresholds removes that.

The award card colours its figure only when the allocation resolves. Without
one `percentOf` answers 0, and an uncoloured figure is the honest reading of
"we cannot say" rather than an accidental claim that the allocation is healthy.

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

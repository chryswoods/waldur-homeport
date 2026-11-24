import { PercentIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { FORM_ERROR } from 'final-form';
import arrayMutators from 'final-form-arrays';
import { FC, useEffect, useMemo, useState } from 'react';
import { Form } from 'react-final-form';
import { FieldArray } from 'react-final-form-arrays';
import {
  openportalRemoteProjectsRefreshSiteFeatures,
  openportalRemoteProjectsSetSpendProfile,
  RemoteProject,
  SpendProfileEntryRequest,
} from 'waldur-js-client';

import { BaseButton } from 'waldur-ui';

import { formatDate } from '@/core/dateUtils';
import { DateGroup, NumberGroup, StringGroup, SubmitButton } from '@/form';
import { translate } from '@/i18n';
import { CloseDialogButton } from '@/modal/CloseDialogButton';
import { ModalDialog } from '@/modal/ModalDialog';
import { useManagedMutation } from '@/modal/useManagedMutation';
import {
  awardTerms,
  dayBefore,
  isSiteSupportStale,
  parsePercentages,
  patternError,
  percentagePattern,
  periodsFromPercentages,
  runningTotals,
  spendPeriods,
  todayUtc,
  withUnits,
} from '@/openportal/spendProfile';

import { SiteSupportWarning } from '../SiteSupportWarning';
import { PeriodStatusBadge } from '../SpendProfileTable';

interface PeriodValue {
  from: string | null;
  minimum: number | string | null;
  maximum: number | string | null;
  /** Begun when the dialog opened: its start date is kept. */
  begun?: boolean;
  /** Ended when the dialog opened: nothing about it may change. */
  ended?: boolean;
}

interface FormValues {
  periods: PeriodValue[];
  /** The percentage helper's inputs; never sent. */
  pattern?: {
    count?: number | string;
    minimums?: string;
    maximums?: string;
  };
}

/** The percentage helper's inputs, read, or why they cannot be read. */
const readPattern = (pattern: FormValues['pattern']) => {
  const minimums = parsePercentages(pattern?.minimums);
  const maximums = parsePercentages(pattern?.maximums);
  if (minimums === null || maximums === null) {
    return {
      error: translate(
        'List the percentages as numbers, for example 10, 20, 30, 40.',
      ),
    };
  }
  return { pattern: { count: Number(pattern?.count), minimums, maximums } };
};

interface SetSpendProfileDialogProps {
  row: RemoteProject;
  resolve: {
    refetch: () => Promise<void> | void;
  };
}

const isSet = (value: number | string | null | undefined): boolean =>
  value !== null && value !== undefined && value !== '';

const asNumber = (value: number | string | null | undefined): number | null =>
  isSet(value) ? Number(value) : null;

/** Why a period cannot be saved as it is, or undefined. */
export const periodError = (
  period: PeriodValue,
  index: number,
  all: PeriodValue[],
  award: { start: string | null; end: string | null },
  today: string,
): string | undefined => {
  if (!period.from) {
    return translate('Choose the date this period starts.');
  }
  if (!period.begun && period.from < today) {
    return translate('A new period cannot start before today.');
  }
  if (award.start && period.from < award.start) {
    return translate('The period starts before the award.');
  }
  // The award's end date is not usable, as a project's is not.
  if (award.end && period.from >= award.end) {
    return translate('The period starts on or after the award ends.');
  }
  if (all.some((other, i) => i !== index && other.from === period.from)) {
    return translate('Another period starts on the same day.');
  }
  const minimum = asNumber(period.minimum);
  const maximum = asNumber(period.maximum);
  if ((minimum !== null && minimum < 0) || (maximum !== null && maximum < 0)) {
    return translate('Amounts cannot be negative.');
  }
  if (minimum !== null && maximum !== null && minimum > maximum) {
    return translate('The minimum is more than the maximum.');
  }
  return undefined;
};

/**
 * The profile with every control from now on taken away. Ended periods are
 * history and stay. A period under way that follows one keeps its start
 * date with no controls, so the ended one keeps its end; upcoming periods
 * go. With nothing ended, nothing is left: the profile is removed.
 */
export const withoutControls = (periods: PeriodValue[] = []): PeriodValue[] => {
  const ended = periods.filter((period) => period.ended);
  if (!ended.length) return [];
  const underWay = periods.find((period) => period.begun && !period.ended);
  return [
    ...ended,
    ...(underWay ? [{ ...underWay, minimum: null, maximum: null }] : []),
  ];
};

/** Whether there is any control from now on to take away. */
export const hasControls = (periods: PeriodValue[] = []): boolean =>
  periods.some(
    (period) =>
      !period.ended &&
      (!period.begun || isSet(period.minimum) || isSet(period.maximum)),
  );

/** The profile as the API takes it: sorted, units appended, unset left out. */
export const toRequest = (
  periods: PeriodValue[],
  units: string | undefined,
): SpendProfileEntryRequest[] =>
  [...periods]
    .sort((a, b) => a.from.localeCompare(b.from))
    .map((period) => {
      const entry: SpendProfileEntryRequest = { from: period.from };
      const minimum = asNumber(period.minimum);
      const maximum = asNumber(period.maximum);
      if (minimum !== null) entry.minimum = withUnits(minimum, units);
      if (maximum !== null) entry.maximum = withUnits(maximum, units);
      return entry;
    });

/**
 * Sets an award's spend profile: dated periods, each with an optional
 * minimum and maximum spend. Only the past is fixed: an ended period, whose
 * forfeit has been worked out, cannot change. A period under way keeps its
 * start date but its controls can change, and removing it leaves it with
 * none when an ended period comes before it, so the ended one keeps its end.
 * The API checks this too, and its reason shows when it refuses.
 */
export const SetSpendProfileDialog: FC<SetSpendProfileDialogProps> = ({
  row,
  resolve,
}) => {
  // What the site supports, refreshed without leaving the dialog.
  const [rp, setRp] = useState(row);
  const [checking, setChecking] = useState(false);
  const [showPattern, setShowPattern] = useState(false);
  const today = todayUtc();
  const award = awardTerms(row);
  const saved = spendPeriods(row.spend_profile ?? [], award.end, today);

  // Ask the site again while the profile is being edited, if its answer
  // is missing or old, so the warning below reflects what it says now.
  useEffect(() => {
    if (!isSiteSupportStale(row.site_features, row.site_features_checked_at)) {
      return;
    }
    let open = true;
    setChecking(true);
    openportalRemoteProjectsRefreshSiteFeatures({ path: { uuid: row.uuid } })
      .then(({ data }) => open && setRp(data))
      // The stored answer stands; "Check again" can retry.
      .catch(() => undefined)
      .finally(() => open && setChecking(false));
    return () => {
      open = false;
    };
  }, [row.uuid, row.site_features, row.site_features_checked_at]);

  // Fixed for the dialog's life: new initial values would reset the form,
  // losing what has been typed, whenever the dialog redraws.
  const initialValues = useMemo<FormValues>(
    () => ({
      periods: saved.map((period) => ({
        from: period.from,
        minimum: period.minimum,
        maximum: period.maximum,
        begun: period.status !== 'upcoming',
        ended: period.status === 'ended',
      })),
    }),

    [],
  );

  const save = useManagedMutation<any, any, SpendProfileEntryRequest[]>({
    mutationFn: (spend_profile) =>
      openportalRemoteProjectsSetSpendProfile({
        path: { uuid: row.uuid },
        body: { spend_profile },
      }),
    successMessage: translate('The spend profile has been updated.'),
    errorMessage: translate('Unable to update the spend profile.'),
    refetch: resolve.refetch,
  });

  const unit = award.units;

  return (
    <Form<FormValues>
      mutators={{ ...arrayMutators }}
      initialValues={initialValues}
      // Only whether the form may be saved. Each row works out its own
      // message: kept under periods[i], the form would write its fields'
      // errors into the message, turning it into an object of characters.
      validate={(values) => {
        const periods = values.periods ?? [];
        return periods.some((period, i) =>
          periodError(period, i, periods, award, today),
        )
          ? { [FORM_ERROR]: translate('Some periods need fixing.') }
          : {};
      }}
      onSubmit={(values) =>
        save
          .mutateAsync(toRequest(values.periods ?? [], unit))
          // A refusal is shown by the mutation, and the dialog stays open.
          .catch(() => undefined)
      }
      render={({ handleSubmit, submitting, invalid, values, form }) => {
        // The percentage helper fills the rest of the award. Ended periods
        // are kept as they are; a period under way is taken over, keeping
        // its start date, so it becomes the first of the new periods.
        const ended = (values.periods ?? []).filter((period) => period.ended);
        const underWay = (values.periods ?? []).find(
          (period) => period.begun && !period.ended,
        );
        const patternStart =
          underWay?.from ?? [today, award.start].filter(Boolean).sort().at(-1);
        // Whether the period at `index` starts where an ended one stops.
        const endsAnEnded = (index: number) => {
          const all = values.periods ?? [];
          const from = all[index]?.from;
          return all.some((other) => other.ended && other.from < from);
        };
        // Divided up to the award's last usable day, the day before its end.
        const window = {
          start: patternStart,
          end: award.end ? dayBefore(award.end) : null,
        };
        const read = readPattern(values.pattern);
        const patternProblem = read.error ?? patternError(read.pattern, window);
        const patternCount = Number(values.pattern?.count);
        const canShape =
          Number.isInteger(patternCount) &&
          patternCount >= 1 &&
          patternCount <= 24;
        const shape = (kind: 'equal' | 'rising') => {
          const list = percentagePattern(patternCount, kind).join(', ');
          form.change('pattern', {
            ...values.pattern,
            minimums: list,
            maximums: list,
          });
        };
        const fill = () => {
          const filled = periodsFromPercentages(
            read.pattern,
            window,
            award.total,
          ).map((period, i) =>
            // The first takes the place of the period under way.
            i === 0 && underWay ? { ...period, begun: true } : period,
          );
          form.change('periods', [...ended, ...filled]);
          setShowPattern(false);
        };
        const periods = spendPeriods(
          (values.periods ?? []).filter((p) => p.from) as Array<
            PeriodValue & { from: string }
          >,
          award.end,
          today,
        );
        const totals = runningTotals(periods, award.total);
        const periodOf = (from: string | null) =>
          periods.findIndex((p) => p.from === from);
        const amount = (n: number) => withUnits(n, unit);
        return (
          <form onSubmit={handleSubmit} noValidate>
            <ModalDialog
              title={translate('Set spend profile')}
              subtitle={translate(
                'Each period runs from its date until the next starts, the last until the award ends. As with end dates, the last day to spend in a period is the day before it ends. Leave an amount empty for no control.',
              )}
              footer={
                <>
                  {hasControls(values.periods) && (
                    <BaseButton
                      variant="text-danger"
                      label={translate('Remove all controls')}
                      iconNode={<TrashIcon weight="bold" />}
                      tooltip={translate(
                        'Ended periods are kept; from then on there are no controls. Save to apply.',
                      )}
                      onClick={() =>
                        form.change('periods', withoutControls(values.periods))
                      }
                      className="me-auto"
                    />
                  )}
                  <CloseDialogButton />
                  <SubmitButton
                    submitting={submitting}
                    invalid={invalid}
                    label={translate('Save')}
                  />
                </>
              }
            >
              <SiteSupportWarning
                rp={rp}
                entries={values.periods}
                onChecked={(refreshed) => setRp(refreshed)}
                checking={checking}
                showSupported
                className="mb-5"
              />
              {award.total > 0 && (
                <p className="text-muted fs-7">
                  {translate('Award: {amount}', {
                    amount: amount(award.total),
                  })}
                  {award.start && award.end
                    ? ` · ${formatDate(award.start)} – ${formatDate(award.end)}`
                    : ''}
                </p>
              )}
              {showPattern ? (
                <div
                  className="border rounded p-4 mb-4"
                  data-testid="percentage-pattern"
                >
                  <div className="fw-semibold mb-1">
                    {translate('Fill from percentages')}
                  </div>
                  <p className="text-muted fs-7">
                    {patternStart && award.end
                      ? translate(
                          'Divides the award from {start} until it ends on {end} into equal periods, each allowed its share of the {amount} award. Ended periods are kept; a period under way becomes the first of the new ones, keeping its start date. Adjust the result before saving.',
                          {
                            start: formatDate(patternStart),
                            end: formatDate(award.end),
                            amount: withUnits(award.total, unit),
                          },
                        )
                      : translate('The award has no end date to divide up to.')}
                  </p>
                  <div className="row g-3">
                    <div className="col-sm-4">
                      <NumberGroup
                        name="pattern.count"
                        label={translate('Number of periods')}
                        min={1}
                        spaceless
                      />
                    </div>
                    <div className="col-sm-4">
                      <StringGroup
                        name="pattern.minimums"
                        label={translate('Minimums (%)')}
                        placeholder="10, 20, 30, 40"
                        spaceless
                      />
                    </div>
                    <div className="col-sm-4">
                      <StringGroup
                        name="pattern.maximums"
                        label={translate('Maximums (%)')}
                        placeholder="10, 20, 30, 40"
                        spaceless
                      />
                    </div>
                  </div>
                  <div className="d-flex flex-wrap align-items-center gap-2 mt-3">
                    <BaseButton
                      size="sm"
                      variant="tertiary"
                      label={translate('Equal')}
                      onClick={() => shape('equal')}
                      disabled={!canShape}
                      disabledReason={translate(
                        'Choose the number of periods first.',
                      )}
                    />
                    <BaseButton
                      size="sm"
                      variant="tertiary"
                      label={translate('Rising')}
                      onClick={() => shape('rising')}
                      disabled={!canShape}
                      disabledReason={translate(
                        'Choose the number of periods first.',
                      )}
                    />
                    <div className="ms-auto d-flex gap-2">
                      <BaseButton
                        size="sm"
                        variant="text-secondary"
                        label={translate('Cancel')}
                        onClick={() => setShowPattern(false)}
                      />
                      <BaseButton
                        size="sm"
                        variant="primary"
                        label={translate('Fill periods')}
                        onClick={fill}
                        disabled={Boolean(patternProblem)}
                        disabledReason={patternProblem}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <BaseButton
                  variant="text-primary"
                  size="sm"
                  iconNode={<PercentIcon weight="bold" />}
                  label={translate('Fill from percentages')}
                  onClick={() => setShowPattern(true)}
                  className="mb-3"
                />
              )}
              <FieldArray<PeriodValue> name="periods">
                {({ fields }) => (
                  <>
                    <ol
                      className="list-unstyled mb-3"
                      aria-label={translate('Periods')}
                    >
                      {fields.map((name, index) => {
                        const period = fields.value[index];
                        const at = periodOf(period.from);
                        const shown = at >= 0 ? periods[at] : null;
                        const total = at >= 0 ? totals[at] : null;
                        const error = periodError(
                          period,
                          index,
                          fields.value,
                          award,
                          today,
                        );
                        return (
                          <li
                            key={name}
                            className="border rounded p-3 mb-3"
                            data-testid="spend-period"
                          >
                            <div className="row g-3 align-items-end">
                              <div className="col-sm-4">
                                <DateGroup
                                  name={`${name}.from`}
                                  label={translate('From')}
                                  disabled={period.begun}
                                  minDate={period.begun ? undefined : today}
                                  maxDate={
                                    award.end ? dayBefore(award.end) : undefined
                                  }
                                  spaceless
                                />
                              </div>
                              <div className="col-sm-3">
                                <NumberGroup
                                  name={`${name}.minimum`}
                                  label={translate('Minimum')}
                                  unit={unit}
                                  min={0}
                                  disabled={period.ended}
                                  spaceless
                                />
                              </div>
                              <div className="col-sm-3">
                                <NumberGroup
                                  name={`${name}.maximum`}
                                  label={translate('Maximum')}
                                  unit={unit}
                                  min={0}
                                  disabled={period.ended}
                                  spaceless
                                />
                              </div>
                              <div className="col-sm-2 text-end">
                                <BaseButton
                                  variant="text-danger"
                                  iconNode={<TrashIcon weight="bold" />}
                                  aria-label={translate('Remove period')}
                                  tooltip={
                                    period.begun &&
                                    !period.ended &&
                                    endsAnEnded(index)
                                      ? translate(
                                          'Removes its controls: the period before it has ended, so this one keeps its start date.',
                                        )
                                      : undefined
                                  }
                                  onClick={() =>
                                    // Removing a period under way that follows
                                    // an ended one would stretch the ended one
                                    // to the next start date, rewriting what
                                    // its forfeit was worked out on. It keeps
                                    // its date with no controls instead.
                                    period.begun && endsAnEnded(index)
                                      ? fields.update(index, {
                                          ...period,
                                          minimum: null,
                                          maximum: null,
                                        })
                                      : fields.remove(index)
                                  }
                                  disabled={period.ended}
                                  disabledReason={translate(
                                    'An ended period cannot change: its forfeit has been worked out.',
                                  )}
                                />
                              </div>
                            </div>
                            {shown && (
                              <div className="d-flex flex-wrap align-items-center gap-3 mt-2 fs-7 text-muted">
                                <PeriodStatusBadge status={shown.status} />
                                <span>
                                  {shown.ends
                                    ? translate('Ends {date}', {
                                        date: formatDate(shown.ends),
                                      })
                                    : translate('Ends with the award')}
                                </span>
                                <span data-testid="running-totals">
                                  {translate(
                                    'By then: at least {minimum}, {cap}',
                                    {
                                      minimum: amount(total.minimum),
                                      cap:
                                        total.cap === null
                                          ? translate('no cap')
                                          : translate('at most {cap}', {
                                              cap: amount(total.cap),
                                            }),
                                    },
                                  )}
                                </span>
                              </div>
                            )}
                            {error && (
                              <div className="text-danger fs-7 mt-2">
                                {error}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                    <BaseButton
                      variant="text-primary"
                      size="sm"
                      iconNode={<PlusIcon weight="bold" />}
                      label={translate('Add period')}
                      onClick={() =>
                        fields.push({
                          from: today,
                          minimum: null,
                          maximum: null,
                        })
                      }
                    />
                  </>
                )}
              </FieldArray>
              {totals.length > 0 && (
                <p className="text-muted fs-7 mt-4 mb-0">
                  {translate(
                    'Minimums total {minimum}; maximums total {maximum}, of an award of {award}. Periods without a maximum count at what is spent in them.',
                    {
                      minimum: amount(totals.at(-1).minimum),
                      maximum: amount(
                        periods.reduce((s, p) => s + (p.maximum ?? 0), 0),
                      ),
                      award: amount(award.total),
                    },
                  )}
                </p>
              )}
            </ModalDialog>
          </form>
        );
      }}
    />
  );
};

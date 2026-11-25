import { DateTime } from 'luxon';
import { ComponentProps, FC, useMemo } from 'react';
import { useFormState } from 'react-final-form';

import { formatDateTime, formatZoneOffset } from '@/core/dateUtils';
import { DateTimeField } from '@/form/DateTimeField';
import { withFormGroup } from '@/form/withFormGroup';
import { translate } from '@/i18n';

/** The zone deadlines are set in by default: the call managers' own. */
export const DEADLINE_ZONE = 'Europe/London';

/**
 * Where the deadline starts. When returning a proposal: its round's cut-off
 * while that is still ahead, so the applicant has as long as everyone else;
 * otherwise, and when extending, 16:00 UK time two weeks from today, with
 * its offset (+00:00 or +01:00).
 */
export const defaultResubmitBy = (
  roundCutoff?: string | null,
  now: DateTime = DateTime.now(),
): string => {
  if (roundCutoff) {
    const cutoff = DateTime.fromISO(roundCutoff, { setZone: true });
    if (cutoff.isValid && cutoff > now) {
      // As the round has it, offset and all.
      return roundCutoff;
    }
  }
  return now
    .setZone(DEADLINE_ZONE)
    .plus({ weeks: 2 })
    .set({ hour: 16, minute: 0, second: 0, millisecond: 0 })
    .toISO();
};

/** Whether a deadline is the round's cut-off, to say so beside it. */
export const isRoundCutoff = (
  value: string | null | undefined,
  roundCutoff: string | null | undefined,
): boolean =>
  Boolean(value && roundCutoff) &&
  DateTime.fromISO(value).toMillis() ===
    DateTime.fromISO(roundCutoff).toMillis();

export const validateResubmitBy = (value?: string | null) => {
  if (!value) return translate('This field is required.');
  return new Date(value) <= new Date()
    ? translate('The deadline must be in the future.')
    : undefined;
};

/** The picker, which works in the viewer's time zone, and which zone. */
const DeadlinePicker: FC<ComponentProps<typeof DateTimeField>> = (props) => (
  <div className="d-flex align-items-center gap-2">
    <div className="flex-grow-1">
      <DateTimeField {...props} />
    </div>
    <span
      className="text-muted text-nowrap"
      title={DateTime.local().zoneName}
      data-testid="deadline-zone"
    >
      {formatZoneOffset(props.input.value || new Date())}
    </span>
  </div>
);

const DeadlineGroup = withFormGroup(DeadlinePicker);

/**
 * The resubmission deadline. Picked in the viewer's time zone, shown beside
 * it; where that is not UK time, the UK time it comes to is given too, and
 * when it is the round's cut-off, that is said.
 */
export const ResubmitByGroup: FC<{
  minDate: Date;
  description?: string;
  /** The round's cut-off, to say when the deadline is that. */
  roundCutoff?: string | null;
}> = ({ minDate, description, roundCutoff }) => {
  const { values } = useFormState<{ resubmit_by?: string | null }>({
    subscription: { values: true },
  });
  const value = values.resubmit_by;
  const ukTime = useMemo(() => {
    if (!value) return null;
    const deadline = DateTime.fromISO(value);
    if (!deadline.isValid) return null;
    const uk = deadline.setZone(DEADLINE_ZONE);
    if (uk.offset === deadline.toLocal().offset) return null;
    return translate('That is {time} UK time.', {
      time: formatDateTime(uk),
    });
  }, [value]);

  return (
    <DeadlineGroup
      name="resubmit_by"
      label={translate('Resubmit by')}
      description={[
        isRoundCutoff(value, roundCutoff) &&
          translate(
            "This is the round's closing date, so the applicant has as long as anyone else.",
          ),
        ukTime,
        description,
      ]
        .filter(Boolean)
        .join(' ')}
      required
      // A Date, not "today": with times enabled it bounds the hours and
      // minutes of today as well as earlier days.
      minDate={minDate}
      validate={validateResubmitBy}
      forceTouched
      placeholder={translate('Select date and time...')}
    />
  );
};

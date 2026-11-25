import { DateTime } from 'luxon';

import { formatTime } from '@/core/dateUtils';
import { SelectField } from '@/form';
import { FormField } from '@/form/types';

function getMomentDayRange(interval = 5) {
  let start = DateTime.utc().startOf('day');
  const end = DateTime.utc().endOf('day');

  const timeArray = [];

  while (start <= end) {
    timeArray.push(start);
    start = start.plus({ minutes: interval });
  }
  return timeArray;
}

export const getOptions = (interval: number) =>
  getMomentDayRange(interval)
    // The value stays 24-hour whatever the display.
    .map((time) => ({
      label: formatTime(time),
      value: time.toFormat('T'),
    }));

interface TimeSelectFieldProps {
  interval?: number;
}

export const TimeSelectField = (props: TimeSelectFieldProps & FormField) => {
  return (
    <SelectField
      simpleValue={true}
      options={getOptions(props.interval)}
      {...props}
    />
  );
};

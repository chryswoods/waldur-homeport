import { Info } from 'luxon';
import { FC, useMemo } from 'react';

import { Select } from 'waldur-ui';

import { range } from '@/core/utils';
import { translate } from '@/i18n';

export const MAX_USER_MAPPINGS = 100;

export const MONTH_NAMES = Info.months('long');

/** The years reports exist for: from 2024, when reporting began, to now. */
export const getYearOptions = (currentYear = new Date().getFullYear()) =>
  range(currentYear - 2024 + 1).map((i) => 2024 + i);

export const groupByMonth = <T extends { year: number; month: number }>(
  items: T[],
): Record<string, T[]> => {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const key = `${item.year}-${String(item.month).padStart(2, '0')}`;
    groups[key] = [...(groups[key] ?? []), item];
  }
  return groups;
};

interface ReportPreFiltersProps {
  year: number | undefined;
  month: number | undefined;
  onYearChange: (year: number | undefined) => void;
  onMonthChange: (month: number | undefined) => void;
}

type Option = { value: number | null; label: string };

/**
 * The period reports cover: a year, a month of every year, one month, or
 * everything. Two separate choices rather than one month picker, which can
 * only mean a single month: a whole year has to be expressible.
 */
export const ReportPreFilters: FC<ReportPreFiltersProps> = ({
  year,
  month,
  onYearChange,
  onMonthChange,
}) => {
  const yearOptions = useMemo<Option[]>(
    () => [
      { value: null, label: translate('All years') },
      ...getYearOptions()
        .reverse()
        .map((y) => ({ value: y, label: String(y) })),
    ],
    [],
  );
  const monthOptions = useMemo<Option[]>(
    () => [
      { value: null, label: translate('All months') },
      ...MONTH_NAMES.map((name, i) => ({ value: i + 1, label: name })),
    ],
    [],
  );

  return (
    <div className="d-flex align-items-end gap-3 mb-3 flex-wrap">
      <div className="min-w-150px">
        <label className="form-label small mb-1" htmlFor="filterYear">
          {translate('Year')}
        </label>
        <Select
          inputId="filterYear"
          options={yearOptions}
          value={yearOptions.find((o) => o.value === (year ?? null))}
          onChange={(option: Option | null) =>
            onYearChange(option?.value ?? undefined)
          }
          isSearchable={false}
        />
      </div>
      <div className="min-w-150px">
        <label className="form-label small mb-1" htmlFor="filterMonth">
          {translate('Month')}
        </label>
        <Select
          inputId="filterMonth"
          options={monthOptions}
          value={monthOptions.find((o) => o.value === (month ?? null))}
          onChange={(option: Option | null) =>
            onMonthChange(option?.value ?? undefined)
          }
          isSearchable={false}
        />
      </div>
    </div>
  );
};

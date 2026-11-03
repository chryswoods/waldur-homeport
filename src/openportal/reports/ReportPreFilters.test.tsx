import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/harness';
import { openAndSelectOption } from '@/test/select';

import { getYearOptions, ReportPreFilters } from './ReportPreFilters';

describe('getYearOptions', () => {
  it('runs from 2024 to this year', () => {
    expect(getYearOptions(2026)).toEqual([2024, 2025, 2026]);
  });
});

describe('ReportPreFilters', () => {
  const renderFilters = (year?: number, month?: number) => {
    const onYearChange = vi.fn();
    const onMonthChange = vi.fn();
    renderWithProviders(
      <ReportPreFilters
        year={year}
        month={month}
        onYearChange={onYearChange}
        onMonthChange={onMonthChange}
      />,
    );
    return { onYearChange, onMonthChange };
  };

  it('can pick a whole year, leaving the month open', async () => {
    const { onYearChange, onMonthChange } = renderFilters();
    await openAndSelectOption(userEvent.setup(), 'Year', '2025');
    expect(onYearChange).toHaveBeenCalledWith(2025);
    expect(onMonthChange).not.toHaveBeenCalled();
  });

  it('can pick a month, and go back to all of them', async () => {
    const { onMonthChange } = renderFilters(2025, 3);
    expect(screen.getByText('March')).toBeInTheDocument();
    await openAndSelectOption(userEvent.setup(), 'Month', 'All months');
    expect(onMonthChange).toHaveBeenCalledWith(undefined);
  });
});

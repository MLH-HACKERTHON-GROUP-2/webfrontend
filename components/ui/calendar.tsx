'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker, useDayPicker, type DayPickerProps, type MonthCaptionProps } from 'react-day-picker';
import { Select } from './select';

export function parseDate(value?: string): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date : undefined;
}

export function dateValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function MonthCaption({ calendarMonth }: MonthCaptionProps) {
  const { goToMonth, previousMonth, nextMonth, dayPickerProps } = useDayPicker();
  const month = calendarMonth.date;
  const first = dayPickerProps.startMonth ?? new Date(1900, 0);
  const last = dayPickerProps.endMonth ?? new Date(2100, 11);
  const months = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(month.getFullYear(), index, 1);
    return {
      value: String(index),
      label: date.toLocaleDateString('en-ZA', { month: 'long' }),
      disabled: date < new Date(first.getFullYear(), first.getMonth(), 1)
        || date > new Date(last.getFullYear(), last.getMonth(), 1),
    };
  });
  const years = Array.from({ length: last.getFullYear() - first.getFullYear() + 1 },
    (_, i) => ({ value: String(first.getFullYear() + i), label: String(first.getFullYear() + i) }));
  function changeYear(value: string) {
    const year = Number(value);
    const lower = year === first.getFullYear() ? first.getMonth() : 0;
    const upper = year === last.getFullYear() ? last.getMonth() : 11;
    goToMonth(new Date(year, Math.max(lower, Math.min(upper, month.getMonth())), 1));
  }
  return (
    <div className="custom-calendar-caption">
      <div className="custom-calendar-dropdowns">
        <Select label="Calendar month" value={String(month.getMonth())}
          onValueChange={value => goToMonth(new Date(month.getFullYear(), Number(value), 1))}
          options={months} className="calendar-month-select" />
        <Select label="Calendar year" value={String(month.getFullYear())}
          onValueChange={changeYear} options={years} className="calendar-year-select" />
      </div>
      <div className="custom-calendar-nav">
        <button type="button" aria-label="Go to previous month" disabled={!previousMonth}
          onClick={() => previousMonth && goToMonth(previousMonth)}><ChevronLeft size={17} /></button>
        <button type="button" aria-label="Go to next month" disabled={!nextMonth}
          onClick={() => nextMonth && goToMonth(nextMonth)}><ChevronRight size={17} /></button>
      </div>
    </div>
  );
}

// Shadcn-style Calendar, styled with the app's CSS tokens instead of Tailwind.
export function Calendar({ className = '', components, ...props }: DayPickerProps) {
  return (
    <DayPicker showOutsideDays fixedWeeks weekStartsOn={1} hideNavigation
      className={`custom-calendar ${className}`}
      components={{ MonthCaption, ...components }}
      {...props} />
  );
}

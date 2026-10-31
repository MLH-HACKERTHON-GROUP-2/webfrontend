'use client';

import { useRef, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { TODAY } from '@/lib/data';
import { Calendar, dateValue, parseDate } from './calendar';

type DatePickerProps = {
  id?: string;
  label: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
};

export function DatePicker({ id, label, name, value, onChange, min, max,
  placeholder = 'Pick a date', required, className = '' }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(parseDate(value || min || TODAY)!);
  const trigger = useRef<HTMLButtonElement>(null);
  const selected = parseDate(value);
  const minimum = parseDate(min);
  const maximum = parseDate(max);
  const today = parseDate(TODAY)!;
  const todayAllowed = (!min || TODAY >= min) && (!max || TODAY <= max);
  function selectDate(date: Date | undefined) {
    if (!date) return;
    onChange(dateValue(date));
    setOpen(false);
  }
  return (
    <div className={`date-picker ${className}`}>
      {name && <input type="hidden" name={name} value={value} />}
      <Popover.Root open={open} onOpenChange={next => {
        if (next) setMonth(parseDate(value || min || TODAY)!);
        setOpen(next);
      }}>
        <Popover.Trigger asChild>
          <button ref={trigger} type="button" id={id} aria-label={label}
            aria-required={required || undefined} data-empty={!value}
            className="date-picker-trigger">
            <CalendarDays size={16} />
            <span>{selected ? selected.toLocaleDateString('en-ZA', {
              day: 'numeric', month: 'short', year: 'numeric',
            }) : placeholder}</span>
            <ChevronDown size={14} />
          </button>
        </Popover.Trigger>
        <Popover.Portal container={trigger.current?.closest('dialog') ?? undefined}>
          <Popover.Content align="start" sideOffset={7} collisionPadding={12}
            className="date-picker-popover" aria-label={`${label} calendar`}
            onOpenAutoFocus={event => event.preventDefault()}>
            <Calendar mode="single" required selected={selected} onSelect={selectDate}
              month={month} onMonthChange={setMonth} autoFocus today={today}
              startMonth={minimum ? new Date(minimum.getFullYear(), minimum.getMonth(), 1) : new Date(1900, 0, 1)}
              endMonth={maximum ? new Date(maximum.getFullYear(), maximum.getMonth(), 1) : new Date(2100, 11, 1)}
              disabled={[
                ...(minimum ? [{ before: minimum }] : []),
                ...(maximum ? [{ after: maximum }] : []),
              ]}
              labels={{ labelDayButton: (date, modifiers) =>
                date.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                  + (modifiers.selected ? ', selected' : '') }} />
            <div className="date-picker-footer">
              <span>{selected ? selected.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Choose a date'}</span>
              <button type="button" disabled={!todayAllowed} onClick={() => selectDate(today)}>Today</button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

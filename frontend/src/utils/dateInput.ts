import type { SelectOption } from '@/components/common/SelectField';
import { dayKey } from './utility';

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const DMY = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;
const TIME_STEP_MINUTES = 15;

function validDate(year: number, month: number, day: number): string | undefined {
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? dayKey(date)
    : undefined;
}

export function parseDateText(text: string): string | undefined {
  const value = text.trim();
  const iso = ISO.exec(value);
  if (iso) return validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const dmy = DMY.exec(value);
  if (dmy) return validDate(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));
  return undefined;
}

export function displayDate(value?: string): string {
  const iso = value ? ISO.exec(value) : null;
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : '';
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function timeOptions(current?: string): SelectOption[] {
  const options: SelectOption[] = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += TIME_STEP_MINUTES) {
    const value = `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
    options.push({ value, label: value });
  }
  if (current && !options.some((option) => option.value === current)) {
    options.push({ value: current, label: current });
    options.sort((a, b) => a.value.localeCompare(b.value));
  }
  return options;
}

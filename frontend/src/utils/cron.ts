const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_CODES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function dayIndex(token: string): number | null {
  const upper = token.toUpperCase();
  const code = DAY_CODES.indexOf(upper.slice(0, 3));
  if (code >= 0 && /^[A-Z]+$/.test(upper)) return code;
  if (/^\d$/.test(token)) return Number(token) % 7;
  return null;
}

function expandDays(field: string): number[] | null {
  const days = new Set<number>();
  for (const part of field.split(',')) {
    const [from, to] = part.split('-');
    const start = dayIndex(from);
    const end = to === undefined ? start : dayIndex(to);
    if (start === null || end === null) return null;
    let day = start;
    days.add(day);
    while (day !== end) {
      day = (day + 1) % 7;
      days.add(day);
    }
  }
  return [...days];
}

function listDays(days: number[]): string {
  const sorted = [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  const key = sorted.join(',');
  if (key === '1,2,3,4,5') return 'Every weekday';
  if (sorted.length === 7) return 'Every day';
  const names = sorted.map((day) => DAY_NAMES[day]);
  if (names.length === 1) return `Every ${names[0]}`;
  return `Every ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function ordinal(day: number): string {
  if (day % 100 >= 11 && day % 100 <= 13) return `${day}th`;
  return `${day}${['th', 'st', 'nd', 'rd'][day % 10] ?? 'th'}`;
}

export function describeCron(cron?: string | null): string {
  const fields = cron?.trim().split(/\s+/) ?? [];
  if (fields.length !== 5) return cron ? `Custom schedule ${cron}` : 'No schedule';
  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;
  if (!/^\d{1,2}$/.test(minute) || !/^\d{1,2}$/.test(hour) || month !== '*') return `Custom schedule ${cron}`;
  const time = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')} IST`;

  if (dayOfMonth === '*' && dayOfWeek === '*') return `Every day at ${time}`;
  if (dayOfMonth === '*') {
    const days = expandDays(dayOfWeek);
    return days ? `${listDays(days)} at ${time}` : `Custom schedule ${cron}`;
  }
  if (/^\d{1,2}$/.test(dayOfMonth) && dayOfWeek === '*') {
    return `On the ${ordinal(Number(dayOfMonth))} of every month at ${time}`;
  }
  return `Custom schedule ${cron}`;
}

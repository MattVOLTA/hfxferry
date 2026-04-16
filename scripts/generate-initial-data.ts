/**
 * One-time script to generate initial schedule-data.json from the
 * existing hardcoded schedule. This will be replaced by GTFS data
 * once generate-schedule.ts runs with network access.
 */
import { writeFileSync } from 'fs';
import { join } from 'path';
import type { DaySchedule, GeneratedScheduleData } from '../src/lib/schedule-types';

const OUTPUT_PATH = join(__dirname, '..', 'src', 'generated', 'schedule-data.json');

function generateTimes(start: string, end: string, interval: number): string[] {
  const times: string[] = [];
  const currentTime = new Date(`1970-01-01T${start}:00`);
  const endTime = new Date(`1970-01-01T${end}:00`);
  while (currentTime <= endTime) {
    times.push(currentTime.toTimeString().slice(0, 5));
    currentTime.setMinutes(currentTime.getMinutes() + interval);
  }
  return times;
}

const patterns: Record<string, DaySchedule> = {
  weekday: {
    alderney: {
      toHalifax: [
        '06:30', '07:00', '07:15', '07:30', '07:45', '08:00', '08:15', '08:30', '08:45',
        '09:00', '09:15', '09:30', '09:45', '10:00',
        ...generateTimes('10:15', '19:15', 15),
        '19:30', '20:00', '20:30', '21:00', '21:30', '22:00', '22:30', '23:00',
      ],
      fromHalifax: [
        '06:42', '07:12', '07:27', '07:42', '07:57', '08:12', '08:27', '08:42',
        '08:57', '09:12', '09:27', '09:42', '09:57', '10:12',
        ...generateTimes('10:27', '19:27', 15),
        '19:42', '20:12', '20:42', '21:12', '21:42', '22:12', '22:42', '23:12',
      ],
    },
    woodside: {
      toHalifax: [
        '06:37', '06:52', '07:07', '07:22', '07:37', '07:52', '08:07', '08:22',
        '08:37', '08:52', '09:07', '09:22', '09:37', '09:52', '10:07', '10:22', '10:37',
        ...generateTimes('10:52', '20:37', 30),
      ],
      fromHalifax: [
        '06:49', '07:04', '07:19', '07:34', '07:49', '08:04', '08:19', '08:34', '08:49',
        '09:04', '09:19', '09:34', '09:49', '10:04', '10:19', '10:34', '10:49',
        ...generateTimes('11:04', '21:04', 30),
      ],
    },
  },
  saturday: {
    alderney: {
      toHalifax: [
        '06:30', '07:00', '07:30', '08:00',
        ...generateTimes('08:30', '23:30', 30),
      ],
      fromHalifax: [
        '06:42', '07:12', '07:42', '08:12',
        ...generateTimes('08:42', '23:42', 30),
      ],
    },
    woodside: { toHalifax: [], fromHalifax: [] },
  },
  sunday: {
    alderney: {
      toHalifax: [
        '06:45', '07:15', '07:45', '08:15',
        ...generateTimes('08:45', '23:45', 30),
      ],
      fromHalifax: [
        '06:57', '07:27', '07:57', '08:27',
        ...generateTimes('08:57', '23:57', 30),
      ],
    },
    woodside: { toHalifax: [], fromHalifax: [] },
  },
  holiday: {
    alderney: {
      toHalifax: generateTimes('07:30', '23:30', 30),
      fromHalifax: generateTimes('07:45', '23:45', 30),
    },
    woodside: { toHalifax: [], fromHalifax: [] },
  },
  'no-service': {
    alderney: { toHalifax: [], fromHalifax: [] },
    woodside: { toHalifax: [], fromHalifax: [] },
  },
};

// Holiday calculation helpers
function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function getNthWeekday(year: number, month: number, weekday: number, n: number): Date {
  const first = new Date(year, month, 1);
  const firstWeekday = first.getDay();
  const day = 1 + ((weekday - firstWeekday + 7) % 7) + (n - 1) * 7;
  return new Date(year, month, day);
}

function getLastMondayBefore(year: number, month: number, beforeDay: number): Date {
  const target = new Date(year, month, beforeDay);
  const day = target.getDay();
  const diff = day === 0 ? 6 : day - 1;
  return new Date(year, month, beforeDay - diff);
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function isSameDate(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getHolidays(year: number): { noService: Date[]; holiday: Date[] } {
  const easterSunday = getEasterSunday(year);
  const goodFriday = new Date(easterSunday);
  goodFriday.setDate(easterSunday.getDate() - 2);

  return {
    noService: [
      new Date(year, 0, 1),    // New Year's Day
      new Date(year, 11, 25),  // Christmas Day
      goodFriday,
      easterSunday,
    ],
    holiday: [
      getNthWeekday(year, 1, 1, 3),   // Family Day
      getLastMondayBefore(year, 4, 25), // Victoria Day
      new Date(year, 6, 1),            // Canada Day
      getNthWeekday(year, 7, 1, 1),    // Civic Holiday
      getNthWeekday(year, 8, 1, 1),    // Labour Day
      getNthWeekday(year, 9, 1, 2),    // Thanksgiving
      new Date(year, 10, 11),          // Remembrance Day
    ],
  };
}

function getDayPattern(date: Date, holidays: ReturnType<typeof getHolidays>): string {
  for (const d of holidays.noService) {
    if (isSameDate(date, d)) return 'no-service';
  }
  for (const d of holidays.holiday) {
    if (isSameDate(date, d)) return 'holiday';
  }
  const dow = date.getDay();
  if (dow === 0) return 'sunday';
  if (dow === 6) return 'saturday';
  return 'weekday';
}

// Generate dates for 1 year from today
const today = new Date();
const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
const endDate = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());

const dates: Record<string, DaySchedule> = {};
const holidays = {
  ...getHolidays(today.getFullYear()),
  noService: [
    ...getHolidays(today.getFullYear()).noService,
    ...getHolidays(today.getFullYear() + 1).noService,
  ],
  holiday: [
    ...getHolidays(today.getFullYear()).holiday,
    ...getHolidays(today.getFullYear() + 1).holiday,
  ],
};

for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
  const dateKey = formatDateKey(d);
  const pattern = getDayPattern(d, holidays);
  dates[dateKey] = patterns[pattern];
}

const dayOfWeekToPattern: Record<number, string> = {
  0: 'sunday',
  1: 'weekday',
  2: 'weekday',
  3: 'weekday',
  4: 'weekday',
  5: 'weekday',
  6: 'saturday',
};

const result: GeneratedScheduleData = {
  generatedAt: new Date().toISOString(),
  validFrom: formatDateKey(startDate),
  validThrough: formatDateKey(endDate),
  dates,
  fallbackPatterns: {
    weekday: patterns.weekday,
    saturday: patterns.saturday,
    sunday: patterns.sunday,
  },
  dayOfWeekToPattern,
};

writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2));
console.log(`Generated initial schedule-data.json with ${Object.keys(dates).length} dates`);
console.log(`  Range: ${formatDateKey(startDate)} to ${formatDateKey(endDate)}`);

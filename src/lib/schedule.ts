import scheduleData from '@/generated/schedule-data.json';
import type { GeneratedScheduleData, RouteName, Direction } from './schedule-types';

export type { RouteName, Direction };

const data = scheduleData as unknown as GeneratedScheduleData;

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

export function getDepartureTimes(
  date: Date,
  routeName: RouteName,
  direction: Direction
): string[] {
  const dateKey = formatDateKey(date);

  const daySchedule = data.dates[dateKey];
  if (daySchedule) {
    return daySchedule[routeName]?.[direction] ?? [];
  }

  const dayOfWeek = date.getDay();
  const patternKey = data.dayOfWeekToPattern[dayOfWeek];
  if (patternKey && data.fallbackPatterns[patternKey]) {
    return data.fallbackPatterns[patternKey][routeName]?.[direction] ?? [];
  }

  return [];
}

export function isDataStale(): boolean {
  return formatDateKey(new Date()) > data.validThrough;
}

export function getValidThrough(): string {
  return data.validThrough;
}

export type RouteName = 'alderney' | 'woodside';
export type Direction = 'toHalifax' | 'fromHalifax';

export interface DirectionSchedule {
  toHalifax: string[];
  fromHalifax: string[];
}

export interface DaySchedule {
  alderney: DirectionSchedule;
  woodside: DirectionSchedule;
}

export interface GeneratedScheduleData {
  generatedAt: string;
  validFrom: string;
  validThrough: string;
  dates: Record<string, DaySchedule>;
  fallbackPatterns: Record<string, DaySchedule>;
  dayOfWeekToPattern: Record<number, string>;
}

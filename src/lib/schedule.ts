export type DayCategory = 'weekday' | 'saturday' | 'sunday' | 'holiday';
export type RouteName = 'alderney' | 'woodside';
export type Direction = 'toHalifax' | 'fromHalifax';

interface Band {
  start: string;
  end: string;
  intervalMin: number;
}

interface RouteConfig {
  crossingMin: number;
  halifaxOffsetMin: number;
  bands: Record<DayCategory, Band[]>;
}

const ALDERNEY: RouteConfig = {
  crossingMin: 12,
  halifaxOffsetMin: 15,
  bands: {
    weekday: [
      { start: '06:30', end: '06:30', intervalMin: 30 },
      { start: '07:00', end: '20:00', intervalMin: 15 },
      { start: '20:30', end: '23:30', intervalMin: 30 },
    ],
    saturday: [
      { start: '06:30', end: '23:30', intervalMin: 30 },
    ],
    sunday: [
      { start: '06:30', end: '23:30', intervalMin: 30 },
    ],
    holiday: [
      { start: '07:30', end: '23:30', intervalMin: 30 },
    ],
  },
};

const WOODSIDE: RouteConfig = {
  crossingMin: 12,
  halifaxOffsetMin: 15,
  bands: {
    weekday: [
      { start: '06:37', end: '18:37', intervalMin: 30 },
    ],
    saturday: [],
    sunday: [],
    holiday: [],
  },
};

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const fromMinutes = (mins: number): string => {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
};

const expandBand = ({ start, end, intervalMin }: Band): string[] => {
  const startMin = toMinutes(start);
  const endMin = toMinutes(end);
  if (startMin === endMin) return [start];
  const times: string[] = [];
  for (let t = startMin; t <= endMin; t += intervalMin) {
    times.push(fromMinutes(t));
  }
  return times;
};

const shift = (times: string[], offsetMin: number): string[] =>
  times.map(t => fromMinutes(toMinutes(t) + offsetMin));

const buildRoute = (config: RouteConfig): Record<DayCategory, Record<Direction, string[]>> => {
  const days: DayCategory[] = ['weekday', 'saturday', 'sunday', 'holiday'];
  return Object.fromEntries(
    days.map(day => {
      const departuresFromDartmouth = config.bands[day].flatMap(expandBand);
      const departuresFromHalifax = shift(departuresFromDartmouth, config.halifaxOffsetMin);
      return [day, { toHalifax: departuresFromDartmouth, fromHalifax: departuresFromHalifax }];
    }),
  ) as Record<DayCategory, Record<Direction, string[]>>;
};

export const schedules: Record<RouteName, Record<DayCategory, Record<Direction, string[]>>> = {
  alderney: buildRoute(ALDERNEY),
  woodside: buildRoute(WOODSIDE),
};

import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import AdmZip from 'adm-zip';
import type { DaySchedule, GeneratedScheduleData } from '../src/lib/schedule-types';

const GTFS_URL = 'http://gtfs.halifax.ca/static/google_transit.zip';
const OUTPUT_PATH = join(__dirname, '..', 'src', 'generated', 'schedule-data.json');

const ROUTE_MAP: Record<string, keyof DaySchedule> = {
  FerD: 'alderney',
  FerW: 'woodside',
};

const STOP_IDS = {
  HALIFAX: '1073',
  ALDERNEY: '1074',
  WOODSIDE: '1075',
};

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^\uFEFF/, ''));
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = values[i] ?? ''));
    return row;
  });
}

function formatTime(gtfsTime: string): string {
  const parts = gtfsTime.split(':');
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  if (hours >= 24) hours -= 24;
  return `${String(hours).padStart(2, '0')}:${minutes}`;
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function emptyDaySchedule(): DaySchedule {
  return {
    alderney: { toHalifax: [], fromHalifax: [] },
    woodside: { toHalifax: [], fromHalifax: [] },
  };
}

async function downloadGTFS(): Promise<Buffer> {
  const response = await fetch(GTFS_URL);
  if (!response.ok) {
    throw new Error(`Failed to download GTFS feed: ${response.status} ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function extractCSVFromZip(zip: AdmZip, filename: string): Record<string, string>[] {
  const entry = zip.getEntry(filename);
  if (!entry) {
    console.warn(`Warning: ${filename} not found in GTFS feed`);
    return [];
  }
  return parseCSV(entry.getData().toString('utf-8'));
}

async function main() {
  console.log('Downloading GTFS feed...');
  let zipBuffer: Buffer;
  try {
    zipBuffer = await downloadGTFS();
  } catch (err) {
    if (existsSync(OUTPUT_PATH)) {
      console.warn(`Download failed: ${err}. Using existing schedule-data.json.`);
      return;
    }
    throw new Error(`Download failed and no existing schedule-data.json found: ${err}`);
  }

  console.log('Parsing GTFS data...');
  const zip = new AdmZip(zipBuffer);

  const routes = extractCSVFromZip(zip, 'routes.txt');
  const trips = extractCSVFromZip(zip, 'trips.txt');
  const stopTimes = extractCSVFromZip(zip, 'stop_times.txt');
  const calendar = extractCSVFromZip(zip, 'calendar.txt');
  const calendarDates = extractCSVFromZip(zip, 'calendar_dates.txt');

  // Find ferry routes (route_type=4), mapping route_id -> app route name
  const ferryRoutes = new Map<string, keyof DaySchedule>();
  for (const route of routes) {
    if (route.route_type === '4') {
      const appName = ROUTE_MAP[route.route_id];
      if (appName) {
        ferryRoutes.set(route.route_id, appName);
        console.log(`  Found ferry route: ${route.route_id} -> ${appName}`);
      } else {
        console.log(`  Unknown ferry route_id: ${route.route_id} (${route.route_long_name})`);
      }
    }
  }

  if (ferryRoutes.size === 0) {
    throw new Error('No ferry routes found in GTFS data');
  }

  // Get ferry trips, grouped by route
  const ferryTrips = trips.filter((t) => ferryRoutes.has(t.route_id));
  const tripRouteMap = new Map<string, keyof DaySchedule>();
  const tripServiceMap = new Map<string, string>();
  for (const trip of ferryTrips) {
    tripRouteMap.set(trip.trip_id, ferryRoutes.get(trip.route_id)!);
    tripServiceMap.set(trip.trip_id, trip.service_id);
  }

  // Build stop_times index: for each ferry trip, determine direction and departure time
  // Direction is determined by which stop comes first in stop_sequence
  interface TripDeparture {
    routeName: keyof DaySchedule;
    serviceId: string;
    direction: 'toHalifax' | 'fromHalifax';
    departureTime: string;
  }

  const tripStops = new Map<string, { stopId: string; seq: number; departure: string }[]>();
  for (const st of stopTimes) {
    if (!tripRouteMap.has(st.trip_id)) continue;
    if (!tripStops.has(st.trip_id)) tripStops.set(st.trip_id, []);
    tripStops.get(st.trip_id)!.push({
      stopId: st.stop_id,
      seq: parseInt(st.stop_sequence, 10),
      departure: st.departure_time,
    });
  }

  const departures: TripDeparture[] = [];
  for (const [tripId, stops] of tripStops) {
    stops.sort((a, b) => a.seq - b.seq);
    const firstStop = stops[0];
    const isToHalifax = firstStop.stopId !== STOP_IDS.HALIFAX;
    const direction = isToHalifax ? 'toHalifax' : 'fromHalifax';
    const departureTime = formatTime(firstStop.departure);

    departures.push({
      routeName: tripRouteMap.get(tripId)!,
      serviceId: tripServiceMap.get(tripId)!,
      direction,
      departureTime,
    });
  }

  // Build calendar: service_id -> { days: boolean[7], startDate, endDate }
  interface ServiceCalendar {
    days: boolean[];
    startDate: string;
    endDate: string;
  }
  const serviceCalendars = new Map<string, ServiceCalendar>();
  for (const cal of calendar) {
    serviceCalendars.set(cal.service_id, {
      days: [
        cal.sunday === '1',
        cal.monday === '1',
        cal.tuesday === '1',
        cal.wednesday === '1',
        cal.thursday === '1',
        cal.friday === '1',
        cal.saturday === '1',
      ],
      startDate: cal.start_date,
      endDate: cal.end_date,
    });
  }

  // Build calendar exceptions: date -> { added: Set<serviceId>, removed: Set<serviceId> }
  const exceptions = new Map<string, { added: Set<string>; removed: Set<string> }>();
  for (const cd of calendarDates) {
    if (!exceptions.has(cd.date)) {
      exceptions.set(cd.date, { added: new Set(), removed: new Set() });
    }
    const exc = exceptions.get(cd.date)!;
    if (cd.exception_type === '1') {
      exc.added.add(cd.service_id);
    } else if (cd.exception_type === '2') {
      exc.removed.add(cd.service_id);
    }
  }

  // Determine date range
  let minDate = '99999999';
  let maxDate = '00000000';
  for (const cal of serviceCalendars.values()) {
    if (cal.startDate < minDate) minDate = cal.startDate;
    if (cal.endDate > maxDate) maxDate = cal.endDate;
  }

  // Get active service_ids for a given date
  function getActiveServices(dateKey: string): Set<string> {
    const active = new Set<string>();
    const dayOfWeek = new Date(
      parseInt(dateKey.slice(0, 4)),
      parseInt(dateKey.slice(4, 6)) - 1,
      parseInt(dateKey.slice(6, 8))
    ).getDay();

    for (const [serviceId, cal] of serviceCalendars) {
      if (dateKey >= cal.startDate && dateKey <= cal.endDate && cal.days[dayOfWeek]) {
        active.add(serviceId);
      }
    }

    const exc = exceptions.get(dateKey);
    if (exc) {
      for (const added of exc.added) active.add(added);
      for (const removed of exc.removed) active.delete(removed);
    }

    return active;
  }

  // Group departures by service_id for fast lookup
  const departuresByService = new Map<string, TripDeparture[]>();
  for (const dep of departures) {
    if (!departuresByService.has(dep.serviceId)) {
      departuresByService.set(dep.serviceId, []);
    }
    departuresByService.get(dep.serviceId)!.push(dep);
  }

  // Generate schedule for each date in the range
  console.log(`Generating schedule from ${minDate} to ${maxDate}...`);
  const dates: Record<string, DaySchedule> = {};

  const startDate = new Date(
    parseInt(minDate.slice(0, 4)),
    parseInt(minDate.slice(4, 6)) - 1,
    parseInt(minDate.slice(6, 8))
  );
  const endDate = new Date(
    parseInt(maxDate.slice(0, 4)),
    parseInt(maxDate.slice(4, 6)) - 1,
    parseInt(maxDate.slice(6, 8))
  );

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateKey = formatDateKey(d);
    const activeServices = getActiveServices(dateKey);
    const daySchedule = emptyDaySchedule();

    for (const serviceId of activeServices) {
      const deps = departuresByService.get(serviceId);
      if (!deps) continue;
      for (const dep of deps) {
        daySchedule[dep.routeName][dep.direction].push(dep.departureTime);
      }
    }

    // Sort and deduplicate times
    for (const route of ['alderney', 'woodside'] as const) {
      for (const dir of ['toHalifax', 'fromHalifax'] as const) {
        daySchedule[route][dir] = [...new Set(daySchedule[route][dir])].sort();
      }
    }

    dates[dateKey] = daySchedule;
  }

  // Build fallback patterns from the most common day-of-week schedules
  const dayOfWeekSchedules: Record<number, DaySchedule[]> = {};
  for (let dow = 0; dow < 7; dow++) {
    dayOfWeekSchedules[dow] = [];
  }

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateKey = formatDateKey(d);
    const exc = exceptions.get(dateKey);
    if (exc && (exc.added.size > 0 || exc.removed.size > 0)) continue;
    dayOfWeekSchedules[d.getDay()].push(dates[dateKey]);
  }

  const fallbackPatterns: Record<string, DaySchedule> = {};
  const dayOfWeekToPattern: Record<number, string> = {};
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  for (let dow = 0; dow < 7; dow++) {
    const schedules = dayOfWeekSchedules[dow];
    if (schedules.length === 0) continue;
    // Use the most recent non-exception day as the pattern
    fallbackPatterns[dayNames[dow]] = schedules[schedules.length - 1];
    dayOfWeekToPattern[dow] = dayNames[dow];
  }

  const result: GeneratedScheduleData = {
    generatedAt: new Date().toISOString(),
    validFrom: minDate,
    validThrough: maxDate,
    dates,
    fallbackPatterns,
    dayOfWeekToPattern,
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2));

  const dateCount = Object.keys(dates).length;
  const sampleDate = Object.keys(dates)[0];
  const sampleTimes = dates[sampleDate]?.alderney?.toHalifax?.length ?? 0;
  console.log(`Generated schedule-data.json:`);
  console.log(`  ${dateCount} dates (${minDate} to ${maxDate})`);
  console.log(`  Sample: ${sampleDate} has ${sampleTimes} Alderney->Halifax departures`);
  console.log(`  File: ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error('Error generating schedule:', err);
  process.exit(1);
});

"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { schedules, DayCategory, RouteName, Direction } from "@/lib/schedule";

type Route = {
  name: RouteName;
  direction: Direction;
};

export default function Home() {
  const [route, setRoute] = useState<Route>({
    name: "alderney",
    direction: "toHalifax",
  });
  const [nextFerry, setNextFerry] = useState<string>("");
  const [minutesUntil, setMinutesUntil] = useState<number | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const savedRouteName = localStorage.getItem("ferryRouteName") as RouteName;
    const savedDirection = localStorage.getItem("ferryDirection") as Direction;
    if (savedRouteName && savedDirection) {
      setRoute({ name: savedRouteName, direction: savedDirection });
    }
  }, []);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem("ferryRouteName", route.name);
      localStorage.setItem("ferryDirection", route.direction);
    }
  }, [route, isClient]);

  const getEasterSunday = (year: number): Date => {
    // Anonymous Gregorian algorithm for Easter date
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
  };

  const getNthWeekdayOfMonth = (year: number, month: number, weekday: number, n: number): Date => {
    const first = new Date(year, month, 1);
    const firstWeekday = first.getDay();
    let day = 1 + ((weekday - firstWeekday + 7) % 7) + (n - 1) * 7;
    return new Date(year, month, day);
  };

  const getLastMondayBefore = (year: number, month: number, beforeDay: number): Date => {
    const target = new Date(year, month, beforeDay);
    const day = target.getDay();
    const diff = day === 0 ? 6 : day - 1; // days since last Monday
    return new Date(year, month, beforeDay - diff);
  };

  const isSameDate = (a: Date, b: Date): boolean =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const getDayCategory = (date: Date): DayCategory => {
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-indexed
    const dayOfMonth = date.getDate();
    const dayOfWeek = date.getDay();

    // No-service days: no ferry service at all
    const noServiceFixed = [
      { month: 0, day: 1 },   // New Year's Day
      { month: 11, day: 25 }, // Christmas Day
    ];
    for (const h of noServiceFixed) {
      if (month === h.month && dayOfMonth === h.day) return "no-service";
    }

    const easterSunday = getEasterSunday(year);
    const goodFriday = new Date(easterSunday);
    goodFriday.setDate(easterSunday.getDate() - 2);

    if (isSameDate(date, goodFriday)) return "no-service";
    if (isSameDate(date, easterSunday)) return "no-service";

    // Holiday-schedule days: reduced 30-min service on Alderney
    const holidayDates: Date[] = [
      getNthWeekdayOfMonth(year, 1, 1, 3),  // Family Day: 3rd Monday of February
      getLastMondayBefore(year, 4, 25),      // Victoria Day: last Monday before May 25
      new Date(year, 6, 1),                   // Canada Day: July 1
      getNthWeekdayOfMonth(year, 7, 1, 1),   // Civic Holiday: 1st Monday of August
      getNthWeekdayOfMonth(year, 8, 1, 1),   // Labour Day: 1st Monday of September
      getNthWeekdayOfMonth(year, 9, 1, 2),   // Thanksgiving: 2nd Monday of October
      new Date(year, 10, 11),                  // Remembrance Day: November 11
    ];
    for (const h of holidayDates) {
      if (isSameDate(date, h)) return "holiday";
    }

    if (dayOfWeek === 0) return "sunday";
    if (dayOfWeek === 6) return "saturday";
    return "weekday";
  };
  
  useEffect(() => {
    const getDepartureTimes = (now: Date, forDate: Date, route: Route): string[] => {
      const dayCategory = getDayCategory(forDate);
      const scheduleForDay = schedules[route.name][dayCategory]?.[route.direction];
      if (!scheduleForDay) return [];

      const allTimes: string[] = [];
      Object.values(scheduleForDay).forEach(period => {
          allTimes.push(...period.times);
      });
      
      allTimes.sort();
      
      return allTimes;
    };

    const calculateNextFerry = () => {
      const now = new Date();
      
      let departureTimes = getDepartureTimes(now, now, route);

      let nextDeparture = departureTimes.find(time => {
        const [hours, minutes] = time.split(":").map(Number);
        const departureTime = new Date(now);
        departureTime.setHours(hours, minutes, 0, 0);
        return departureTime > now;
      });

      let nextDepartureDate = new Date();

      if (!nextDeparture) {
        // No more ferries today, check tomorrow
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        departureTimes = getDepartureTimes(now, tomorrow, route);
        if (departureTimes.length > 0) {
            nextDeparture = departureTimes[0];
            nextDepartureDate = tomorrow;
        }
      }
      
      if (nextDeparture) {
        setNextFerry(nextDeparture);
        const [hours, minutes] = nextDeparture.split(":").map(Number);
        const departureTime = new Date(nextDepartureDate);
        departureTime.setHours(hours, minutes, 0, 0);
        
        const diff = departureTime.getTime() - now.getTime();
        setMinutesUntil(Math.ceil(diff / (1000 * 60)));

      } else {
        setNextFerry("No service");
        setMinutesUntil(null);
      }
    };

    calculateNextFerry();
    const interval = setInterval(calculateNextFerry, 1000); // Update every second

    return () => clearInterval(interval);
  }, [route, isClient]);


  if (!isClient) {
    return null; 
  }

  return (
    <main 
      className="flex flex-col"
      style={{ 
        backgroundColor: '#ffffff', 
        color: '#01558E',
        height: '100dvh', // Dynamic viewport height - excludes browser UI
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)'
      }}
    >
      {/* Fixed Header - Always at top */}
      <header className="flex-shrink-0 w-full" style={{ paddingTop: '20px', paddingBottom: '10px' }}>
        <Image
          src="/halifax-regional-municipality-logo-png_seeklogo-504971 (1).png"
          alt="Halifax Regional Municipality Logo"
          width={180}
          height={68}
          className="mx-auto sm:w-[220px] sm:h-[83px]"
          priority
        />
      </header>

      {/* Scrollable Content - Takes remaining space */}
      <div className="flex-1 flex flex-col items-center justify-center text-center px-4 overflow-y-auto min-h-0">
        <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: '#01558E' }}>
          {route.name === "alderney" ? "Alderney" : "Woodside"} Ferry
        </h1>
        <p className="text-sm sm:text-base mt-1" style={{ color: '#01558E' }}>
          {route.direction === "toHalifax"
            ? "to Halifax Ferry Terminal"
            : `from Halifax to ${
                route.name === "alderney" ? "Alderney" : "Woodside"
              }`}
        </p>

        <div className="mt-2 sm:mt-4 text-center">
            {minutesUntil !== null ? (
                <>
                    <p className="text-base sm:text-lg" style={{ color: '#01558E' }}>Next departure in</p>
                    <p className="text-8xl sm:text-9xl font-bold tracking-tighter -my-1" style={{ color: '#01558E' }}>
                        {minutesUntil}
                    </p>
                    <p className="text-base sm:text-lg" style={{ color: '#01558E' }}>minutes</p>
                    <p className="text-sm sm:text-base mt-1" style={{ color: '#01558E' }}>at {nextFerry}</p>
                </>
            ) : (
                <p className="text-xl sm:text-2xl font-bold" style={{ color: '#dc2626' }}>
                    No more ferries today.
                </p>
            )}
        </div>
      </div>

      {/* Fixed Footer - Always at bottom */}
      <footer className="flex-shrink-0 flex flex-col items-center space-y-3 w-full max-w-xs mx-auto px-4 pb-6">
          <ToggleGroup
            type="single"
            value={route.name}
            onValueChange={(value: RouteName) => {
              if (value) setRoute((prev) => ({ ...prev, name: value }));
            }}
            className="w-full"
          >
            <ToggleGroupItem 
              value="alderney" 
              className="w-1/2 text-sm sm:text-base py-3"
              style={{ 
                borderColor: '#01558E', 
                color: route.name === "alderney" ? 'white' : '#01558E',
                backgroundColor: route.name === "alderney" ? '#01558E' : 'transparent'
              }}
            >
              Alderney
            </ToggleGroupItem>
            <ToggleGroupItem 
              value="woodside" 
              className="w-1/2 text-sm sm:text-base py-3"
              style={{ 
                borderColor: '#01558E', 
                color: route.name === "woodside" ? 'white' : '#01558E',
                backgroundColor: route.name === "woodside" ? '#01558E' : 'transparent'
              }}
            >
              Woodside
            </ToggleGroupItem>
          </ToggleGroup>

          <ToggleGroup
            type="single"
            value={route.direction}
            onValueChange={(value: Direction) => {
              if (value) setRoute((prev) => ({ ...prev, direction: value }));
            }}
            className="w-full"
          >
            <ToggleGroupItem 
              value="toHalifax" 
              className="w-1/2 text-sm sm:text-base py-3"
              style={{ 
                borderColor: '#01558E', 
                color: route.direction === "toHalifax" ? 'white' : '#01558E',
                backgroundColor: route.direction === "toHalifax" ? '#01558E' : 'transparent'
              }}
            >
              To Halifax
            </ToggleGroupItem>
            <ToggleGroupItem 
              value="fromHalifax" 
              className="w-1/2 text-sm sm:text-base py-3"
              style={{ 
                borderColor: '#01558E', 
                color: route.direction === "fromHalifax" ? 'white' : '#01558E',
                backgroundColor: route.direction === "fromHalifax" ? '#01558E' : 'transparent'
              }}
            >
              To Dartmouth
            </ToggleGroupItem>
          </ToggleGroup>
      </footer>
    </main>
  );
}

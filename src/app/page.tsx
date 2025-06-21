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

  const getDayCategory = (date: Date): DayCategory => {
    const day = date.getDay();
    // Basic holiday check - can be expanded
    // For now, only checking for a few major ones.
    const holidays = [
      "01-01", // New Year's Day
      "12-25", // Christmas Day
      "12-26", // Boxing Day
    ];
    const dateString = `${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    if (holidays.includes(dateString)) return "holiday";
    if (day === 0) return "sunday";
    if (day === 6) return "saturday";
    return "weekday";
  };
  
  const getDepartureTimes = (now: Date, forDate: Date, route: Route): string[] => {
    const dayCategory = getDayCategory(forDate);
    const scheduleForDay = schedules[route.name][dayCategory]?.[route.direction];
    if (!scheduleForDay) return [];

    let allTimes: string[] = [];
    Object.values(scheduleForDay).forEach(period => {
        allTimes.push(...period.times);
    });
    
    allTimes.sort();
    
    return allTimes;
  }

  useEffect(() => {
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

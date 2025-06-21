export type DayCategory = 'weekday' | 'saturday' | 'sunday' | 'holiday';

export type RouteName = 'alderney' | 'woodside';
export type Direction = 'toHalifax' | 'fromHalifax';

export interface Schedule {
  [key: string]: {
    times: string[];
    frequency?: {
      start: string;
      end: string;
      interval: number;
    };
  };
}

const alderneySchedule: Record<DayCategory, Record<Direction, Schedule>> = {
  weekday: {
    toHalifax: {
      morning: {
        times: [
          '06:30', '07:00', '07:15', '07:30', '07:45', '08:00', '08:15', '08:30', '08:45',
          '09:00', '09:15', '09:30', '09:45', '10:00',
        ],
      },
      midday: {
        times: [],
        frequency: {
          start: '10:15',
          end: '19:15',
          interval: 15,
        },
      },
      evening: {
        times: [
          '19:30', '20:00', '20:30', '21:00', '21:30', '22:00', '22:30', '23:00',
        ],
      },
    },
    fromHalifax: {
      morning: {
        times: [
          '06:42', '07:12', '07:27', '07:42', '07:57', '08:12', '08:27', '08:42',
          '08:57', '09:12', '09:27', '09:42', '09:57', '10:12',
        ],
      },
      midday: {
        times: [],
        frequency: {
          start: '10:27',
          end: '19:27',
          interval: 15,
        },
      },
      evening: {
        times: [
          '19:42', '20:12', '20:42', '21:12', '21:42', '22:12', '22:42', '23:12',
        ],
      },
    },
  },
  saturday: {
    toHalifax: {
      main: {
        times: [
          '06:30', '07:00', '07:30', '08:00',
        ],
      },
      frequent: {
        times: [],
        frequency: {
          start: '08:30',
          end: '23:30',
          interval: 30,
        },
      }
    },
    fromHalifax: {
      main: {
        times: [
          '06:42', '07:12', '07:42', '08:12',
        ],
      },
      frequent: {
        times: [],
        frequency: {
          start: '08:42',
          end: '23:42',
          interval: 30,
        }
      }
    },
  },
  sunday: {
    toHalifax: {
      main: {
        times: [
          '06:45', '07:15', '07:45', '08:15',
        ],
      },
      frequent: {
        times: [],
        frequency: {
          start: '08:45',
          end: '23:45',
          interval: 30,
        }
      }
    },
    fromHalifax: {
      main: {
        times: [
          '06:57', '07:27', '07:57', '08:27',
        ],
      },
      frequent: {
        times: [],
        frequency: {
          start: '08:57',
          end: '23:57',
          interval: 30,
        }
      }
    },
  },
  holiday: {
    toHalifax: {
      main: {
        times: [],
        frequency: {
          start: '10:00',
          end: '23:30',
          interval: 30
        }
      }
    },
    fromHalifax: {
      main: {
        times: [],
        frequency: {
          start: '10:12',
          end: '23:42',
          interval: 30
        }
      }
    }
  },
};

const woodsideSchedule: Record<DayCategory, Record<Direction, Schedule>> = {
  weekday: {
    toHalifax: {
      main: {
        times: [
          '06:37', '06:52', '07:07', '07:22', '07:37', '07:52', '08:07', '08:22',
          '08:37', '08:52', '09:07', '09:22', '09:37', '09:52', '10:07', '10:22', '10:37',
        ],
      },
      frequent: {
        times: [],
        frequency: {
          start: '10:52',
          end: '20:37',
          interval: 30,
        }
      }
    },
    fromHalifax: {
      main: {
        times: [
          '06:49', '07:04', '07:19', '07:34', '07:49', '08:04', '08:19', '08:34', '08:49',
          '09:04', '09:19', '09:34', '09:49', '10:04', '10:19', '10:34', '10:49',
        ],
      },
      frequent: {
        times: [],
        frequency: {
          start: '11:04',
          end: '21:04',
          interval: 30
        }
      }
    },
  },
  saturday: {
    toHalifax: { main: { times: [] } },
    fromHalifax: { main: { times: [] } },
  },
  sunday: {
    toHalifax: { main: { times: [] } },
    fromHalifax: { main: { times: [] } },
  },
  holiday: {
    toHalifax: { main: { times: [] } },
    fromHalifax: { main: { times: [] } },
  },
};


const generateTimes = (start: string, end: string, interval: number): string[] => {
  const times: string[] = [];
  let currentTime = new Date(`1970-01-01T${start}:00`);
  const endTime = new Date(`1970-01-01T${end}:00`);

  while (currentTime <= endTime) {
    times.push(
      currentTime.toTimeString().slice(0, 5)
    );
    currentTime.setMinutes(currentTime.getMinutes() + interval);
  }
  return times;
};

const processSchedule = (schedule: Record<DayCategory, Record<Direction, Schedule>>) => {
  for (const dayCategory in schedule) {
    for (const direction in schedule[dayCategory as DayCategory]) {
      for (const period in schedule[dayCategory as DayCategory][direction as Direction]) {
        const p = schedule[dayCategory as DayCategory][direction as Direction][period];
        if (p.frequency) {
          p.times.push(...generateTimes(p.frequency.start, p.frequency.end, p.frequency.interval));
        }
      }
    }
  }
  return schedule;
}

export const schedules = {
  alderney: processSchedule(alderneySchedule),
  woodside: processSchedule(woodsideSchedule),
}; 
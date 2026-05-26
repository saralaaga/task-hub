export type CalendarDropTarget =
  | string
  | {
      dateKey: string;
      startMinutes?: number;
      durationMinutes?: number;
    };

export type TimedCalendarTarget = {
  dateKey: string;
  startMinutes?: number;
  durationMinutes?: number;
};

export function calendarDropTargetParts(target: CalendarDropTarget): TimedCalendarTarget {
  return typeof target === "string" ? { dateKey: target } : target;
}

export function withCalendarDropTargetDate(target: CalendarDropTarget, dateKey: string): CalendarDropTarget {
  const current = calendarDropTargetParts(target);
  if (current.startMinutes === undefined && current.durationMinutes === undefined) {
    return dateKey;
  }
  return {
    ...current,
    dateKey
  };
}

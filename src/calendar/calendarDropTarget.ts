export type CalendarDropTarget =
  | string
  | {
      dateKey: string;
      startMinutes?: number;
      durationMinutes?: number;
    }
  | {
      kind: "unscheduled";
    };

export type TimedCalendarTarget = {
  dateKey: string;
  startMinutes?: number;
  durationMinutes?: number;
};

export function calendarDropTargetParts(target: CalendarDropTarget): TimedCalendarTarget {
  if (isUnscheduledCalendarDropTarget(target)) {
    throw new Error("Unscheduled calendar drop target does not have date parts");
  }
  return typeof target === "string" ? { dateKey: target } : target;
}

export function withCalendarDropTargetDate(target: CalendarDropTarget, dateKey: string): CalendarDropTarget {
  if (isUnscheduledCalendarDropTarget(target)) return target;
  const current = calendarDropTargetParts(target);
  if (current.startMinutes === undefined && current.durationMinutes === undefined) {
    return dateKey;
  }
  return {
    ...current,
    dateKey
  };
}

export function isUnscheduledCalendarDropTarget(target: CalendarDropTarget): target is { kind: "unscheduled" } {
  return typeof target === "object" && "kind" in target && target.kind === "unscheduled";
}

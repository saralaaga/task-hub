export type DateBucket = "overdue" | "today" | "tomorrow" | "thisWeek" | "future" | "noDate" | "otherCompleted";

export function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getTaskDateBucket(dueDate: string | undefined, now: Date): DateBucket {
  if (!dueDate) return "noDate";

  const today = toLocalDateKey(now);
  const tomorrow = toLocalDateKey(addDays(now, 1));
  if (dueDate < today) return "overdue";
  if (dueDate === today) return "today";
  if (dueDate === tomorrow) return "tomorrow";
  if (isWithinNextDays(dueDate, now, 7)) return "thisWeek";
  return "future";
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isWithinNextDays(dateKey: string, now: Date, days: number): boolean {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(start.getDate() + days);
  const candidate = new Date(`${dateKey}T00:00:00`);
  return candidate > start && candidate <= end;
}

import type { TaskItem, TaskListManualOrder } from "./types";
import { taskPlannedDateKey } from "./taskDates";

export type TaskListDropPosition = "before" | "after";

export function taskStableId(task: TaskItem): string {
  return task.stableId ?? task.id;
}

export function taskListDateKey(task: TaskItem): string | undefined {
  return taskPlannedDateKey(task);
}

export function sortTasksForTaskList(tasks: TaskItem[]): TaskItem[] {
  return tasks
    .map((task, index) => ({ task, index }))
    .sort((left, right) => compareTaskListDates(left.task, right.task) || left.index - right.index)
    .map(({ task }) => task);
}

export function compareTaskListDates(left: TaskItem, right: TaskItem): number {
  const leftDate = taskListDateKey(left);
  const rightDate = taskListDateKey(right);
  if (!leftDate && !rightDate) return 0;
  if (!leftDate) return 1;
  if (!rightDate) return -1;
  return leftDate.localeCompare(rightDate);
}

export function applyTaskListManualOrder(tasks: TaskItem[], manualOrder: TaskListManualOrder): TaskItem[] {
  const sorted = sortTasksForTaskList(tasks);
  const ordered: TaskItem[] = [];
  let currentDateKey: string | undefined;
  let currentGroup: TaskItem[] = [];

  const flush = () => {
    if (currentGroup.length === 0) return;
    if (!currentDateKey) {
      ordered.push(...currentGroup);
    } else {
      ordered.push(...applyTaskListManualOrderForDate(currentGroup, manualOrder[currentDateKey] ?? []));
    }
    currentGroup = [];
  };

  for (const task of sorted) {
    const dateKey = taskListDateKey(task);
    if (dateKey !== currentDateKey) {
      flush();
      currentDateKey = dateKey;
    }
    currentGroup.push(task);
  }
  flush();

  return ordered;
}

export function applyTaskListManualOrderForDate(tasksOnDate: TaskItem[], orderedStableIds: readonly string[]): TaskItem[] {
  if (tasksOnDate.length <= 1 || orderedStableIds.length === 0) return [...tasksOnDate];
  const indexByStableId = new Map(
    uniqueStableIds(orderedStableIds).map((stableId, index) => [stableId, index])
  );
  const ranked = tasksOnDate
    .filter((task) => indexByStableId.has(taskStableId(task)))
    .sort((left, right) => (indexByStableId.get(taskStableId(left)) ?? 0) - (indexByStableId.get(taskStableId(right)) ?? 0));
  const unranked = tasksOnDate.filter((task) => !indexByStableId.has(taskStableId(task)));
  return [...ranked, ...unranked];
}

export function reorderTaskListDate(
  tasksOnDate: TaskItem[],
  manualOrder: TaskListManualOrder,
  draggedTask: TaskItem,
  anchorTask: TaskItem,
  position: TaskListDropPosition
): string[] {
  const dateKey = taskListDateKey(draggedTask);
  if (!dateKey || dateKey !== taskListDateKey(anchorTask)) return tasksOnDate.map(taskStableId);

  const orderedIds = applyTaskListManualOrderForDate(tasksOnDate, manualOrder[dateKey] ?? []).map(taskStableId);
  const draggedStableId = taskStableId(draggedTask);
  const anchorStableId = taskStableId(anchorTask);
  if (draggedStableId === anchorStableId) return orderedIds;

  const next = orderedIds.filter((stableId) => stableId !== draggedStableId);
  const anchorIndex = next.indexOf(anchorStableId);
  if (anchorIndex === -1) return orderedIds;
  const insertIndex = position === "before" ? anchorIndex : anchorIndex + 1;
  next.splice(insertIndex, 0, draggedStableId);
  return next;
}

export function cleanupTaskListManualOrder(
  manualOrder: TaskListManualOrder,
  tasks: TaskItem[]
): TaskListManualOrder {
  if (Object.keys(manualOrder).length === 0) return {};
  const result: TaskListManualOrder = {};
  const tasksByDate = groupTasksByDate(sortTasksForTaskList(tasks));

  for (const [dateKey, storedStableIds] of Object.entries(manualOrder)) {
    const dateTasks = tasksByDate.get(dateKey);
    if (!dateTasks || dateTasks.length === 0) continue;

    const dateStableIds = new Set(dateTasks.map(taskStableId));
    const validStableIds = uniqueStableIds(storedStableIds).filter((stableId) => dateStableIds.has(stableId));
    if (validStableIds.length === 0) continue;

    const defaultOrder = dateTasks.map(taskStableId);
    const appliedOrder = applyTaskListManualOrderForDate(dateTasks, validStableIds).map(taskStableId);
    if (arraysEqual(defaultOrder, appliedOrder)) continue;

    result[dateKey] = validStableIds;
  }

  return result;
}

function groupTasksByDate(tasks: TaskItem[]): Map<string, TaskItem[]> {
  const tasksByDate = new Map<string, TaskItem[]>();
  for (const task of tasks) {
    const dateKey = taskListDateKey(task);
    if (!dateKey) continue;
    tasksByDate.set(dateKey, [...(tasksByDate.get(dateKey) ?? []), task]);
  }
  return tasksByDate;
}

function uniqueStableIds(stableIds: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const stableId of stableIds) {
    if (seen.has(stableId)) continue;
    seen.add(stableId);
    result.push(stableId);
  }
  return result;
}

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

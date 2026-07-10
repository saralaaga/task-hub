import type { TaskHubSmartList, TaskItem } from "../types";
import { filterTasks } from "./filters";

export function applySmartListToTasks(tasks: TaskItem[], smartList: TaskHubSmartList, _now: Date): TaskItem[] {
  const filteredTasks = smartList.filters ? filterTasks(tasks, smartList.filters, _now) : [];
  const includedTaskIds = new Set(filteredTasks.map((task) => task.id));
  const selectedStableIds = new Set(smartList.taskStableIds);
  const selectedTaskIds = new Set(smartList.taskIds);
  const excludedStableIds = new Set(smartList.excludedTaskStableIds ?? []);
  const excludedTaskIds = new Set(smartList.excludedTaskIds ?? []);
  const selectedTasks = tasks.filter((task) => {
    if (includedTaskIds.has(task.id)) return false;
    return (task.stableId && selectedStableIds.has(task.stableId)) || selectedTaskIds.has(task.id);
  });

  return [...filteredTasks, ...selectedTasks].filter((task) => {
    return !(task.stableId && excludedStableIds.has(task.stableId)) && !excludedTaskIds.has(task.id);
  });
}

export function smartListTaskReferences(tasks: TaskItem[]): Pick<TaskHubSmartList, "taskStableIds" | "taskIds"> {
  return {
    taskStableIds: Array.from(new Set(tasks.map((task) => task.stableId).filter((stableId): stableId is string => Boolean(stableId)))),
    taskIds: Array.from(new Set(tasks.filter((task) => !task.stableId).map((task) => task.id).filter(Boolean)))
  };
}

export function materializeLegacySmartLists(
  tasks: TaskItem[],
  smartLists: readonly TaskHubSmartList[],
  now: Date
): { smartLists: TaskHubSmartList[]; changed: boolean } {
  let changed = false;
  const updatedAt = now.toISOString();
  const nextSmartLists = smartLists.map((smartList) => {
    if (!isLegacySmartList(smartList)) return smartList;
    changed = true;
    return {
      id: smartList.id,
      name: smartList.name,
      ...(smartList.color ? { color: smartList.color } : {}),
      ...smartListTaskReferences(applyLegacySmartListToTasks(tasks, smartList, now)),
      createdAt: smartList.createdAt,
      updatedAt
    };
  });
  return { smartLists: nextSmartLists, changed };
}

function applyLegacySmartListToTasks(tasks: TaskItem[], smartList: TaskHubSmartList, now: Date): TaskItem[] {
  return applySmartListToTasks(tasks, smartList, now);
}

function isLegacySmartList(smartList: TaskHubSmartList): boolean {
  return Boolean(smartList.filters) ||
    (smartList.excludedTaskStableIds?.length ?? 0) > 0 ||
    (smartList.excludedTaskIds?.length ?? 0) > 0;
}

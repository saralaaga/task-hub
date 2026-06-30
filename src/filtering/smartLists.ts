import type { TaskHubSmartList, TaskItem } from "../types";
import { filterTasks } from "./filters";

export function applySmartListToTasks(tasks: TaskItem[], smartList: TaskHubSmartList, now: Date): TaskItem[] {
  const filteredTasks = filterTasks(tasks, smartList.filters, now);
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

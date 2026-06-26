import type { TaskItem } from "./types";

export type TaskProgressInfo = {
  percent: number;
  roundedPercent: number;
  directChildCount: number;
  completeChildrenCount: number;
  partialChildrenCount: number;
  notStartedChildrenCount: number;
};

export function buildSubtaskProgressIndex(tasks: TaskItem[]): Map<string, TaskProgressInfo> {
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const childTasksByParentId = new Map<string, TaskItem[]>();

  for (const task of tasks) {
    if (!task.parentId || !tasksById.has(task.parentId)) continue;
    childTasksByParentId.set(task.parentId, [...(childTasksByParentId.get(task.parentId) ?? []), task]);
  }

  const progressByTaskId = new Map<string, TaskProgressInfo>();
  const percentCache = new Map<string, number>();
  const visiting = new Set<string>();

  const computePercent = (taskId: string): number => {
    const cached = percentCache.get(taskId);
    if (cached !== undefined) return cached;
    if (visiting.has(taskId)) return 0;

    visiting.add(taskId);
    const task = tasksById.get(taskId);
    const children = childTasksByParentId.get(taskId) ?? [];

    if (!task || children.length === 0) {
      const leafPercent = task?.completed ? 100 : 0;
      percentCache.set(taskId, leafPercent);
      visiting.delete(taskId);
      return leafPercent;
    }

    const childPercents = children.map((child) => computePercent(child.id));
    const percent = childPercents.reduce((sum, value) => sum + value, 0) / childPercents.length;
    const completeChildrenCount = childPercents.filter((value) => value >= 100).length;
    const partialChildrenCount = childPercents.filter((value) => value > 0 && value < 100).length;
    const notStartedChildrenCount = childPercents.filter((value) => value <= 0).length;

    percentCache.set(taskId, percent);
    progressByTaskId.set(taskId, {
      percent,
      roundedPercent: Math.round(percent),
      directChildCount: children.length,
      completeChildrenCount,
      partialChildrenCount,
      notStartedChildrenCount
    });
    visiting.delete(taskId);
    return percent;
  };

  for (const taskId of childTasksByParentId.keys()) {
    computePercent(taskId);
  }

  return progressByTaskId;
}

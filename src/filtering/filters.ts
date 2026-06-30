import { getTaskDateBucket, type DateBucket } from "../calendar/dateBuckets";
import type { TaskItem, TaskStatusFilter } from "../types";
import { taskPlannedDateKey } from "../taskDates";

export type TaskFilterState = {
  status: TaskStatusFilter;
  dateBucket?: DateBucket;
  tags: string[];
  conditions?: TaskConditionFilters;
  tagQuery?: string;
  sourceQuery: string;
  textQuery: string;
};

export type TaskConditionFilters = {
  operator: "and" | "or";
  tag: string;
  dateBucket: "" | DateBucket;
  text: string;
};

export function filterTasks(tasks: TaskItem[], filters: TaskFilterState, now: Date): TaskItem[] {
  const sourceQuery = filters.sourceQuery.toLowerCase();
  const textQuery = filters.textQuery.trim().toLowerCase();
  const tagQuery = filters.tagQuery?.trim();

  return sortTasksByCompletion(tasks.filter((task) => {
    if (filters.status === "open" && task.completed) return false;
    if (filters.status === "completed" && !task.completed) return false;
    if (filters.dateBucket && getTaskBucket(task, now) !== filters.dateBucket) return false;
    if (filters.tags.length > 0 && !filters.tags.every((tag) => task.tags.some((taskTag) => isTagMatch(taskTag, tag)))) return false;
    if (tagQuery && !task.tags.some((taskTag) => isTagMatch(taskTag, tagQuery))) return false;
    if (sourceQuery === "vault" || sourceQuery === "apple-reminders" || sourceQuery === "dida") {
      if (task.source !== sourceQuery) return false;
    } else if (sourceQuery && !task.filePath.toLowerCase().includes(sourceQuery)) {
      return false;
    }
    if (!matchesConditions(task, filters.conditions, now)) return false;
    if (textQuery && !matchesTaskTextQuery(task, textQuery)) return false;
    return true;
  }));
}

export function groupTasksByDateBucket(tasks: TaskItem[], now: Date): Record<DateBucket, TaskItem[]> {
  const groups = tasks.reduce<Record<DateBucket, TaskItem[]>>(
    (groups, task) => {
      groups[getTaskBucket(task, now)].push(task);
      return groups;
    },
    { overdue: [], today: [], tomorrow: [], thisWeek: [], future: [], noDate: [], otherCompleted: [] }
  );

  for (const bucket of Object.keys(groups) as DateBucket[]) {
    groups[bucket] = sortTasksByCompletion(groups[bucket]);
  }

  return groups;
}

export function getTaskBucket(task: TaskItem, now: Date): DateBucket {
  const bucket = getTaskDateBucket(taskPlannedDateKey(task), now);
  return task.completed && bucket === "overdue" ? "otherCompleted" : bucket;
}

export function sortTasksByCompletion(tasks: TaskItem[]): TaskItem[] {
  return tasks
    .map((task, index) => ({ task, index }))
    .sort((left, right) => Number(left.task.completed) - Number(right.task.completed) || left.index - right.index)
    .map(({ task }) => task);
}

function isTagMatch(taskTag: string, selectedTag: string): boolean {
  return taskTag === selectedTag || taskTag.startsWith(`${selectedTag}/`);
}

function matchesConditions(task: TaskItem, conditions: TaskConditionFilters | undefined, now: Date): boolean {
  if (!conditions) return true;
  const checks: boolean[] = [];
  const tags = splitFilterTags(conditions.tag);
  const text = conditions.text.trim().toLowerCase();
  if (tags.length > 0) {
    checks.push(tags.every((tag) => task.tags.some((taskTag) => isTagMatch(taskTag, tag))));
  }
  if (conditions.dateBucket) {
    checks.push(getTaskBucket(task, now) === conditions.dateBucket);
  }
  if (text) {
    checks.push(matchesTaskTextQuery(task, text));
  }
  if (checks.length === 0) return true;
  return conditions.operator === "or" ? checks.some(Boolean) : checks.every(Boolean);
}

function matchesTaskTextQuery(task: TaskItem, query: string): boolean {
  return [
    task.text,
    ...task.tags
  ].some((value) => value.toLowerCase().includes(query));
}

function splitFilterTags(value: string): string[] {
  return Array.from(new Set(value.split(/\s+/).map((tag) => {
    const normalized = tag.trim().replace(/^#+/u, "");
    return normalized ? `#${normalized}` : "";
  }).filter(Boolean)));
}

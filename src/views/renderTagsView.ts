import type { Translator } from "../i18n";
import type { TaskItem } from "../types";

export type TagViewHandlers = {
  onTagSelect: (tag: string) => void;
  onTaskComplete: (task: TaskItem) => void;
  onTaskSelect: (task: TaskItem) => void;
  onReorderTags: (sourceTag: string, targetTag: string) => void;
};

export type TagRenderOptions = {
  allowAppleReminderWriteback: boolean;
  orderedTags?: string[];
  sourceColors?: Partial<Record<TaskItem["source"], string>>;
  taskColors?: Record<string, string>;
};

export function renderTagsView(
  container: HTMLElement,
  tasks: TaskItem[],
  handlers: TagViewHandlers,
  t: Translator,
  options: TagRenderOptions = { allowAppleReminderWriteback: false }
): void {
  container.empty();

  const groups = sortTagGroups(buildTagGroups(tasks), options.orderedTags);
  if (groups.length === 0) {
    container.createDiv({ cls: "task-hub-empty", text: t("noTags") });
    return;
  }

  const grid = container.createDiv({ cls: "task-hub-tag-grid" });
  for (const group of groups) {
    renderTagCard(grid, group, handlers, t, options);
  }
}

function renderTagCard(
  container: HTMLElement,
  group: TagGroup,
  handlers: TagViewHandlers,
  t: Translator,
  options: TagRenderOptions
): void {
  const card = container.createDiv({ cls: "task-hub-tag-card" });
  card.draggable = true;
  card.setAttr("data-tag", group.tag);
  card.addEventListener("dragstart", (event: DragEvent) => {
    if (!event.dataTransfer) return;
    event.dataTransfer.setData("text/task-hub-tag", group.tag);
    event.dataTransfer.effectAllowed = "move";
    card.addClass("is-dragging");
  });
  card.addEventListener("dragend", () => {
    card.removeClass("is-dragging");
  });
  card.addEventListener("dragover", (event: DragEvent) => {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    card.addClass("is-drop-target");
  });
  card.addEventListener("dragleave", () => {
    card.removeClass("is-drop-target");
  });
  card.addEventListener("drop", (event: DragEvent) => {
    event.preventDefault();
    card.removeClass("is-drop-target");
    const sourceTag = event.dataTransfer?.getData("text/task-hub-tag");
    if (!sourceTag || sourceTag === group.tag) return;
    handlers.onReorderTags(sourceTag, group.tag);
  });
  const header = card.createDiv({ cls: "task-hub-tag-header" });
  header.createSpan({ cls: "task-hub-tag-title", text: group.tag });
  header.addEventListener("click", () => handlers.onTagSelect(group.tag));
  renderMetrics(header, group.tasks, t);
  const taskList = card.createDiv({ cls: "task-hub-tag-task-list" });
  for (const entry of group.entries) {
    renderTagTask(taskList, entry.task, group.tag, handlers, options, entry.contextOnly);
  }
}

function renderTagTask(
  container: HTMLElement,
  task: TaskItem,
  cardTag: string,
  handlers: TagViewHandlers,
  options: TagRenderOptions,
  contextOnly = false
): void {
  const item = container.createDiv({
    cls: ["task-hub-tag-task", task.completed ? "is-completed" : "", contextOnly ? "is-context" : ""].filter(Boolean).join(" ")
  });
  const color = taskDisplayColor(task, options);
  if (color) item.style.setProperty("--task-hub-source-color", color);
  item.style.setProperty("--task-hub-task-indent", String(task.indent ?? 0));
  const checkbox = item.createEl("input", { type: "checkbox" });
  checkbox.checked = task.completed;
  checkbox.disabled = task.source !== "vault" && !(task.source === "apple-reminders" && options.allowAppleReminderWriteback);
  checkbox.addEventListener("click", (event) => {
    event.stopPropagation();
    handlers.onTaskComplete(task);
  });
  const body = item.createDiv({ cls: "task-hub-tag-task-body" });
  const title = body.createSpan({ cls: "task-hub-tag-task-title", text: renderPlainTaskText(task.text) });
  const extraTags = tagsForTaskCard(task, cardTag);
  if (extraTags.length > 0) {
    const tagList = body.createDiv({ cls: "task-hub-tag-task-tags" });
    for (const tag of extraTags) {
      tagList.createSpan({ cls: "task-hub-task-tag", text: tag });
    }
    scheduleWrappedTagLayout(body, title);
  }
  item.addEventListener("click", () => handlers.onTaskSelect(task));
}

function taskDisplayColor(task: TaskItem, options: Pick<TagRenderOptions, "sourceColors" | "taskColors">): string | undefined {
  return (task.externalListId ? options.taskColors?.[task.externalListId] : undefined) ?? options.sourceColors?.[task.source];
}

function tagsForTaskCard(task: TaskItem, cardTag: string | null | undefined): string[] {
  if (!cardTag) return task.tags;
  return task.tags.filter((tag) => !isTagMatch(tag, cardTag));
}

function renderPlainTaskText(text: string): string {
  return text.replace(/\\([\\`*_[\]{}()#+\-.!|>])/g, "$1");
}

function scheduleWrappedTagLayout(body: HTMLElement, title: HTMLElement): void {
  const update = () => {
    if (isMultiLine(title)) body.addClass("is-title-wrapped");
    else body.removeClass("is-title-wrapped");
  };

  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(update);
    return;
  }

  update();
}

function isMultiLine(element: HTMLElement): boolean {
  if (typeof window === "undefined") return false;
  const style = window.getComputedStyle(element);
  const lineHeight = Number.parseFloat(style.lineHeight);
  if (!Number.isFinite(lineHeight) || lineHeight <= 0) return element.getClientRects().length > 1;
  return element.scrollHeight > lineHeight * 1.5;
}

function renderMetrics(container: HTMLElement, tasks: TaskItem[], t: Translator): void {
  const open = tasks.filter((task) => !task.completed).length;
  const metrics = container.createDiv({ cls: "task-hub-tag-metrics" });
  metrics.createSpan({ text: `${open} ${t("open")}` });
  metrics.createSpan({ text: `${tasks.length} ${t("all")}` });
}

function sortTagTasks(tasks: TaskItem[]): TaskItem[] {
  return tasks
    .map((task, index) => ({ task, index }))
    .sort((left, right) => Number(left.task.completed) - Number(right.task.completed) || left.index - right.index)
    .map(({ task }) => task);
}

type TagGroup = {
  tag: string;
  tasks: TaskItem[];
  entries: TagTaskEntry[];
};

type TagTaskEntry = {
  task: TaskItem;
  contextOnly: boolean;
};

function buildTagGroups(tasks: TaskItem[]): TagGroup[] {
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const tags = Array.from(new Set(tasks.flatMap((task) => task.tags))).sort((left, right) => left.localeCompare(right));
  const groups = new Map<string, TagGroup>();
  for (const tag of tags) {
    const groupTasks = tasks.filter((task) => task.tags.some((taskTag) => isTagMatch(taskTag, tag)));
    groups.set(tag, { tag, tasks: groupTasks, entries: buildTagEntries(groupTasks, tag, tasksById) });
  }

  return Array.from(groups.values()).sort((left, right) => left.tag.localeCompare(right.tag));
}

function buildTagEntries(groupTasks: TaskItem[], cardTag: string, tasksById: Map<string, TaskItem>): TagTaskEntry[] {
  const entries: TagTaskEntry[] = [];
  const renderedTaskIds = new Set<string>();

  for (const task of sortTagTasks(groupTasks)) {
    for (const parent of missingParentChain(task, cardTag, tasksById)) {
      if (renderedTaskIds.has(parent.id)) continue;
      entries.push({ task: parent, contextOnly: true });
      renderedTaskIds.add(parent.id);
    }

    if (renderedTaskIds.has(task.id)) continue;
    entries.push({ task, contextOnly: false });
    renderedTaskIds.add(task.id);
  }

  return entries;
}

function missingParentChain(task: TaskItem, cardTag: string, tasksById: Map<string, TaskItem>): TaskItem[] {
  const parents: TaskItem[] = [];
  const visitedTaskIds = new Set<string>();
  let parentId = task.parentId;

  while (parentId && !visitedTaskIds.has(parentId)) {
    visitedTaskIds.add(parentId);
    const parent = tasksById.get(parentId);
    if (!parent) break;
    if (!isTaskMatch(parent, cardTag)) parents.push(parent);
    parentId = parent.parentId;
  }

  return parents.reverse();
}

function isTaskMatch(task: TaskItem, selectedTag: string): boolean {
  return task.tags.some((taskTag) => isTagMatch(taskTag, selectedTag));
}

function sortTagGroups(groups: TagGroup[], orderedTags: string[] = []): TagGroup[] {
  const rank = new Map(orderedTags.map((tag, index) => [tag, index]));
  return [...groups].sort((left, right) => {
    const leftRank = rank.get(left.tag);
    const rightRank = rank.get(right.tag);
    if (leftRank !== undefined && rightRank !== undefined) return leftRank - rightRank;
    if (leftRank !== undefined) return -1;
    if (rightRank !== undefined) return 1;
    const openDelta = right.tasks.filter((task) => !task.completed).length - left.tasks.filter((task) => !task.completed).length;
    if (openDelta !== 0) return openDelta;
    return left.tag.localeCompare(right.tag);
  });
}

function isTagMatch(taskTag: string, selectedTag: string): boolean {
  return taskTag === selectedTag || taskTag.startsWith(`${selectedTag}/`);
}

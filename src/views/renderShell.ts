import { setIcon } from "obsidian";
import type { DateBucket } from "../calendar/dateBuckets";
import { type TaskFilterState } from "../filtering/filters";
import type { Translator } from "../i18n";
import type { TaskIndexStats } from "../indexing/taskIndex";

export type DashboardView = "tasks" | "calendar" | "tags";

export type ShellState = {
  view: DashboardView;
  filters: TaskFilterState;
  availableTags: string[];
  sourceFilters?: SourceFilterOption[];
  stats: TaskIndexStats;
  isRefreshing?: boolean;
  t: Translator;
};

export type SourceFilterOption = {
  id: "all" | "vault" | "apple-reminders";
  label: string;
  count: number;
};

export type ShellHandlers = {
  onViewChange: (view: DashboardView) => void;
  onRescan: () => void | Promise<void>;
  onCreateTask: () => void;
  onStatusChange: (status: TaskFilterState["status"]) => void;
  onConditionChange: (conditions: NonNullable<TaskFilterState["conditions"]>) => void;
  onSourceFilterChange?: (source: SourceFilterOption["id"]) => void;
  onTextQueryChange: (query: string) => void;
};

export function renderShell(container: HTMLElement, state: ShellState, handlers: ShellHandlers): HTMLElement {
  container.empty();
  const root = container.createDiv({ cls: "task-hub-root" });

  const topBar = root.createDiv({ cls: "task-hub-header" });
  const title = topBar.createDiv({ cls: "task-hub-title" });
  title.createEl("h2", { text: state.t("taskHub") });
  title.createEl("p", {
    text: `${state.stats.taskCount} ${state.t("tasksIndexed")}. ${state.stats.indexed} ${state.t("changed")}, ${state.stats.skipped} ${state.t("skipped")}, ${state.stats.failed} ${state.t("failed")}.${state.stats.lastScanAt ? ` ${state.t("lastScan")}: ${state.stats.lastScanAt}` : ""}`
  });

  const toolbar = root.createDiv({ cls: "task-hub-toolbar" });
  const viewSwitch = toolbar.createDiv({ cls: "task-hub-view-switch" });
  for (const view of ["tasks", "calendar", "tags"] as DashboardView[]) {
    const button = viewSwitch.createEl("button", {
      cls: state.view === view ? "mod-cta" : "",
      text: state.t(view)
    });
    button.addEventListener("click", () => handlers.onViewChange(view));
  }

  renderFilters(toolbar, state, handlers);

  const main = root.createDiv({ cls: "task-hub-main" });
  return main;
}

function renderFilters(container: HTMLElement, state: ShellState, handlers: ShellHandlers): void {
  const showCompleted = container.createEl("label", { cls: "task-hub-completed-toggle" });
  const showCompletedCheckbox = showCompleted.createEl("input", { type: "checkbox" });
  showCompletedCheckbox.checked = state.filters.status !== "open";
  showCompletedCheckbox.addEventListener("change", () => {
    handlers.onStatusChange(showCompletedCheckbox.checked ? "all" : "open");
  });
  showCompleted.createSpan({ text: state.t("showCompletedInView") });

  const filters = container.createDiv({ cls: "task-hub-filter-strip" });
  renderConditionMenu(filters, state, handlers);
  renderSearch(filters, state, handlers);

  const createTask = filters.createEl("button", { cls: "task-hub-create-task-button" });
  createTask.setAttr("aria-label", state.t("add"));
  createTask.setAttr("title", state.t("add"));
  setIcon(createTask.createSpan({ cls: "task-hub-create-task-button-icon" }), "plus");
  createTask.createSpan({ text: state.t("add") });
  createTask.addEventListener("click", () => {
    handlers.onCreateTask();
  });

  const rescanLabel = state.isRefreshing ? state.t("rescanning") : state.t("rescan");
  const rescan = filters.createEl("button", { cls: `task-hub-icon-button task-hub-rescan-button ${state.isRefreshing ? "is-refreshing" : ""}` });
  rescan.setAttr("aria-label", rescanLabel);
  rescan.setAttr("title", rescanLabel);
  if (state.isRefreshing) {
    rescan.setAttr("aria-busy", "true");
    rescan.disabled = true;
  }
  setIcon(rescan, "refresh-cw");
  rescan.addEventListener("click", () => {
    void handlers.onRescan();
  });
}

function renderConditionMenu(container: HTMLElement, state: ShellState, handlers: ShellHandlers): void {
  const conditions = state.filters.conditions ?? { operator: "and" as const, tag: "", dateBucket: "" as const, text: "" };
  const sourceActive = state.filters.sourceQuery === "vault" || state.filters.sourceQuery === "apple-reminders";
  const activeConditionCount = [conditions.tag.trim(), conditions.dateBucket, conditions.text.trim(), sourceActive ? state.filters.sourceQuery : ""].filter(Boolean).length;
  const menu = container.createEl("details", { cls: "task-hub-condition-menu" });

  const trigger = menu.createEl("summary", { cls: activeConditionCount > 0 ? "task-hub-condition-trigger is-active" : "task-hub-condition-trigger" });
  setIcon(trigger.createSpan({ cls: "task-hub-condition-trigger-icon" }), "filter");
  trigger.createSpan({ text: state.t("filters") });
  if (activeConditionCount > 0) {
    trigger.createSpan({ cls: "task-hub-condition-count", text: String(activeConditionCount) });
  }

  const panel = menu.createDiv({ cls: "task-hub-condition-panel" });
  const header = panel.createDiv({ cls: "task-hub-condition-panel-header" });
  header.createSpan({ cls: "task-hub-condition-panel-title", text: state.t("conditionMatch") });

  const tagRow = panel.createEl("label", { cls: "task-hub-condition-row" });
  tagRow.createSpan({ text: state.t("conditionTag") });
  const tag = tagRow.createEl("input", {
    cls: "task-hub-condition-control",
    attr: { placeholder: "#project" },
    type: "search",
    value: conditions.tag
  });

  const dateRow = panel.createEl("label", { cls: "task-hub-condition-row" });
  const dateLabel = dateRow.createSpan({ cls: "task-hub-condition-label-with-operator" });
  dateLabel.createSpan({ text: state.t("conditionDate") });
  const operator = dateLabel.createEl("select", { cls: "task-hub-condition-operator" });
  operator.createEl("option", { text: state.t("and"), value: "and" });
  operator.createEl("option", { text: state.t("or"), value: "or" });
  operator.value = conditions.operator;
  const date = dateRow.createEl("select", { cls: "task-hub-condition-control" });
  date.createEl("option", { text: state.t("conditionDate"), value: "" });
  for (const bucket of ["overdue", "today", "tomorrow", "thisWeek", "future", "noDate", "otherCompleted"] as DateBucket[]) {
    date.createEl("option", { text: state.t(bucket), value: bucket });
  }
  date.value = conditions.dateBucket;

  const textRow = panel.createEl("label", { cls: "task-hub-condition-row" });
  const textLabel = textRow.createSpan({ cls: "task-hub-condition-label-with-operator" });
  textLabel.createSpan({ text: state.t("conditionText") });
  textLabel.createSpan({ cls: "task-hub-condition-operator-spacer" });
  const text = textRow.createEl("input", {
    cls: "task-hub-condition-control",
    attr: { placeholder: state.t("conditionText") },
    type: "search",
    value: conditions.text
  });

  if (state.sourceFilters && handlers.onSourceFilterChange) {
    const sourceRow = panel.createDiv({ cls: "task-hub-condition-row task-hub-condition-source-row" });
    sourceRow.createSpan({ text: state.t("source") });
    const sourceOptions = sourceRow.createDiv({ cls: "task-hub-source-filter-options" });
    const activeSource = state.filters.sourceQuery === "vault" || state.filters.sourceQuery === "apple-reminders"
      ? state.filters.sourceQuery
      : "all";
    for (const source of state.sourceFilters) {
      const button = sourceOptions.createEl("button", {
        cls: `task-hub-source-filter-chip ${source.id === activeSource ? "is-active" : ""}`
      });
      button.createSpan({ text: source.label });
      button.createSpan({ cls: "task-hub-source-filter-count", text: String(source.count) });
      button.addEventListener("click", (event) => {
        event.preventDefault();
        handlers.onSourceFilterChange?.(source.id);
      });
    }
  }

  const apply = () => {
    handlers.onConditionChange({
      operator: operator.value === "or" ? "or" : "and",
      tag: tag.value.trim(),
      dateBucket: date.value as "" | DateBucket,
      text: text.value.trim()
    });
  };

  const applyOnEnter = (event: KeyboardEvent) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    apply();
  };
  tag.addEventListener("keydown", applyOnEnter);
  text.addEventListener("keydown", applyOnEnter);

  const actions = panel.createDiv({ cls: "task-hub-condition-actions" });
  const clear = actions.createEl("button", { text: state.t("clearFilters") });
  clear.addEventListener("click", () => {
    handlers.onConditionChange({ operator: "and", tag: "", dateBucket: "", text: "" });
  });

  const applyButton = actions.createEl("button", { cls: "mod-cta", text: state.t("applyFilters") });
  applyButton.addEventListener("click", apply);
}

function renderSearch(container: HTMLElement, state: ShellState, handlers: ShellHandlers): void {
  const search = container.createDiv({ cls: "task-hub-search-group" });
  const text = search.createEl("input", {
    cls: "task-hub-search-control",
    attr: { placeholder: state.t("searchTasks") },
    type: "search",
    value: state.filters.textQuery
  });

  const apply = () => handlers.onTextQueryChange(text.value.trim());
  text.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    apply();
  });

  const button = search.createEl("button", { cls: "task-hub-search-button" });
  button.setAttr("aria-label", state.t("search"));
  button.setAttr("title", state.t("search"));
  setIcon(button.createSpan({ cls: "task-hub-search-button-icon" }), "search");
  button.createSpan({ text: state.t("search") });
  button.addEventListener("click", apply);
}

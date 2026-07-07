import {
  DEFAULT_SETTINGS,
  TASK_HUB_SETTINGS_SCHEMA_VERSION,
  TaskHubSettingTab,
  normalizeTaskHubSettings,
  openTaskHubFeedback,
  parseEventCreationTarget,
  parseTaskCreationTarget,
  populateEventCreationTargetDropdown,
  populateTaskCreationTargetDropdown,
  serializeEventCreationTarget,
  serializeTaskCreationTarget
} from "./settings";

jest.mock(
  "obsidian",
  () => ({
    PluginSettingTab: class {},
    Setting: class {
      public settingEl: TestElement;
      public infoEl: TestElement;
      public controlEl: TestElement;

      constructor(containerEl: TestElement) {
        this.settingEl = containerEl.createDiv({ cls: "setting-item" });
        this.infoEl = this.settingEl.createDiv({ cls: "setting-item-info" });
        this.controlEl = this.settingEl.createDiv({ cls: "setting-item-control" });
      }

      setName(name: string) {
        this.infoEl.createDiv({ cls: "setting-item-name", text: name });
        return this;
      }

      setDesc(desc: string | TestElement) {
        const descEl = this.infoEl.createDiv({ cls: "setting-item-description" });
        if (typeof desc === "string") descEl.setText(desc);
        else descEl.appendChild(desc);
        return this;
      }

      setHeading() {
        this.settingEl.addClass("setting-item-heading");
        return this;
      }

      addButton(callback: (button: MockButtonComponent) => void) {
        const button = new MockButtonComponent(this.controlEl);
        callback(button);
        return this;
      }

      addDropdown(callback: (dropdown: MockDropdownComponent) => void) {
        const dropdown = new MockDropdownComponent(this.controlEl);
        callback(dropdown);
        return this;
      }

      addText(callback: (text: MockTextComponent) => void) {
        const text = new MockTextComponent(this.controlEl, "input");
        callback(text);
        return this;
      }

      addTextArea(callback: (text: MockTextComponent) => void) {
        const text = new MockTextComponent(this.controlEl, "textarea");
        callback(text);
        return this;
      }

      addToggle(callback: (toggle: MockToggleComponent) => void) {
        const toggle = new MockToggleComponent(this.controlEl);
        callback(toggle);
        return this;
      }

      addExtraButton(callback: (button: MockExtraButtonComponent) => void) {
        const button = new MockExtraButtonComponent(this.controlEl);
        callback(button);
        return this;
      }

      then(callback: (setting: this) => void) {
        callback(this);
        return this;
      }
    }
  }),
  { virtual: true }
);

class MockButtonComponent {
  public buttonEl: TestElement;

  constructor(containerEl: TestElement) {
    this.buttonEl = containerEl.createEl("button");
  }

  setButtonText(text: string) {
    this.buttonEl.setText(text);
    return this;
  }

  setCta() {
    this.buttonEl.addClass("mod-cta");
    return this;
  }

  setDisabled(disabled: boolean) {
    this.buttonEl.disabled = disabled;
    return this;
  }

  onClick(callback: () => void | Promise<void>) {
    this.buttonEl.addEventListener("click", () => {
      void callback();
    });
    return this;
  }
}

class MockDropdownComponent {
  public selectEl: TestElement;

  constructor(containerEl: TestElement) {
    this.selectEl = containerEl.createEl("select");
  }

  addOption(value: string, text: string) {
    this.selectEl.createEl("option", { value, text });
    return this;
  }

  setValue(value: string) {
    this.selectEl.value = value;
    return this;
  }

  onChange(callback: (value: string) => void | Promise<void>) {
    this.selectEl.addEventListener("change", () => {
      void callback(this.selectEl.value);
    });
    return this;
  }
}

class MockTextComponent {
  public inputEl: TestElement;

  constructor(containerEl: TestElement, tag: "input" | "textarea") {
    this.inputEl = containerEl.createEl(tag);
  }

  setPlaceholder(value: string) {
    this.inputEl.placeholder = value;
    return this;
  }

  setValue(value: string) {
    this.inputEl.value = value;
    return this;
  }

  onChange(callback: (value: string) => void | Promise<void>) {
    this.inputEl.addEventListener("change", () => {
      void callback(this.inputEl.value);
    });
    this.inputEl.addEventListener("input", () => {
      void callback(this.inputEl.value);
    });
    return this;
  }
}

class MockToggleComponent {
  public toggleEl: TestElement;

  constructor(containerEl: TestElement) {
    this.toggleEl = containerEl.createEl("input", { type: "checkbox" });
    this.toggleEl.addClass("checkbox-toggle");
  }

  setValue(value: boolean) {
    this.toggleEl.checked = value;
    return this;
  }

  onChange(callback: (value: boolean) => void | Promise<void>) {
    this.toggleEl.addEventListener("change", () => {
      void callback(this.toggleEl.checked);
    });
    return this;
  }
}

class MockExtraButtonComponent {
  public extraSettingsEl: TestElement;

  constructor(containerEl: TestElement) {
    this.extraSettingsEl = containerEl.createEl("button");
  }

  setIcon(icon: string) {
    this.extraSettingsEl.setAttribute("data-icon", icon);
    return this;
  }

  setTooltip(tooltip: string) {
    this.extraSettingsEl.setAttribute("aria-label", tooltip);
    return this;
  }
}

class TestElement {
  public children: TestElement[] = [];
  public attributes = new Map<string, string>();
  public classNames = new Set<string>();
  public eventListeners = new Map<string, Array<() => void>>();
  public value = "";
  public checked = false;
  public disabled = false;
  public placeholder = "";
  public type = "";
  public parent: TestElement | undefined;
  private ownText = "";

  public readonly win = { open: jest.fn() };
  public readonly doc = {
    createDocumentFragment: () => new TestElement("#fragment"),
    createElement: (tagName: string) => new TestElement(tagName)
  };

  constructor(public readonly tagName = "div") {}

  get textContent(): string {
    return `${this.ownText}${this.children.map((child) => child.textContent).join("")}`;
  }

  set textContent(value: string) {
    this.ownText = value;
    this.children = [];
  }

  set className(value: string) {
    this.classNames = new Set(value.split(" ").filter(Boolean));
  }

  get className(): string {
    return Array.from(this.classNames).join(" ");
  }

  setText(text: string) {
    this.ownText = text;
  }

  createDiv(options: { cls?: string; text?: string } = {}): TestElement {
    return this.createEl("div", options);
  }

  createEl(tagName: string, options: { cls?: string; text?: string; value?: string; type?: string; attr?: Record<string, string> } = {}): TestElement {
    const child = new TestElement(tagName);
    child.parent = this;
    if (options.cls) child.addClass(...options.cls.split(" ").filter(Boolean));
    if (options.text) child.setText(options.text);
    if (options.value) child.value = options.value;
    if (options.type) child.type = options.type;
    for (const [name, value] of Object.entries(options.attr ?? {})) {
      child.setAttribute(name, value);
    }
    this.children.push(child);
    return child;
  }

  appendChild(child: TestElement): TestElement {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  append(...nodes: Array<string | TestElement>) {
    for (const node of nodes) {
      if (typeof node === "string") {
        const textNode = new TestElement("#text");
        textNode.setText(node);
        this.appendChild(textNode);
      } else {
        this.appendChild(node);
      }
    }
  }

  empty() {
    this.children = [];
    this.ownText = "";
  }

  addClass(...classes: string[]) {
    for (const cls of classes) this.classNames.add(cls);
  }

  removeClass(...classes: string[]) {
    for (const cls of classes) this.classNames.delete(cls);
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
    if (name === "type") this.type = value;
  }

  setCssProps(props: Record<string, string>) {
    for (const [name, value] of Object.entries(props)) {
      this.attributes.set(name, value);
    }
  }

  addEventListener(eventName: string, callback: () => void) {
    const listeners = this.eventListeners.get(eventName) ?? [];
    listeners.push(callback);
    this.eventListeners.set(eventName, listeners);
  }

  click() {
    for (const callback of this.eventListeners.get("click") ?? []) callback();
  }

  querySelector(selector: string): TestElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector: string): TestElement[] {
    const matches: TestElement[] = [];
    const className = selector.startsWith(".") ? selector.slice(1) : undefined;
    const walk = (element: TestElement) => {
      if (className && element.classNames.has(className)) matches.push(element);
      for (const child of element.children) walk(child);
    };
    walk(this);
    return matches;
  }
}

function createSettingTab(settings = DEFAULT_SETTINGS): TaskHubSettingTab {
  const app = {} as never;
  const plugin = {
    settings: normalizeTaskHubSettings(settings),
    saveSettings: jest.fn(async () => undefined),
    syncDida: jest.fn(async () => undefined),
    syncExternalTasks: jest.fn(async () => undefined),
    syncLocalApple: jest.fn(async () => undefined),
    syncCalendarSource: jest.fn(async () => undefined),
    refreshLocalAppleStatus: jest.fn(async () => undefined),
    requestLocalApplePermissions: jest.fn(async () => undefined),
    isLocalAppleSupported: () => true,
    notifyLocalAppleUnsupported: jest.fn(),
    localAppleStatus: { state: "never" },
    localAppleEvents: [],
    getAppleReminderLists: () => [],
    getDidaProjects: () => [],
    canCreateAppleReminders: () => false,
    canCreateDidaTasks: () => false,
    canSendTasksToAppleCalendar: () => false,
    canConvertAppleCalendarAndReminders: () => false,
    notifyLocalAppleConversionDisabled: jest.fn(),
    confirmRiskySourceDeletionSetting: jest.fn(async () => true),
    confirmRiskyAppleConversionSetting: jest.fn(async () => true),
    refreshOpenViews: jest.fn()
  };
  const tab = new TaskHubSettingTab(app, plugin as never);
  Object.defineProperty(tab, "containerEl", {
    value: new TestElement(),
    configurable: true
  });
  return tab;
}

describe("TaskHubSettingTab", () => {
  it("opens to a focused overview page instead of rendering every integration setting", () => {
    const tab = createSettingTab({
      ...DEFAULT_SETTINGS,
      localApple: { ...DEFAULT_SETTINGS.localApple, enabled: true },
      dida: { ...DEFAULT_SETTINGS.dida, enabled: true }
    });

    tab.display();

    expect((tab.containerEl as unknown as TestElement).classNames.has("task-hub-settings-root")).toBe(true);
    expect(tab.containerEl.querySelector(".task-hub-settings-page-list")).not.toBeNull();
    expect(tab.containerEl.textContent).toContain("Overview");
    expect(tab.containerEl.textContent).toContain("Language");
    expect(tab.containerEl.textContent).not.toContain("Feedback");
    expect(tab.containerEl.textContent).not.toContain("Local Apple");
    expect(tab.containerEl.textContent).not.toContain("API token");
  });

  it("shows the dated notes enable toggle on the overview page", () => {
    const tab = createSettingTab();

    tab.display();

    const notesSetting = Array.from(tab.containerEl.querySelectorAll(".setting-item"))
      .find((setting) => setting.textContent.includes("Notes") && setting.textContent.includes("YAML dates"));
    expect(notesSetting).toBeDefined();
    expect(notesSetting?.querySelector(".checkbox-toggle")).not.toBeNull();
  });

  it("moves feedback into the advanced settings page", () => {
    const tab = createSettingTab();

    tab.display();
    const advancedButton = Array.from(tab.containerEl.querySelectorAll<HTMLButtonElement>(".task-hub-settings-page"))
      .find((button) => button.textContent === "Advanced");
    advancedButton?.click();

    expect(tab.containerEl.textContent).toContain("Feedback");
    expect(tab.containerEl.textContent).toContain("Report bug / suggest");
    expect(tab.containerEl.textContent).toContain("External task sources");
    expect(tab.containerEl.querySelector(".task-hub-advanced-feedback-grid")).not.toBeNull();
    expect(tab.containerEl.querySelector(".task-hub-external-task-window-grid")).not.toBeNull();
    expect(tab.containerEl.querySelector(".task-hub-external-task-window-grid")?.querySelectorAll(".setting-item")).toHaveLength(2);
  });

  it("switches settings pages and renders integration controls on demand", () => {
    const tab = createSettingTab();

    tab.display();
    const integrationsButton = Array.from(tab.containerEl.querySelectorAll<HTMLButtonElement>(".task-hub-settings-page"))
      .find((button) => button.textContent === "Integrations");

    expect(integrationsButton).toBeDefined();
    integrationsButton?.click();

    expect(tab.containerEl.textContent).toContain("Local Apple");
    expect(tab.containerEl.textContent).toContain("Dida integration");
    expect(tab.containerEl.textContent).not.toContain("Supported task syntax");
  });

  it("renders enabled provider child toggles in compact rows", () => {
    const tab = createSettingTab({
      ...DEFAULT_SETTINGS,
      dida: {
        ...DEFAULT_SETTINGS.dida,
        enabled: true,
        tasksEnabled: true,
        apiToken: "token"
      }
    });

    tab.display();
    const integrationsButton = Array.from(tab.containerEl.querySelectorAll<HTMLButtonElement>(".task-hub-settings-page"))
      .find((button) => button.textContent === "Integrations");
    integrationsButton?.click();

    expect(tab.containerEl.querySelector(".task-hub-settings-compact-grid")).not.toBeNull();
    expect(tab.containerEl.querySelector(".task-hub-settings-compact-toggle")).not.toBeNull();
    expect(tab.containerEl.querySelector(".task-hub-dida-writeback-grid")).not.toBeNull();
    expect(tab.containerEl.querySelector(".task-hub-dida-writeback-grid")?.querySelectorAll(".task-hub-settings-compact-toggle")).toHaveLength(4);
    expect(tab.containerEl.textContent).toContain("Edit and complete Dida tasks");
  });

  it("renders Task Notes as a dedicated linear configuration section", () => {
    const tab = createSettingTab({
      ...DEFAULT_SETTINGS,
      taskNotes: {
        ...DEFAULT_SETTINGS.taskNotes,
        enabled: true,
        thinoIntegrationEnabled: true,
        defaultMode: "thino-multi-file"
      }
    });

    tab.display();
    const tasksButton = Array.from(tab.containerEl.querySelectorAll<HTMLButtonElement>(".task-hub-settings-page"))
      .find((button) => button.textContent === "Tasks");
    tasksButton?.click();

    expect(tab.containerEl.textContent).toContain("Task notes");
    expect(tab.containerEl.querySelector(".task-hub-task-notes-master")).not.toBeNull();
    expect(tab.containerEl.querySelector(".task-hub-task-notes-config")).not.toBeNull();
    expect(tab.containerEl.querySelector(".task-hub-task-notes-primary")).not.toBeNull();
    expect(tab.containerEl.querySelector(".task-hub-task-notes-section")).not.toBeNull();
    expect(tab.containerEl.querySelector(".task-hub-task-notes-primary")?.querySelectorAll(".setting-item")).toHaveLength(7);
    expect(tab.containerEl.querySelector(".task-hub-settings-compact-grid")).toBeNull();
    expect(tab.containerEl.querySelector(".task-hub-task-ignored-paths-grid")).not.toBeNull();
    expect(tab.containerEl.textContent).toContain("Task Hub notes folder");
    expect(tab.containerEl.textContent).toContain("Thino notes folder");
    expect(tab.containerEl.textContent).not.toContain("Show note metadata in editor");
  });

  it("renders Local Apple menus and child settings in line-based groups", () => {
    const tab = createSettingTab({
      ...DEFAULT_SETTINGS,
      localApple: {
        ...DEFAULT_SETTINGS.localApple,
        enabled: true,
        calendarEnabled: true,
        remindersEnabled: true,
        calendars: [{ id: "work", name: "Work", color: "#5ECC89", writable: true }]
      }
    });

    tab.display();
    const integrationsButton = Array.from(tab.containerEl.querySelectorAll<HTMLButtonElement>(".task-hub-settings-page"))
      .find((button) => button.textContent === "Integrations");
    integrationsButton?.click();

    expect(tab.containerEl.textContent).toContain("Local Apple");
    expect(tab.containerEl.textContent).toContain("Apple Calendar");
    expect(tab.containerEl.textContent).toContain("Apple Reminders");
    expect(tab.containerEl.querySelector(".task-hub-settings-source-list")).not.toBeNull();
    expect(tab.containerEl.querySelectorAll(".task-hub-settings-grid--joined").length).toBeGreaterThanOrEqual(1);
    expect(tab.containerEl.querySelector(".task-hub-settings-tab-panel")).not.toBeNull();
    expect(tab.containerEl.querySelector(".task-hub-local-apple-color-grid")).not.toBeNull();
    expect(tab.containerEl.textContent).toContain("Reschedule Apple Calendar events");
    expect(tab.containerEl.textContent).toContain("Default timed task duration");
    expect(tab.containerEl.querySelector(".task-hub-settings-compact-toggle")).not.toBeNull();

    const remindersTab = Array.from(tab.containerEl.querySelectorAll<HTMLButtonElement>(".task-hub-settings-tab"))
      .find((button) => button.textContent === "Apple Reminders");
    remindersTab?.click();

    expect(tab.containerEl.textContent).toContain("Write completion status to Apple Reminders");
    expect(tab.containerEl.textContent).toContain("Create Apple Reminders");
    expect(tab.containerEl.querySelector(".task-hub-settings-compact-grid--joined")).not.toBeNull();
  });
});

describe("normalizeTaskHubSettings", () => {
  it("defaults old settings to calendar task creation enabled with a central task file", () => {
    const settings = normalizeTaskHubSettings({
      ignoredPaths: ["Archive/"]
    });

    expect(settings.calendarTaskCreationEnabled).toBe(true);
    expect(settings.showLunarCalendar).toBe(false);
    expect(settings.showSubtaskProgressBars).toBe(true);
    expect(settings.localApple.calendarTaskSendEnabled).toBe(false);
    expect(settings.localApple.calendarDefaultTimedTaskDurationMinutes).toBe(60);
    expect(settings.localApple.reminderDurationOverrides).toEqual({});
    expect(settings.localApple.reminderColorOverrides).toEqual({});
    expect(settings.localApple.remindersCreateTagsEnabled).toBe(true);
    expect(settings.dida).toMatchObject({
      enabled: false,
      tasksEnabled: false,
      tasksColor: "#3b82f6",
      tasksWritebackEnabled: false,
      tasksCreateEnabled: false,
      tasksDragRescheduleEnabled: false,
      tasksDeleteEnabled: false,
      tasksCreateTagsEnabled: true,
      apiBase: "https://api.dida365.com",
      apiToken: "",
      defaultReminderOffsetMinutes: 0
    });
    expect(settings.dida.taskColorOverrides).toEqual({});
    expect(settings.didaTaskLinks).toEqual({});
    expect(settings.externalTaskSourceOrder).toEqual(["apple-calendar", "apple-reminders", "dida"]);
    expect(settings.calendarCreationDefaultKind).toBe("task");
    expect(settings.calendarTaskCreationDefaultTarget).toEqual({ type: "vault" });
    expect(settings.calendarEventCreationDefaultTarget).toEqual({ type: "apple-calendar" });
    expect(settings.calendarTimeScale).toBe("hour");
    expect(settings.calendarDayStartHour).toBe(6);
    expect(settings.calendarDayEndHour).toBe(22);
    expect(settings.taskCreationFilePath).toBe("Task Hub.md");
    expect(settings.taskNotes).toEqual({
      enabled: false,
      notesFolder: "Task Hub Notes",
      defaultMode: "task-hub",
      thinoIntegrationEnabled: false,
      thinoFolder: "Thino",
      openNoteAfterCreate: true,
      showCountsInTaskList: true,
      linkedNoteSubtasksEnabled: false
    });
    expect(settings.taskViewFilters).toEqual({
      status: "open",
      dateBucket: undefined,
      tags: [],
      conditions: undefined,
      tagQuery: "",
      sourceQuery: "",
      textQuery: ""
    });
    expect(settings.taskListManualOrder).toEqual({});
    expect(settings.taskNoteManualOrder).toEqual({});
    expect(settings.taskNotePinned).toEqual({});
    expect(settings.smartLists).toEqual([]);
    expect(settings.vaultTaskStableState).toEqual({});
    expect(settings.externalTaskLookbackDays).toBe(100);
    expect(settings.externalTaskLookaheadDays).toBe(100);
    expect(settings.externalTaskMetadata).toEqual({});
    expect(settings.ignoredPaths).toEqual(["Archive/"]);
  });

  it("normalizes smart lists with filters and stable task references", () => {
    const settings = normalizeTaskHubSettings({
      smartLists: [
        {
          id: "bad id",
          name: "  ",
          filters: { status: "unknown" },
          taskStableIds: ["vault:th_bad123", "", "vault:th_bad123"],
          taskIds: ["task-a", "", "task-a"],
          createdAt: "not a date",
          updatedAt: "2026-06-30T08:00:00.000Z"
        },
        {
          id: "focus-list",
          name: "Focus",
          color: "#6f94b8",
          filters: {
            status: "all",
            tags: ["#work"],
            tagQuery: "#client",
            sourceQuery: "vault",
            textQuery: "proposal",
            conditions: { operator: "or", tag: "#next", dateBucket: "today", text: "call" }
          },
          taskStableIds: ["vault:th_projects12", "apple-reminders:list:item"],
          taskIds: ["task-1", "task-2"],
          excludedTaskStableIds: ["vault:th_hidden", "", "vault:th_hidden"],
          excludedTaskIds: ["task-hidden", "", "task-hidden"],
          createdAt: "2026-06-29T08:00:00.000Z",
          updatedAt: "2026-06-30T08:00:00.000Z"
        }
      ]
    } as never);

    expect(settings.smartLists).toEqual([
        {
          id: "focus-list",
          name: "Focus",
          color: "#6f94b8",
          filters: {
            status: "all",
            dateBucket: undefined,
          tags: ["#work"],
          tagQuery: "#client",
          sourceQuery: "vault",
          textQuery: "proposal",
          conditions: { operator: "or", tag: "#next", dateBucket: "today", text: "call" }
        },
        taskStableIds: ["vault:th_projects12", "apple-reminders:list:item"],
        taskIds: ["task-1", "task-2"],
        excludedTaskStableIds: ["vault:th_hidden"],
        excludedTaskIds: ["task-hidden"],
        createdAt: "2026-06-29T08:00:00.000Z",
        updatedAt: "2026-06-30T08:00:00.000Z"
      }
    ]);
  });

  it("normalizes external task window and metadata records", () => {
    const settings = normalizeTaskHubSettings({
      externalTaskLookbackDays: 365.9,
      externalTaskLookaheadDays: -10,
      externalTaskMetadata: {
        "apple-reminders:good": {
          startDate: "2026-06-01",
          lastSeenAt: "2026-06-29T10:00:00.000Z"
        },
        "apple-reminders:bad-date": {
          startDate: "06-01-2026",
          lastSeenAt: "not-a-date"
        },
        invalid: {
          startDate: "2026-06-01"
        }
      }
    });

    expect(settings.externalTaskLookbackDays).toBe(365);
    expect(settings.externalTaskLookaheadDays).toBe(0);
    expect(settings.externalTaskMetadata).toEqual({
      "apple-reminders:good": {
        startDate: "2026-06-01",
        lastSeenAt: "2026-06-29T10:00:00.000Z"
      }
    });
  });

  it("normalizes external task source tab order", () => {
    const settings = normalizeTaskHubSettings({
      externalTaskSourceOrder: ["dida", "apple-reminders", "unknown"] as never
    });

    expect(settings.externalTaskSourceOrder).toEqual(["dida", "apple-reminders", "apple-calendar"]);
  });

  it("keeps the default timed task duration within the five-minute minimum", () => {
    expect(normalizeTaskHubSettings({
      localApple: {
        ...normalizeTaskHubSettings(null).localApple,
        calendarDefaultTimedTaskDurationMinutes: 5
      }
    }).localApple.calendarDefaultTimedTaskDurationMinutes).toBe(5);

    expect(normalizeTaskHubSettings({
      localApple: {
        ...normalizeTaskHubSettings(null).localApple,
        calendarDefaultTimedTaskDurationMinutes: 1
      }
    }).localApple.calendarDefaultTimedTaskDurationMinutes).toBe(5);
  });

  it("preserves supported interface languages and falls back from unknown stored values", () => {
    expect(normalizeTaskHubSettings({ language: "ja" }).language).toBe("ja");
    expect(normalizeTaskHubSettings({ language: "fr" }).language).toBe("fr");
    expect(normalizeTaskHubSettings({ language: "ko" }).language).toBe("ko");
    expect(normalizeTaskHubSettings({ language: "de" as never }).language).toBe("en");
  });

  it("migrates cached Dida inbox project names to 收集箱", () => {
    const settings = normalizeTaskHubSettings({
      dida: {
        ...normalizeTaskHubSettings(null).dida,
        projects: [
          { id: "inbox1014354416", name: "未在清单中" },
          { id: "project-1", name: "采购清单" }
        ]
      }
    });

    expect(settings.dida.projects).toEqual([
      { id: "inbox1014354416", name: "收集箱" },
      { id: "project-1", name: "采购清单" }
    ]);
  });

  it("normalizes invalid calendar time scale and visible hour settings", () => {
    const settings = normalizeTaskHubSettings({
      calendarTimeScale: "wide" as never,
      calendarDayStartHour: 25,
      calendarDayEndHour: 4
    });

    expect(settings.calendarTimeScale).toBe("hour");
    expect(settings.calendarDayStartHour).toBe(6);
    expect(settings.calendarDayEndHour).toBe(22);
  });

  it("persists task view filters across settings normalization", () => {
    const settings = normalizeTaskHubSettings({
      taskViewFilters: {
        status: "all",
        tags: ["#work"],
        tagQuery: "#focus",
        sourceQuery: "apple-reminders",
        textQuery: "invoice",
        conditions: {
          operator: "or",
          tag: "#client",
          dateBucket: "today",
          text: "call"
        }
      }
    });

    expect(settings.taskViewFilters).toEqual({
      status: "all",
      tags: ["#work"],
      tagQuery: "#focus",
      sourceQuery: "apple-reminders",
      textQuery: "invoice",
      conditions: {
        operator: "or",
        tag: "#client",
        dateBucket: "today",
        text: "call"
      }
    });
  });

  it("restores the last Task Hub session state when present", () => {
    const settings = normalizeTaskHubSettings({
      defaultView: "tags",
      taskViewFilters: {
        status: "open",
        tags: [],
        tagQuery: "",
        sourceQuery: "",
        textQuery: ""
      },
      lastSessionState: {
        view: "calendar",
        taskViewFilters: {
          status: "all",
          tags: ["#work"],
          tagQuery: "#focus",
          sourceQuery: "apple-reminders",
          textQuery: "invoice"
        },
        calendarMode: "week",
        calendarFocusDate: "2026-06-26T10:00:00.000Z",
        visibleSourceIds: ["vault", "apple-reminders"],
        unscheduledPanelOpen: true
      }
    });

    expect(settings.lastSessionState).toEqual({
      view: "calendar",
      taskViewFilters: {
        status: "all",
        tags: ["#work"],
        tagQuery: "#focus",
        dateBucket: undefined,
        conditions: undefined,
        sourceQuery: "apple-reminders",
        textQuery: "invoice"
      },
      calendarMode: "week",
      calendarFocusDate: "2026-06-26T10:00:00.000Z",
      visibleSourceIds: ["vault", "apple-reminders"],
      unscheduledPanelOpen: true
    });
  });

  it("falls back to safe defaults for invalid persisted Task Hub session state", () => {
    const settings = normalizeTaskHubSettings({
      defaultView: "tags",
      taskViewFilters: {
        status: "open",
        tags: ["#fallback"],
        tagQuery: "",
        sourceQuery: "",
        textQuery: ""
      },
      lastSessionState: {
        view: "board" as never,
        taskViewFilters: {
          status: "maybe" as never,
          tags: "#oops" as never,
          sourceQuery: 42 as never,
          textQuery: undefined as never
        },
        calendarMode: "year" as never,
        calendarFocusDate: "not-a-date",
        visibleSourceIds: [],
        unscheduledPanelOpen: "yes" as never
      }
    });

    expect(settings.lastSessionState).toEqual({
      view: "tags",
      taskViewFilters: {
        status: "open",
        dateBucket: undefined,
        tags: [],
        conditions: undefined,
        tagQuery: "",
        sourceQuery: "",
        textQuery: ""
      },
      calendarMode: "month",
      visibleSourceIds: ["vault"],
      unscheduledPanelOpen: false
    });
  });

  it("keeps explicit subtask progress bar settings while defaulting older settings to enabled", () => {
    expect(normalizeTaskHubSettings({ ignoredPaths: [] }).showSubtaskProgressBars).toBe(true);
    expect(normalizeTaskHubSettings({ showSubtaskProgressBars: false }).showSubtaskProgressBars).toBe(false);
  });

  it("normalizes task manual ordering and vault stable records", () => {
    const settings = normalizeTaskHubSettings({
      taskListManualOrder: {
        "2026-05-08": ["vault:th_a", "vault:th_a", "bad stable id"],
        invalid: ["vault:th_b"]
      },
      taskNoteManualOrder: {
        "task:vault:th_parent": ["note-1", "note-1", "", 42 as never],
        "": ["note-2"],
        "task:vault:th_other": []
      } as never,
      taskNotePinned: {
        "task:vault:th_parent": ["note-2", "note-2", "", 7 as never],
        "": ["note-3"],
        "task:vault:th_empty": []
      } as never,
      vaultTaskStableState: {
        "Project.md": [
          {
            stableId: "vault:th_a",
            currentId: "Project.md:1:abc",
            text: "Task A",
            line: 4.8,
            tags: ["#a", "#a"],
            completed: false
          },
          {
            stableId: "broken",
            currentId: 42,
            text: "Task B",
            line: 1,
            tags: [],
            completed: false
          }
        ]
      } as never
    });

    expect(settings.taskListManualOrder).toEqual({
      "2026-05-08": ["vault:th_a"]
    });
    expect(settings.taskNoteManualOrder).toEqual({
      "task:vault:th_parent": ["note-1"]
    });
    expect(settings.taskNotePinned).toEqual({
      "task:vault:th_parent": ["note-2"]
    });
    expect(settings.vaultTaskStableState).toEqual({
      "Project.md": [
        {
          stableId: "vault:th_a",
          currentId: "Project.md:1:abc",
          text: "Task A",
          line: 4,
          heading: undefined,
          indent: undefined,
          dueDate: undefined,
          scheduledDate: undefined,
          tags: ["#a"],
          completed: false
        }
      ]
    });
  });

  it("migrates the previous completed date bucket to other completed", () => {
    const settings = normalizeTaskHubSettings({
      taskViewFilters: {
        status: "all",
        dateBucket: "completed" as never,
        tags: [],
        sourceQuery: "",
        textQuery: "",
        conditions: {
          operator: "and",
          tag: "",
          dateBucket: "completed" as never,
          text: ""
        }
      }
    });

    expect(settings.taskViewFilters.dateBucket).toBe("otherCompleted");
    expect(settings.taskViewFilters.conditions?.dateBucket).toBe("otherCompleted");
  });

  it("keeps tomorrow as a persisted task date filter", () => {
    const settings = normalizeTaskHubSettings({
      taskViewFilters: {
        status: "open",
        dateBucket: "tomorrow",
        tags: [],
        sourceQuery: "",
        textQuery: ""
      }
    });

    expect(settings.taskViewFilters.dateBucket).toBe("tomorrow");
  });

  it("persists quick tag query filters across settings normalization", () => {
    const settings = normalizeTaskHubSettings({
      taskViewFilters: {
        status: "open",
        tags: [],
        tagQuery: "#focus",
        sourceQuery: "",
        textQuery: ""
      }
    });

    expect(settings.taskViewFilters.tagQuery).toBe("#focus");
  });

  it("migrates the old Apple Reminder tag creation default to enabled", () => {
    const settings = normalizeTaskHubSettings({
      localApple: {
        ...normalizeTaskHubSettings(null).localApple,
        remindersCreateTagsEnabled: false
      }
    });

    expect(settings.localApple.remindersCreateTagsEnabled).toBe(true);
  });

  it("preserves Apple Reminder tag creation when explicitly disabled after the migration", () => {
    const settings = normalizeTaskHubSettings({
      settingsSchemaVersion: TASK_HUB_SETTINGS_SCHEMA_VERSION,
      localApple: {
        ...normalizeTaskHubSettings(null).localApple,
        remindersCreateTagsEnabled: false
      }
    });

    expect(settings.localApple.remindersCreateTagsEnabled).toBe(false);
  });

  it("keeps Apple Calendar task sending behind its own explicit setting", () => {
    const settings = normalizeTaskHubSettings({
      localApple: {
        ...normalizeTaskHubSettings(null).localApple,
        enabled: true,
        calendarEnabled: true,
        calendarWritebackEnabled: true,
        calendarTaskSendEnabled: true
      }
    });

    expect(settings.localApple.calendarWritebackEnabled).toBe(true);
    expect(settings.localApple.calendarTaskSendEnabled).toBe(true);
  });

  it("round-trips Apple Reminders calendar task creation targets", () => {
    const target = parseTaskCreationTarget("apple-reminders:list-1");

    expect(target).toEqual({ type: "apple-reminders", listId: "list-1" });
    expect(serializeTaskCreationTarget(target)).toBe("apple-reminders:list-1");
  });

  it("round-trips Dida calendar task creation targets", () => {
    const target = parseTaskCreationTarget("dida:project-1");

    expect(target).toEqual({ type: "dida", projectId: "project-1" });
    expect(serializeTaskCreationTarget(target)).toBe("dida:project-1");
  });

  it("round-trips Apple Calendar event creation targets", () => {
    const target = parseEventCreationTarget("apple-calendar:work");

    expect(target).toEqual({ type: "apple-calendar", calendarId: "work" });
    expect(serializeEventCreationTarget(target)).toBe("apple-calendar:work");
  });

  it("keeps Apple Calendar calendars out of task creation targets", () => {
    const options: Array<{ value: string; text: string }> = [];
    const selectEl = {
      empty: jest.fn(() => {
        options.length = 0;
      }),
      createEl: jest.fn((_tag: string, option: { value: string; text: string }) => {
        options.push(option);
      })
    } as unknown as HTMLSelectElement;
    const plugin = {
      canCreateAppleReminders: () => true,
      canCreateDidaTasks: () => true,
      canSendTasksToAppleCalendar: () => true,
      getAppleReminderLists: () => [{ id: "reminders", name: "Reminders" }],
      getDidaProjects: () => [{ id: "dida-project", name: "Task Hub Test" }],
      getAppleCalendars: () => [{ id: "work", name: "Work", writable: true }]
    };

    populateTaskCreationTargetDropdown(selectEl, plugin as never, (key) => key);

    expect(options).toEqual([
      { value: "vault", text: "vaultTasks" },
      { value: "apple-reminders:reminders", text: "localAppleReminders: Reminders" },
      { value: "dida:dida-project", text: "dida: Task Hub Test" }
    ]);
  });

  it("does not add a synthetic Dida inbox task target when no projects are loaded", () => {
    const options: Array<{ value: string; text: string }> = [];
    const selectEl = {
      empty: jest.fn(() => {
        options.length = 0;
      }),
      createEl: jest.fn((_tag: string, option: { value: string; text: string }) => {
        options.push(option);
      })
    } as unknown as HTMLSelectElement;
    const plugin = {
      canCreateAppleReminders: () => false,
      canCreateDidaTasks: () => true,
      getAppleReminderLists: () => [],
      getDidaProjects: () => []
    };

    populateTaskCreationTargetDropdown(selectEl, plugin as never, (key) => key);

    expect(options).toEqual([{ value: "vault", text: "vaultTasks" }]);
  });

  it("adds only writable Apple Calendar calendars to the event creation target dropdown", () => {
    const options: Array<{ value: string; text: string }> = [];
    const selectEl = {
      empty: jest.fn(() => {
        options.length = 0;
      }),
      createEl: jest.fn((_tag: string, option: { value: string; text: string }) => {
        options.push(option);
      })
    } as unknown as HTMLSelectElement;
    const plugin = {
      canCreateAppleReminders: () => false,
      canSendTasksToAppleCalendar: () => true,
      getAppleCalendars: () => [
        { id: "work", name: "Work", writable: true },
        { id: "birthdays", name: "Birthdays", writable: false },
        { id: "cn-holidays", name: "中国大陆节假日", writable: false }
      ]
    };

    populateEventCreationTargetDropdown(selectEl, plugin as never, (key) => key);

    expect(options).toEqual([
      { value: "apple-calendar:work", text: "localAppleCalendar: Work" }
    ]);
  });

  it("opens the Task Hub feedback issue page", () => {
    const openUrl = jest.fn();

    openTaskHubFeedback(openUrl);

    expect(openUrl).toHaveBeenCalledWith("https://github.com/saralaaga/task-hub/issues/new");
  });
});

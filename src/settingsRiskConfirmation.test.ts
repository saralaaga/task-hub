import { TaskHubSettingTab } from "./settings";
import { DEFAULT_SETTINGS } from "./settings";

type ToggleControl = {
  value: boolean;
  onChangeHandler?: (value: boolean) => Promise<void> | void;
  setValue(value: boolean): ToggleControl;
  onChange(handler: (value: boolean) => Promise<void> | void): ToggleControl;
};

type TextControl = {
  value: string;
  placeholder?: string;
  onChangeHandler?: (value: string) => Promise<void> | void;
  setValue(value: string): TextControl;
  setPlaceholder(value: string): TextControl;
  onChange(handler: (value: string) => Promise<void> | void): TextControl;
};

const toggles: ToggleControl[] = [];
const swatchClicks: Array<() => void> = [];
const colorInputs: MockElement[] = [];
const settings: Array<{ name?: string; desc?: string; toggle?: ToggleControl; text?: TextControl; controlEl?: MockElement }> = [];
const mockDocument = {
  createDocumentFragment: () => ({
    append: jest.fn()
  }),
  createElement: () => ({
    className: "",
    textContent: "",
    setAttribute: jest.fn()
  })
};

class MockElement {
  children: MockElement[] = [];
  scrollTop = 0;
  className = "";
  textContent = "";
  type = "";
  value = "";
  style = { setProperty: jest.fn() };
  private listeners = new Map<string, Array<() => void>>();

  get doc(): Document {
    return mockDocument as unknown as Document;
  }

  setCssProps(props: Record<string, string>): void {
    for (const [name, value] of Object.entries(props)) {
      this.style.setProperty(name, value);
    }
  }

  empty = jest.fn(() => {
    this.children = [];
    this.scrollTop = 0;
  });

  createDiv(options: { cls?: string } = {}): MockElement {
    const child = new MockElement();
    child.className = options.cls ?? "";
    this.children.push(child);
    return child;
  }

  createEl(_tag: string, options: { cls?: string; type?: string } = {}): MockElement {
    const child = this.createDiv({ cls: options.cls });
    child.type = options.type ?? _tag;
    if (child.type === "color") {
      colorInputs.push(child);
    }
    return child;
  }

  addEventListener(name: string, listener: () => void): void {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener]);
    if (this.className.includes("task-hub-color-swatch") && name === "click") {
      swatchClicks.push(listener);
    }
  }

  dispatch(name: string): void {
    for (const listener of this.listeners.get(name) ?? []) {
      listener();
    }
  }

  addClass(cls: string): void {
    this.className = `${this.className} ${cls}`.trim();
  }

  setAttribute(): void {}
}

type MockSettingInstance = {
  name?: string;
  desc?: string;
  toggle?: ToggleControl;
  text?: TextControl;
};

jest.mock(
  "obsidian",
  () => ({
    App: class {},
    PluginSettingTab: class {
      containerEl = new MockElement();
      constructor(
        public app: unknown,
        public plugin: unknown
      ) {}
    },
    Setting: class {
      name?: string;
      desc?: string;
      controlEl = new MockElement();
      constructor() {
        settings.push(this);
      }
      setName(name: string) {
        this.name = name;
        return this;
      }
      setDesc(desc: string) {
        this.desc = desc;
        return this;
      }
      setHeading() {
        return this;
      }
      addDropdown() {
        return this;
      }
      addText(build?: (text: TextControl) => void) {
        const text: TextControl = {
          value: "",
          setValue(value: string) {
            this.value = value;
            return this;
          },
          setPlaceholder(value: string) {
            this.placeholder = value;
            return this;
          },
          onChange(handler) {
            this.onChangeHandler = handler;
            return this;
          }
        };
        (this as MockSettingInstance).text = text;
        build?.(text);
        return this;
      }
      addTextArea() {
        return this;
      }
      addButton() {
        return this;
      }
      addExtraButton() {
        arguments[0]?.({
          extraSettingsEl: new MockElement(),
          setIcon() {
            return this;
          },
          setTooltip() {
            return this;
          }
        });
        return this;
      }
      addToggle(build: (toggle: ToggleControl) => void) {
        const toggle: ToggleControl = {
          value: false,
          setValue(value: boolean) {
            this.value = value;
            return this;
          },
          onChange(handler) {
            this.onChangeHandler = handler;
            return this;
          }
        };
        toggles.push(toggle);
        (this as MockSettingInstance).toggle = toggle;
        build(toggle);
        return this;
      }
      then(build?: (setting: { controlEl: MockElement }) => void) {
        build?.({ controlEl: this.controlEl });
        return this;
      }
    }
  }),
  { virtual: true }
);

describe("TaskHubSettingTab risky Apple Reminders setting", () => {
  beforeEach(() => {
    toggles.length = 0;
    swatchClicks.length = 0;
    colorInputs.length = 0;
    settings.length = 0;
    Object.assign(globalThis, { document: mockDocument });
  });

  it("requires confirmation before enabling Apple Reminders migration", async () => {
    const plugin = pluginForSettings();
    const tab = new TaskHubSettingTab({} as never, plugin as never);

    plugin.confirmRiskySourceDeletionSetting = jest.fn(async () => false);
    tab.display();
    const settingIndex = settings.findIndex((setting) => setting.name === "Create Apple Reminders from vault tasks");
    const toggle = settings[settingIndex].toggle!;

    await toggle.onChangeHandler?.(true);

    expect(plugin.confirmRiskySourceDeletionSetting).toHaveBeenCalled();
    expect(plugin.settings.localApple.remindersCreateEnabled).toBe(false);
    expect(plugin.saveSettings).not.toHaveBeenCalled();

    plugin.confirmRiskySourceDeletionSetting = jest.fn(async () => true);
    await toggle.onChangeHandler?.(true);

    expect(plugin.settings.localApple.remindersCreateEnabled).toBe(true);
    expect(plugin.saveSettings).toHaveBeenCalled();
  });

  it("requires confirmation before enabling Apple Calendar task sending", async () => {
    const plugin = pluginForSettings();
    plugin.settings.localApple.calendarEnabled = true;
    const tab = new TaskHubSettingTab({} as never, plugin as never);

    plugin.confirmRiskySourceDeletionSetting = jest.fn(async () => false);
    tab.display();
    const settingIndex = settings.findIndex((setting) => setting.name === "Send tasks to Apple Calendar");
    const toggle = settings[settingIndex].toggle!;

    await toggle.onChangeHandler?.(true);

    expect(plugin.confirmRiskySourceDeletionSetting).toHaveBeenCalled();
    expect(plugin.settings.localApple.calendarTaskSendEnabled).toBe(false);
    expect(plugin.saveSettings).not.toHaveBeenCalled();

    plugin.confirmRiskySourceDeletionSetting = jest.fn(async () => true);
    await toggle.onChangeHandler?.(true);

    expect(plugin.settings.localApple.calendarTaskSendEnabled).toBe(true);
    expect(plugin.saveSettings).toHaveBeenCalled();
  });

  it("blocks Local Apple setup toggles on unsupported systems", async () => {
    const plugin = pluginForSettings();
    plugin.settings.localApple.enabled = false;
    plugin.isLocalAppleSupported = jest.fn(() => false);
    const tab = new TaskHubSettingTab({} as never, plugin as never);

    tab.display();
    await findToggle("Local Apple")?.onChangeHandler?.(true);

    expect(plugin.notifyLocalAppleUnsupported).toHaveBeenCalled();
    expect(plugin.settings.localApple.enabled).toBe(false);
    expect(plugin.saveSettings).not.toHaveBeenCalled();

    plugin.settings.localApple.enabled = true;
    plugin.settings.localApple.remindersEnabled = false;
    settings.length = 0;
    tab.display();
    await findToggle("Apple Calendar")?.onChangeHandler?.(true);
    await findToggle("Apple Reminders")?.onChangeHandler?.(true);

    expect(plugin.settings.localApple.calendarEnabled).toBe(false);
    expect(plugin.settings.localApple.remindersEnabled).toBe(false);
    expect(plugin.notifyLocalAppleUnsupported).toHaveBeenCalledTimes(3);
    expect(plugin.saveSettings).not.toHaveBeenCalled();
  });

  it("blocks Local Apple write and send toggles on unsupported systems", async () => {
    const plugin = pluginForSettings();
    plugin.isLocalAppleSupported = jest.fn(() => false);
    plugin.settings.localApple.calendarEnabled = true;
    plugin.settings.localApple.remindersEnabled = true;
    const tab = new TaskHubSettingTab({} as never, plugin as never);

    (tab as unknown as { externalTaskSourceTab: "apple-calendar" }).externalTaskSourceTab = "apple-calendar";
    tab.display();
    const calendarWriteback = findToggle("Reschedule Apple Calendar events");
    expect(calendarWriteback).toBeDefined();
    await calendarWriteback?.onChangeHandler?.(true);
    settings.length = 0;
    tab.display();
    const calendarSend = findToggle("Send tasks to Apple Calendar");
    expect(calendarSend).toBeDefined();
    await calendarSend?.onChangeHandler?.(true);

    (tab as unknown as { externalTaskSourceTab: "apple-reminders" }).externalTaskSourceTab = "apple-reminders";
    settings.length = 0;
    tab.display();
    const remindersWriteback = findToggle("Write completion status to Apple Reminders");
    expect(remindersWriteback).toBeDefined();
    await remindersWriteback?.onChangeHandler?.(true);
    settings.length = 0;
    tab.display();
    const remindersCreate = findToggle("Create Apple Reminders from vault tasks");
    expect(remindersCreate).toBeDefined();
    await remindersCreate?.onChangeHandler?.(true);

    expect(plugin.settings.localApple.calendarWritebackEnabled).toBe(false);
    expect(plugin.settings.localApple.calendarTaskSendEnabled).toBe(false);
    expect(plugin.settings.localApple.remindersWritebackEnabled).toBe(false);
    expect(plugin.settings.localApple.remindersCreateEnabled).toBe(false);
    expect(plugin.confirmRiskySourceDeletionSetting).not.toHaveBeenCalled();
    expect(plugin.notifyLocalAppleUnsupported).toHaveBeenCalledTimes(4);
    expect(plugin.saveSettings).not.toHaveBeenCalled();
  });

  it("resyncs Apple Calendar after changing the lookahead window", async () => {
    const plugin = pluginForSettings();
    plugin.settings.localApple.calendarEnabled = true;
    const tab = new TaskHubSettingTab({} as never, plugin as never);

    tab.display();
    const lookahead = settings.find((setting) => setting.name === "Calendar lookahead days")?.text;
    expect(lookahead).toBeDefined();

    await lookahead?.onChangeHandler?.("360");

    expect(plugin.settings.localApple.calendarLookaheadDays).toBe(360);
    expect(plugin.saveSettings).toHaveBeenCalled();
    expect(plugin.syncLocalApple).toHaveBeenCalledWith({ silent: true });
  });

  it("resyncs external task sources after changing the external task lookahead window", async () => {
    const plugin = pluginForSettings();
    const tab = new TaskHubSettingTab({} as never, plugin as never);

    tab.display();
    const lookahead = settings.find((setting) => setting.name === "External task lookahead days")?.text;
    expect(lookahead).toBeDefined();

    await lookahead?.onChangeHandler?.("180");

    expect(plugin.settings.externalTaskLookaheadDays).toBe(180);
    expect(plugin.saveSettings).toHaveBeenCalled();
    expect(plugin.syncExternalTasks).toHaveBeenCalledWith({ silent: true });
  });

  it("preserves the settings scroll position after choosing an Apple Calendar color swatch", async () => {
    const plugin = pluginForSettings();
    plugin.settings.localApple.calendarEnabled = true;
    plugin.settings.localApple.calendars = [{ id: "work", name: "Work", color: "#5ECC89", writable: true }];
    const tab = new TaskHubSettingTab({} as never, plugin as never);
    const container = (tab as unknown as { containerEl: MockElement }).containerEl;

    tab.display();
    container.scrollTop = 480;
    expect(swatchClicks.length).toBeGreaterThan(0);

    swatchClicks[0]();
    await Promise.resolve();
    await Promise.resolve();

    expect(plugin.saveSettings).toHaveBeenCalled();
    expect(container.scrollTop).toBe(480);
  });

  it("opens a native color input from the Apple Calendar color preview", async () => {
    const plugin = pluginForSettings();
    plugin.settings.localApple.calendarEnabled = true;
    plugin.settings.localApple.calendars = [{ id: "work", name: "Work", color: "#5ECC89", writable: true }];
    const tab = new TaskHubSettingTab({} as never, plugin as never);

    tab.display();
    const colorInput = colorInputs[0];
    expect(colorInput).toBeDefined();

    colorInput.value = "#123456";
    colorInput.dispatch("input");
    await Promise.resolve();

    expect(plugin.settings.localApple.calendarColorOverrides.work).toBe("#123456");
    expect(plugin.saveSettings).toHaveBeenCalled();
  });

  it("opens a native color input from an Apple Reminders list color preview", async () => {
    const plugin = pluginForSettings();
    plugin.settings.localApple.remindersEnabled = true;
    (plugin as unknown as { getAppleReminderLists: () => Array<{ id: string; name: string }> }).getAppleReminderLists = () => [
      { id: "personal", name: "Personal" }
    ];
    const tab = new TaskHubSettingTab({} as never, plugin as never);

    tab.display();
    const colorInput = colorInputs.at(-1);
    expect(colorInput).toBeDefined();

    colorInput!.value = "#654321";
    colorInput!.dispatch("input");
    await Promise.resolve();

    expect(plugin.settings.localApple.reminderColorOverrides.personal).toBe("#654321");
    expect(plugin.saveSettings).toHaveBeenCalled();
  });
});

function findToggle(name: string): ToggleControl | undefined {
  return settings.find((setting) => setting.name === name && setting.toggle)?.toggle;
}

function pluginForSettings() {
  return {
    settings: {
      ...DEFAULT_SETTINGS,
      language: "en" as const,
      localApple: {
        ...DEFAULT_SETTINGS.localApple,
        enabled: true,
        remindersEnabled: true
      }
    },
    localAppleStatus: { state: "never" as const },
    getAppleReminderLists: () => [],
    saveSettings: jest.fn(async () => undefined),
    syncLocalApple: jest.fn(async () => undefined),
    syncExternalTasks: jest.fn(async () => undefined),
    refreshLocalAppleStatus: jest.fn(async () => undefined),
    requestLocalApplePermissions: jest.fn(async () => undefined),
    confirmRiskySourceDeletionSetting: jest.fn(async () => false),
    isLocalAppleSupported: jest.fn(() => true),
    notifyLocalAppleUnsupported: jest.fn()
  };
}

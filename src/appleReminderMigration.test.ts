import TaskHubPlugin from "./main";
import { MarkdownView, WorkspaceLeaf } from "obsidian";
import { DEFAULT_SETTINGS } from "./settings";
import { buildTaskNoteKey, createTaskNoteContent, parseTaskNoteFrontmatter } from "./taskNotes";
import type { TaskItem } from "./types";

const notices: string[] = [];
const savedData: unknown[] = [];

type FakeElement = {
  addClass: jest.Mock;
  addEventListener: jest.Mock;
  appendChild: jest.Mock;
  createDiv: jest.Mock<FakeElement, []>;
  createEl: jest.Mock;
  createSpan: jest.Mock<FakeElement, [{ text?: string }?]>;
  empty: jest.Mock;
  focus: jest.Mock;
  setText: jest.Mock;
  setAttr: jest.Mock;
  toggleClass: jest.Mock;
  value?: string;
  checked?: boolean;
  disabled?: boolean;
  type?: string;
  children: FakeElement[];
};

type FakeButton = {
  onClickHandler?: () => void;
  setButtonText: jest.Mock;
  setCta: jest.Mock;
  onClick: jest.Mock;
};

const buttons: FakeButton[] = [];
const modals: Array<{ contentEl: FakeElement; titleEl: FakeElement; modalEl: FakeElement }> = [];

function fakeEl(): FakeElement {
  const element: FakeElement = {
    addClass: jest.fn(),
    addEventListener: jest.fn((name: string, handler: () => void) => {
      listeners.push({ element, name, handler });
    }),
    appendChild: jest.fn(),
    children: [],
    createDiv: jest.fn(() => {
      const child = fakeEl();
      element.children.push(child);
      return child;
    }),
    createEl: jest.fn((tag: string, options: { type?: string; value?: string } = {}) => {
      const child = fakeEl();
      child.type = options.type ?? tag;
      child.value = options.value ?? "";
      element.children.push(child);
      return child;
    }),
    createSpan: jest.fn((options: { text?: string } = {}) => {
      const child = fakeEl();
      child.type = "span";
      child.value = options.text ?? "";
      element.children.push(child);
      return child;
    }),
    empty: jest.fn(),
    focus: jest.fn(),
    setAttr: jest.fn(),
    setText: jest.fn(),
    toggleClass: jest.fn()
  };
  return element;
}

const listeners: Array<{ element: FakeElement; name: string; handler: () => void }> = [];

function collectElements(element: FakeElement): FakeElement[] {
  return [element, ...element.children.flatMap(collectElements)];
}

function dispatchFake(element: FakeElement, name: string): void {
  for (const listener of listeners.filter((candidate) => candidate.element === element && candidate.name === name)) {
    listener.handler();
  }
}

function flushAsync(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

jest.mock(
  "obsidian",
  () => {
    class MockButtonComponent {
      onClickHandler?: () => void;
      setDisabled = jest.fn(() => this);
      setButtonText = jest.fn(() => this);
      setCta = jest.fn(() => this);
      onClick = jest.fn((handler: () => void) => {
        this.onClickHandler = handler;
        return this;
      });

      constructor() {
        buttons.push(this as FakeButton);
      }
    }

    return {
    ButtonComponent: MockButtonComponent,
    AbstractInputSuggest: class {
      constructor() {}
      close() {}
    },
    Editor: class {},
    ItemView: class {},
    MarkdownView: class {},
    Menu: class {},
    Modal: class {
      app: unknown;
      modalEl = fakeEl();
      titleEl = fakeEl();
      contentEl = fakeEl();

      constructor(app: unknown) {
        this.app = app;
        modals.push(this);
      }

      open() {
        void (this as { onOpen?: () => void | Promise<void> }).onOpen?.();
      }

      close() {
        void (this as { onClose?: () => void | Promise<void> }).onClose?.();
      }
    },
    Notice: class {
      constructor(message: string) {
        notices.push(message);
      }
    },
    Platform: { isDesktopApp: true },
    PluginSettingTab: class {},
    Plugin: class {
      app: unknown;
      manifest = { id: "task-hub", dir: ".obsidian/plugins/task-hub" };
      async loadData() {
        return null;
      }
      async saveData(data: unknown) {
        savedData.push(data);
      }
      addCommand() {}
      addRibbonIcon() {}
      addSettingTab() {}
      registerEvent() {}
      registerView() {}
    },
    requestUrl: jest.fn(),
    getAllTags: jest.fn(() => []),
    parseFrontMatterTags: jest.fn(() => []),
    Setting: class {
      settingEl = fakeEl();
      controlEl = fakeEl();
      infoEl = fakeEl();

      constructor(parent?: FakeElement) {
        parent?.children.push(this.settingEl);
        this.settingEl.children.push(this.infoEl, this.controlEl);
      }

      setName() {
        return this;
      }

      setDesc() {
        return this;
      }

      addDropdown(build?: (dropdown: { selectEl: FakeElement; setValue(value: string): { onChange(handler: (value: string) => void): unknown } }) => void) {
        const selectEl = fakeEl();
        selectEl.type = "select";
        this.controlEl.children.push(selectEl);
        build?.({
          selectEl,
          setValue(value: string) {
            selectEl.value = value;
            return {
              onChange(handler: (value: string) => void) {
                selectEl.addEventListener("change", () => handler(selectEl.value ?? ""));
                return this;
              }
            };
          }
        });
        return this;
      }

      addText(build?: (text: { inputEl: FakeElement; setPlaceholder(value: string): unknown; setValue(value: string): { onChange(handler: (value: string) => void): unknown } }) => void) {
        const inputEl = fakeEl();
        inputEl.type = "text";
        this.controlEl.children.push(inputEl);
        build?.({
          inputEl,
          setPlaceholder() {
            return this;
          },
          setValue(value: string) {
            inputEl.value = value;
            return {
              onChange(handler: (value: string) => void) {
                inputEl.addEventListener("input", () => handler(inputEl.value ?? ""));
                return this;
              }
            };
          }
        });
        return this;
      }

      addTextArea(build?: (text: { setValue(value: string): { onChange(handler: (value: string) => void): unknown } }) => void) {
        const inputEl = fakeEl();
        inputEl.type = "textarea";
        this.controlEl.children.push(inputEl);
        build?.({
          setValue(value: string) {
            inputEl.value = value;
            return {
              onChange(handler: (value: string) => void) {
                inputEl.addEventListener("input", () => handler(inputEl.value ?? ""));
                return this;
              }
            };
          }
        });
        return this;
      }

      addButton(build?: (button: FakeButton) => void) {
        const button = new MockButtonComponent() as FakeButton;
        build?.(button);
        return this;
      }
    },
    TFile: class {},
    WorkspaceLeaf: class {
      containerEl = { tag: "workspace-leaf" };
      view: unknown;
      static instances: Array<unknown> = [];

      constructor() {
        (this.constructor as unknown as { instances: Array<unknown> }).instances.push(this);
      }

      setViewState = jest.fn(async () => {
        this.view = Object.assign(new MarkdownView({} as never), {
          getEphemeralState: jest.fn(() => ({ existing: true, properties: { collapsed: false } })),
          getViewData: jest.fn(() => createTaskNoteContent({
            noteId: "thn_1",
            relatedKey: "task:vault:Inbox.md:0:abc",
            title: "Edit",
            createdAt: "2026-05-29T10:30:12"
          })),
          editor: {
            focus: jest.fn(),
            setCursor: jest.fn(),
            scrollIntoView: jest.fn()
          },
          setEphemeralState: jest.fn(),
          save: jest.fn(async () => undefined)
        });
      });
      detach() {}
    }
  };
  },
  { virtual: true }
);

jest.mock("./icons", () => ({
  registerTaskHubIcon: jest.fn(),
  TASK_HUB_ICON_ID: "task-hub"
}));

jest.mock("./localApple", () => ({
  appleCalendarSource: jest.fn(),
  appleRemindersSource: jest.fn(),
  configureLocalAppleHelperPath: jest.fn(),
  createAppleReminder: jest.fn(async () => "reminder-created-1"),
  createAppleCalendarEvent: jest.fn(),
  deleteAppleCalendarEvent: jest.fn(),
  deleteAppleReminder: jest.fn(),
  getLocalAppleHelperStatus: jest.fn(),
  installBundledAppleHelper: jest.fn(),
  readAppleCalendarEventsData: jest.fn(),
  readAppleReminderLists: jest.fn(),
  readAppleRemindersData: jest.fn(),
  requestLocalAppleAccess: jest.fn(),
  setAppleCalendarEventDate: jest.fn(),
  setAppleCalendarEventDetails: jest.fn(),
  setAppleReminderCompleted: jest.fn(),
  setAppleReminderDetails: jest.fn(),
  setAppleReminderDueDate: jest.fn(),
  setAppleReminderList: jest.fn()
}));

const {
  createAppleCalendarEvent,
  createAppleReminder,
  deleteAppleCalendarEvent,
  deleteAppleReminder,
  requestLocalAppleAccess,
  setAppleCalendarEventDetails,
  setAppleReminderDetails,
  setAppleReminderDueDate
} = jest.requireMock("./localApple");

describe("Apple Reminders migration", () => {
  beforeEach(() => {
    notices.length = 0;
    savedData.length = 0;
    buttons.length = 0;
    modals.length = 0;
    listeners.length = 0;
    jest.clearAllMocks();
    jest.spyOn(TaskHubPlugin.prototype, "isLocalAppleSupported").mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("creates the Apple Reminder and then removes the source Markdown task", async () => {
    const file = { path: "Inbox.md", extension: "md", stat: { ctime: 1, mtime: 2, size: 3 } };
    const plugin = new TaskHubPlugin({} as never, {} as never);
    const process = jest.fn(async (_file, update) => update("- [ ] Pay invoice 📅 2026-05-20\nNext"));
    plugin.app = {
      vault: {
        adapter: {},
        getFileByPath: jest.fn(() => file),
        read: jest.fn(async () => "- [ ] Pay invoice 📅 2026-05-20\nNext"),
        process,
        cachedRead: jest.fn(async () => "Next")
      },
      workspace: {
        getLeavesOfType: jest.fn(() => [])
      }
    } as never;
    plugin.settings = {
      ...DEFAULT_SETTINGS,
      localApple: {
        ...DEFAULT_SETTINGS.localApple,
        enabled: true,
        remindersEnabled: true,
        remindersCreateEnabled: true
      }
    };
    plugin.taskIndex = {
      reindexFile: jest.fn(async () => undefined)
    } as never;
    plugin.syncLocalApple = jest.fn(async () => undefined) as never;

    await plugin.sendTaskToAppleReminders(task());

    expect(createAppleReminder).toHaveBeenCalledWith({
      title: "Pay invoice",
      notes: expect.stringContaining("Source: Inbox.md:1"),
      dueDate: "2026-05-20",
      listId: undefined,
      tags: []
    });
    await expect(process.mock.results[0].value).resolves.toBe("Next");
    expect(Object.values(plugin.settings.appleReminderLinks)).toContain("reminder-created-1");
    expect(notices).toContain("Apple Reminder created and source task removed.");
  });

  it("transfers linked note YAML before removing a sent vault task", async () => {
    const taskFile = { path: "Inbox.md", extension: "md", stat: { ctime: 1, mtime: 2, size: 3 } };
    const noteFile = { path: "Task Hub Notes/pay.md", extension: "md", stat: { ctime: 4, mtime: 5, size: 6 } };
    const plugin = new TaskHubPlugin({} as never, {} as never);
    const currentTask = task();
    const oldKey = buildTaskNoteKey(currentTask);
    const noteContent = createTaskNoteContent({
      noteId: "thn_1",
      relatedKey: oldKey,
      title: "Pay invoice",
      createdAt: "2026-05-29T10:30:12"
    });
    const writes: Array<{ path: string; content: string }> = [];
    const process = jest.fn(async (file, update) => {
      const content = file.path === noteFile.path ? noteContent : "- [ ] Pay invoice 📅 2026-05-20\nNext";
      const next = update(content);
      writes.push({ path: file.path, content: next });
      return next;
    });
    plugin.app = {
      vault: {
        adapter: {},
        getFileByPath: jest.fn((path: string) => (path === noteFile.path ? noteFile : taskFile)),
        read: jest.fn(async () => "- [ ] Pay invoice 📅 2026-05-20\nNext"),
        process,
        cachedRead: jest.fn(async () => "Next")
      },
      workspace: {
        getLeavesOfType: jest.fn(() => [])
      }
    } as never;
    plugin.settings = {
      ...DEFAULT_SETTINGS,
      taskNotes: {
        ...DEFAULT_SETTINGS.taskNotes,
        enabled: true
      },
      localApple: {
        ...DEFAULT_SETTINGS.localApple,
        enabled: true,
        remindersEnabled: true,
        remindersCreateEnabled: true
      }
    };
    plugin.taskIndex = {
      reindexFile: jest.fn(async () => undefined)
    } as never;
    plugin.taskNoteIndex = {
      getNotesForKey: jest.fn(() => [{ path: noteFile.path, related: [oldKey], history: [], title: "pay" }]),
      reindexFile: jest.fn(async () => undefined)
    } as never;
    plugin.syncLocalApple = jest.fn(async () => undefined) as never;

    await plugin.sendTaskToAppleReminders(currentTask);

    expect(writes.map((write) => write.path)).toEqual([noteFile.path, taskFile.path]);
    const parsed = parseTaskNoteFrontmatter(writes[0].content);
    expect(parsed?.related).toEqual(["task:apple-reminders:reminder-created-1"]);
    expect(parsed?.history).toContain(oldKey);
  });

  it("deletes a task note instead of saving an empty body", async () => {
    const noteFile = { path: "Task Hub Notes/empty.md", extension: "md", stat: { ctime: 1, mtime: 2, size: 3 } };
    const plugin = new TaskHubPlugin({} as never, {} as never);
    const deleteFile = jest.fn(async () => undefined);
    const process = jest.fn();
    const removeFile = jest.fn();
    plugin.app = {
      vault: {
        delete: deleteFile,
        process
      },
      workspace: {
        getLeavesOfType: jest.fn(() => [])
      }
    } as never;
    plugin.settings = DEFAULT_SETTINGS;
    plugin.taskNoteIndex = {
      removeFile
    } as never;

    const result = await plugin.saveTaskNoteBody(noteFile as never, "  \n\t");

    expect(result).toEqual({ ok: true, deleted: true });
    expect(deleteFile).toHaveBeenCalledWith(noteFile);
    expect(removeFile).toHaveBeenCalledWith(noteFile.path);
    expect(process).not.toHaveBeenCalled();
  });

  it("cleans up an already-created note when its body is still empty", async () => {
    const noteFile = { path: "Task Hub Notes/empty.md", extension: "md", stat: { ctime: 1, mtime: 2, size: 3 } };
    const plugin = new TaskHubPlugin({} as never, {} as never);
    const deleteFile = jest.fn(async () => undefined);
    const removeFile = jest.fn();
    plugin.app = {
      vault: {
        cachedRead: jest.fn(async () =>
          createTaskNoteContent({
            noteId: "thn_1",
            relatedKey: "task:vault:Inbox.md:0:abc",
            title: "Empty",
            createdAt: "2026-05-29T10:30:12"
          })
        ),
        delete: deleteFile
      },
      workspace: {
        getLeavesOfType: jest.fn(() => [])
      }
    } as never;
    plugin.taskNoteIndex = {
      removeFile
    } as never;

    await plugin.deleteTaskNoteIfEmpty(noteFile as never);

    expect(deleteFile).toHaveBeenCalledWith(noteFile);
    expect(removeFile).toHaveBeenCalledWith(noteFile.path);
  });

  it("opens task notes in a native Markdown modal without creating a new tab", async () => {
    const noteFile = { path: "Task Hub Notes/edit.md", extension: "md", stat: { ctime: 1, mtime: 2, size: 3 } };
    const plugin = new TaskHubPlugin({} as never, {} as never);
    const getLeaf = jest.fn();
    plugin.app = {
      vault: {
        getFileByPath: jest.fn(() => noteFile),
        on: jest.fn(),
        offref: jest.fn()
      },
      workspace: {
        getLeaf,
        getLeavesOfType: jest.fn(() => [])
      }
    } as never;
    plugin.settings = DEFAULT_SETTINGS;

    await plugin.openTaskNote(noteFile.path);
    await Promise.resolve();

    expect(getLeaf).not.toHaveBeenCalled();
    const leaf = ((WorkspaceLeaf as unknown as { instances: Array<{ setViewState: jest.Mock; view?: unknown }> }).instances).at(-1);
    expect(leaf?.setViewState).toHaveBeenCalledWith({
      type: "markdown",
      state: {
        file: noteFile.path,
        mode: "source",
        source: false,
        properties: {
          visible: false
        }
      },
      active: true
    });
    const view = leaf?.view as { setEphemeralState: jest.Mock } | undefined;
    expect(view?.setEphemeralState).toHaveBeenCalledWith({
      existing: true,
      properties: {
        collapsed: false,
        visible: false
      }
    });
    expect(modals.at(-1)?.modalEl.toggleClass).toHaveBeenCalledWith("task-hub-note-modal-hide-frontmatter", true);
  });

  it("uses the setting to show task note frontmatter in the native modal", async () => {
    const noteFile = { path: "Task Hub Notes/edit.md", extension: "md", stat: { ctime: 1, mtime: 2, size: 3 } };
    const plugin = new TaskHubPlugin({} as never, {} as never);
    plugin.app = {
      vault: {
        getFileByPath: jest.fn(() => noteFile),
        on: jest.fn(),
        offref: jest.fn()
      },
      workspace: {
        getLeavesOfType: jest.fn(() => [])
      }
    } as never;
    plugin.settings = {
      ...DEFAULT_SETTINGS,
      taskNotes: {
        ...DEFAULT_SETTINGS.taskNotes,
        showFrontmatterInNoteModal: true
      }
    };

    await plugin.openTaskNote(noteFile.path);
    await Promise.resolve();

    const leaf = ((WorkspaceLeaf as unknown as { instances: Array<{ setViewState: jest.Mock; view?: unknown }> }).instances).at(-1);
    expect(leaf?.setViewState).toHaveBeenCalledWith(expect.objectContaining({
      state: expect.objectContaining({
        properties: {
          visible: true
        }
      })
    }));
    const view = leaf?.view as { setEphemeralState: jest.Mock } | undefined;
    expect(view?.setEphemeralState).toHaveBeenCalledWith({
      existing: true,
      properties: {
        collapsed: false,
        visible: true
      }
    });
    expect(modals.at(-1)?.modalEl.toggleClass).toHaveBeenCalledWith("task-hub-note-modal-hide-frontmatter", false);
  });

  it("deletes a newly created task note when creation is cancelled", async () => {
    const createdFile = { path: "Thino/20260529103012.md", extension: "md", stat: { ctime: 1, mtime: 2, size: 3 } };
    const plugin = new TaskHubPlugin({} as never, {} as never);
    const deleteFile = jest.fn(async () => undefined);
    const create = jest.fn(async () => createdFile);
    plugin.app = {
      vault: {
        createFolder: jest.fn(),
        create,
        delete: deleteFile,
        getFileByPath: jest.fn(() => null),
        getFolderByPath: jest.fn(() => ({ path: "Thino" })),
        on: jest.fn(),
        offref: jest.fn()
      },
      workspace: {
        getLeavesOfType: jest.fn(() => [])
      }
    } as never;
    plugin.settings = {
      ...DEFAULT_SETTINGS,
      taskNotes: {
        ...DEFAULT_SETTINGS.taskNotes,
        enabled: true,
        thinoIntegrationEnabled: true,
        defaultMode: "thino-multi-file"
      }
    };
    plugin.taskNoteIndex = {
      reindexFile: jest.fn(async () => undefined),
      removeFile: jest.fn()
    } as never;

    await plugin.createTaskNoteForTask(task());
    await flushAsync();
    buttons[0].onClickHandler?.();
    await flushAsync();

    expect(deleteFile).toHaveBeenCalledWith(createdFile);
    const [path, content] = create.mock.calls[0] as unknown as [string, string];
    const id = path.match(/^Thino\/(\d{14})\.md$/u)?.[1];
    expect(id).toBeTruthy();
    expect(content).toContain(`id: "${id}"`);
  });

  it("keeps a newly created task note when creation is saved", async () => {
    const createdFile = { path: "Thino/20260529103012.md", extension: "md", stat: { ctime: 1, mtime: 2, size: 3 } };
    const plugin = new TaskHubPlugin({} as never, {} as never);
    const deleteFile = jest.fn(async () => undefined);
    const create = jest.fn(async () => createdFile);
    plugin.app = {
      vault: {
        createFolder: jest.fn(),
        create,
        cachedRead: jest.fn(async () => "Body"),
        delete: deleteFile,
        getFileByPath: jest.fn(() => null),
        getFolderByPath: jest.fn(() => ({ path: "Thino" })),
        on: jest.fn(),
        offref: jest.fn()
      },
      workspace: {
        getLeavesOfType: jest.fn(() => [])
      }
    } as never;
    plugin.settings = {
      ...DEFAULT_SETTINGS,
      taskNotes: {
        ...DEFAULT_SETTINGS.taskNotes,
        enabled: true,
        thinoIntegrationEnabled: true,
        defaultMode: "thino-multi-file"
      }
    };
    plugin.taskNoteIndex = {
      reindexFile: jest.fn(async () => undefined),
      removeFile: jest.fn()
    } as never;

    await plugin.createTaskNoteForTask(task());
    await flushAsync();
    buttons[1].onClickHandler?.();
    await flushAsync();

    expect(deleteFile).not.toHaveBeenCalled();
    const [path, content] = create.mock.calls[0] as unknown as [string, string];
    const id = path.match(/^Thino\/(\d{14})\.md$/u)?.[1];
    expect(id).toBeTruthy();
    expect(content).toContain(`id: "${id}"`);
    expect(notices).toContain("Task note created.");
  });

  it("preserves a timed Markdown task start time when sending it to Apple Reminders", async () => {
    const file = { path: "Inbox.md", extension: "md", stat: { ctime: 1, mtime: 2, size: 3 } };
    const plugin = new TaskHubPlugin({} as never, {} as never);
    const process = jest.fn(async (_file, update) => update("- [ ] Pay invoice 📅 2026-05-20 ⏰ 09:30\nNext"));
    plugin.app = {
      vault: {
        adapter: {},
        getFileByPath: jest.fn(() => file),
        read: jest.fn(async () => "- [ ] Pay invoice 📅 2026-05-20 ⏰ 09:30\nNext"),
        process,
        cachedRead: jest.fn(async () => "Next")
      },
      workspace: {
        getLeavesOfType: jest.fn(() => [])
      }
    } as never;
    plugin.settings = {
      ...DEFAULT_SETTINGS,
      localApple: {
        ...DEFAULT_SETTINGS.localApple,
        enabled: true,
        remindersEnabled: true,
        remindersCreateEnabled: true
      }
    };
    plugin.taskIndex = {
      reindexFile: jest.fn(async () => undefined)
    } as never;
    plugin.syncLocalApple = jest.fn(async () => undefined) as never;

    await plugin.sendTaskToAppleReminders(task({
      rawLine: "- [ ] Pay invoice 📅 2026-05-20 ⏰ 09:30",
      text: "Pay invoice",
      scheduledDate: "2026-05-20T09:30"
    }));

    expect(createAppleReminder).toHaveBeenCalledWith({
      title: "Pay invoice",
      notes: expect.stringContaining("Source: Inbox.md:1"),
      dueDate: "2026-05-20",
      startMinutes: 570,
      listId: undefined,
      tags: []
    });
  });

  it("keeps the source Markdown task and shows a permission action when Reminders access is still pending", async () => {
    const file = { path: "Inbox.md", extension: "md", stat: { ctime: 1, mtime: 2, size: 3 } };
    const notDetermined = Object.assign(new Error("Apple access has not been requested yet."), { code: "not_determined" });
    createAppleReminder.mockRejectedValueOnce(notDetermined);
    requestLocalAppleAccess.mockResolvedValueOnce({
      ok: true,
      remindersStatus: { authorization: "notDetermined" },
      calendarStatus: { authorization: "notDetermined" }
    });
    const plugin = new TaskHubPlugin({} as never, {} as never);
    const process = jest.fn(async (_file, update) => update("- [ ] Pay invoice 📅 2026-05-20\nNext"));
    plugin.app = {
      vault: {
        adapter: {},
        getFileByPath: jest.fn(() => file),
        read: jest.fn(async () => "- [ ] Pay invoice 📅 2026-05-20\nNext"),
        process,
        cachedRead: jest.fn(async () => "- [ ] Pay invoice 📅 2026-05-20\nNext")
      },
      workspace: {
        getLeavesOfType: jest.fn(() => [])
      }
    } as never;
    plugin.settings = {
      ...DEFAULT_SETTINGS,
      localApple: {
        ...DEFAULT_SETTINGS.localApple,
        enabled: true,
        remindersEnabled: true,
        remindersCreateEnabled: true
      }
    };
    plugin.taskIndex = {
      reindexFile: jest.fn(async () => undefined)
    } as never;
    plugin.syncLocalApple = jest.fn(async () => undefined) as never;

    await plugin.sendTaskToAppleReminders(task());

    expect(requestLocalAppleAccess).toHaveBeenCalledWith({ reminders: true, calendar: false });
    expect(createAppleReminder).toHaveBeenCalledTimes(1);
    expect(process).not.toHaveBeenCalled();
    expect(Object.values(plugin.settings.appleReminderLinks)).not.toContain("reminder-created-1");
    expect(notices).toContain(
      "Apple Reminders permission is still pending. Open Task Hub settings > Local Apple, click Request access, then approve Reminders permission in macOS."
    );
  });

  it("sends source task tags to Apple Reminders by default", async () => {
    const file = { path: "Inbox.md", extension: "md", stat: { ctime: 1, mtime: 2, size: 3 } };
    const plugin = new TaskHubPlugin({} as never, {} as never);
    const process = jest.fn(async (_file, update) => update("- [ ] Pay invoice #work #client/acme 📅 2026-05-20\nNext"));
    plugin.app = {
      vault: {
        adapter: {},
        getFileByPath: jest.fn(() => file),
        read: jest.fn(async () => "- [ ] Pay invoice #work #client/acme 📅 2026-05-20\nNext"),
        process,
        cachedRead: jest.fn(async () => "Next")
      },
      workspace: {
        getLeavesOfType: jest.fn(() => [])
      }
    } as never;
    plugin.settings = {
      ...DEFAULT_SETTINGS,
      localApple: {
        ...DEFAULT_SETTINGS.localApple,
        enabled: true,
        remindersEnabled: true,
        remindersCreateEnabled: true
      }
    };
    plugin.taskIndex = {
      reindexFile: jest.fn(async () => undefined)
    } as never;
    plugin.syncLocalApple = jest.fn(async () => undefined) as never;

    await plugin.sendTaskToAppleReminders(task({
      rawLine: "- [ ] Pay invoice #work #client/acme 📅 2026-05-20",
      text: "Pay invoice",
      tags: ["#work", "#client/acme"]
    }));

    expect(createAppleReminder).toHaveBeenCalledWith(expect.objectContaining({
      title: "Pay invoice",
      tags: ["#work", "#client-acme"]
    }));
  });

  it("reschedules a timed Markdown task in place instead of sending it to Apple Calendar", async () => {
    const file = { path: "Inbox.md", extension: "md", stat: { ctime: 1, mtime: 2, size: 3 } };
    const plugin = new TaskHubPlugin({} as never, {} as never);
    const process = jest.fn(async (_file, update) => update("- [ ] Pay invoice 📅 2026-05-20\nNext"));
    plugin.app = {
      vault: {
        adapter: {},
        getFileByPath: jest.fn(() => file),
        read: jest.fn(async () => "- [ ] Pay invoice 📅 2026-05-20\nNext"),
        process,
        cachedRead: jest.fn(async () => "Next")
      },
      workspace: {
        getLeavesOfType: jest.fn(() => [])
      }
    } as never;
    plugin.settings = {
      ...DEFAULT_SETTINGS,
      localApple: {
        ...DEFAULT_SETTINGS.localApple,
        enabled: true,
        calendarEnabled: true,
        calendarTaskSendEnabled: true
      }
    };
    plugin.taskIndex = {
      reindexFile: jest.fn(async () => undefined)
    } as never;
    plugin.syncLocalApple = jest.fn(async () => undefined) as never;

    await plugin.rescheduleTask(task(), {
      dateKey: "2026-05-21",
      startMinutes: 570,
      durationMinutes: 90
    });

    expect(createAppleCalendarEvent).not.toHaveBeenCalled();
    await expect(process.mock.results[0].value).resolves.toBe("- [ ] Pay invoice 📅 2026-05-21 ⏰ 09:30\nNext");
    expect(notices).toContain("Task date updated.");
    expect(notices).not.toContain("Apple Calendar event created and source task removed.");
  });

  it("removes a timed Markdown task start time when dragged to the all-day area on the same date", async () => {
    const file = { path: "Inbox.md", extension: "md", stat: { ctime: 1, mtime: 2, size: 3 } };
    const plugin = new TaskHubPlugin({} as never, {} as never);
    const process = jest.fn(async (_file, update) => update("- [ ] Pay invoice 📅 2026-05-20 ⏰ 09:30\nNext"));
    plugin.app = {
      vault: {
        adapter: {},
        getFileByPath: jest.fn(() => file),
        process
      },
      workspace: {
        getLeavesOfType: jest.fn(() => [])
      }
    } as never;
    plugin.settings = DEFAULT_SETTINGS;
    plugin.taskIndex = {
      reindexFile: jest.fn(async () => undefined)
    } as never;

    await plugin.rescheduleTask(task({
      rawLine: "- [ ] Pay invoice 📅 2026-05-20 ⏰ 09:30",
      scheduledDate: "2026-05-20T09:30"
    }), "2026-05-20");

    await expect(process.mock.results[0].value).resolves.toBe("- [ ] Pay invoice 📅 2026-05-20\nNext");
    expect(notices).toContain("Task date updated.");
    expect(notices).not.toContain("Task is already on this date.");
  });

  it("updates an Apple Reminder time when dragged within the same day", async () => {
    const plugin = new TaskHubPlugin({} as never, {} as never);
    plugin.app = {
      workspace: {
        getLeavesOfType: jest.fn(() => [])
      }
    } as never;
    plugin.settings = {
      ...DEFAULT_SETTINGS,
      localApple: {
        ...DEFAULT_SETTINGS.localApple,
        enabled: true,
        remindersEnabled: true,
        remindersWritebackEnabled: true
      }
    };
    plugin.syncLocalApple = jest.fn(async () => undefined) as never;

    await plugin.rescheduleTask(appleReminderTask(), {
      dateKey: "2026-05-20",
      startMinutes: 570
    });

    expect(setAppleReminderDueDate).toHaveBeenCalledWith("reminder-1", "2026-05-20", 570);
    expect(savedData).toHaveLength(0);
    expect(notices).toContain("Task date updated.");
    expect(notices).not.toContain("Task is already on this date.");
  });

  it("removes an Apple Reminder start time when dragged to the all-day area on the same date", async () => {
    const plugin = new TaskHubPlugin({} as never, {} as never);
    plugin.app = {
      workspace: {
        getLeavesOfType: jest.fn(() => [])
      }
    } as never;
    plugin.settings = {
      ...DEFAULT_SETTINGS,
      localApple: {
        ...DEFAULT_SETTINGS.localApple,
        enabled: true,
        remindersEnabled: true,
        remindersWritebackEnabled: true
      }
    };
    plugin.syncLocalApple = jest.fn(async () => undefined) as never;

    await plugin.rescheduleTask({
      ...appleReminderTask(),
      scheduledDate: "2026-05-20T09:30"
    }, "2026-05-20");

    expect(setAppleReminderDueDate).toHaveBeenCalledWith("reminder-1", "2026-05-20", undefined);
    expect(savedData).toHaveLength(0);
    expect(notices).toContain("Task date updated.");
    expect(notices).not.toContain("Task is already on this date.");
  });

  it("serializes concurrent Apple Reminder drag reschedules", async () => {
    const plugin = new TaskHubPlugin({} as never, {} as never);
    plugin.app = {
      workspace: {
        getLeavesOfType: jest.fn(() => [])
      }
    } as never;
    plugin.settings = {
      ...DEFAULT_SETTINGS,
      localApple: {
        ...DEFAULT_SETTINGS.localApple,
        enabled: true,
        remindersEnabled: true,
        remindersWritebackEnabled: true
      }
    };
    plugin.syncLocalApple = jest.fn(async () => undefined) as never;

    const callOrder: string[] = [];
    let activeCalls = 0;
    let releaseCurrent: (() => void) | undefined;
    setAppleReminderDueDate.mockImplementation(async (id: string) => {
      callOrder.push(`start:${id}`);
      activeCalls += 1;
      if (activeCalls > 1) {
        throw new Error(`Concurrent Apple Reminder write detected for ${id}`);
      }
      await new Promise<void>((resolve) => {
        releaseCurrent = () => {
          callOrder.push(`end:${id}`);
          activeCalls -= 1;
          resolve();
        };
      });
    });

    const first = plugin.rescheduleTask(appleReminderTask({ externalId: "reminder-1" }), {
      dateKey: "2026-05-21",
      startMinutes: 540
    });
    await Promise.resolve();
    expect(callOrder).toEqual(["start:reminder-1"]);

    const second = plugin.rescheduleTask(appleReminderTask({ id: "apple-reminders:reminder-2", externalId: "reminder-2" }), {
      dateKey: "2026-05-22",
      startMinutes: 600
    });
    await Promise.resolve();
    expect(callOrder).toEqual(["start:reminder-1"]);

    releaseCurrent?.();
    await first;
    await Promise.resolve();
    expect(callOrder).toEqual(["start:reminder-1", "end:reminder-1", "start:reminder-2"]);

    releaseCurrent?.();
    await second;

    expect(callOrder).toEqual([
      "start:reminder-1",
      "end:reminder-1",
      "start:reminder-2",
      "end:reminder-2"
    ]);
    expect(setAppleReminderDueDate).toHaveBeenNthCalledWith(1, "reminder-1", "2026-05-21", 540);
    expect(setAppleReminderDueDate).toHaveBeenNthCalledWith(2, "reminder-2", "2026-05-22", 600);
  });

  it("creates an Apple Calendar event in the selected calendar", async () => {
    const plugin = new TaskHubPlugin({} as never, {} as never);
    plugin.app = {
      workspace: {
        getLeavesOfType: jest.fn(() => [])
      }
    } as never;
    plugin.settings = {
      ...DEFAULT_SETTINGS,
      localApple: {
        ...DEFAULT_SETTINGS.localApple,
        enabled: true,
        calendarEnabled: true,
        calendarTaskSendEnabled: true,
        calendarDefaultTimedTaskDurationMinutes: 75
      }
    };
    plugin.syncLocalApple = jest.fn(async () => undefined) as never;

    await plugin.createTaskForDate({ dateKey: "2026-05-20", startMinutes: 570 }, "Design review", {
      type: "apple-calendar",
      calendarId: "work"
    }, "Bring prototype notes");

    expect(createAppleCalendarEvent).toHaveBeenCalledWith({
      title: "Design review",
      date: "2026-05-20",
      startMinutes: 570,
      durationMinutes: 60,
      calendarId: "work",
      notes: "Bring prototype notes"
    });
    expect(notices).toContain("Apple Calendar event created.");
  });

  it("creates an Apple Calendar event with a one-hour default duration", async () => {
    const plugin = new TaskHubPlugin({} as never, {} as never);
    plugin.app = {
      workspace: {
        getLeavesOfType: jest.fn(() => [])
      }
    } as never;
    plugin.settings = {
      ...DEFAULT_SETTINGS,
      localApple: {
        ...DEFAULT_SETTINGS.localApple,
        enabled: true,
        calendarEnabled: true,
        calendarTaskSendEnabled: true
      }
    };
    plugin.syncLocalApple = jest.fn(async () => undefined) as never;

    await plugin.createTaskForDate("2026-05-20", "Design review", {
      type: "apple-calendar",
      calendarId: "work"
    });

    expect(createAppleCalendarEvent).toHaveBeenCalledWith({
      title: "Design review",
      date: "2026-05-20",
      startMinutes: 0,
      durationMinutes: 60,
      calendarId: "work"
    });
  });

  it("creates an Apple Reminder with modal notes", async () => {
    const plugin = new TaskHubPlugin({} as never, {} as never);
    plugin.app = {
      workspace: {
        getLeavesOfType: jest.fn(() => [])
      }
    } as never;
    plugin.settings = {
      ...DEFAULT_SETTINGS,
      localApple: {
        ...DEFAULT_SETTINGS.localApple,
        enabled: true,
        remindersEnabled: true,
        remindersCreateEnabled: true,
        remindersDefaultListId: "default-list"
      }
    };
    plugin.syncLocalApple = jest.fn(async () => undefined) as never;

    await plugin.createTaskForDate("2026-05-20", "Design review", {
      type: "apple-reminders",
      listId: "list-1"
    }, "Bring prototype notes");

    expect(createAppleReminder).toHaveBeenCalledWith({
      title: "Design review",
      dueDate: "2026-05-20",
      startMinutes: undefined,
      listId: "list-1",
      notes: "Bring prototype notes",
      tags: []
    });
    expect(notices).toContain("Apple Reminder created.: reminder-created-1");
  });

  it("creates a timed Apple Reminder with an alert from the modal", async () => {
    const plugin = new TaskHubPlugin({} as never, {} as never);
    plugin.app = {
      workspace: {
        getLeavesOfType: jest.fn(() => [])
      }
    } as never;
    plugin.settings = {
      ...DEFAULT_SETTINGS,
      localApple: {
        ...DEFAULT_SETTINGS.localApple,
        enabled: true,
        remindersEnabled: true,
        remindersCreateEnabled: true
      }
    };
    plugin.syncLocalApple = jest.fn(async () => undefined) as never;

    await plugin.createTaskForDate({ dateKey: "2026-05-20", startMinutes: 570 }, "Design review", { type: "apple-reminders" }, undefined, 15);

    expect(createAppleReminder).toHaveBeenCalledWith(expect.objectContaining({
      dueDate: "2026-05-20",
      startMinutes: 570,
      alertMinutesBefore: 15
    }));
  });

  it("sets 09:00 when enabling a new Apple Reminder alert without changing time when disabling it", async () => {
    const plugin = new TaskHubPlugin({} as never, {} as never);
    plugin.app = {
      workspace: {
        getLeavesOfType: jest.fn(() => [])
      }
    } as never;
    plugin.settings = {
      ...DEFAULT_SETTINGS,
      calendarCreationDefaultKind: "task",
      calendarTaskCreationDefaultTarget: { type: "apple-reminders" },
      localApple: {
        ...DEFAULT_SETTINGS.localApple,
        enabled: true,
        remindersEnabled: true,
        remindersCreateEnabled: true
      }
    };
    plugin.syncLocalApple = jest.fn(async () => undefined) as never;
    (globalThis as unknown as { window: { setTimeout: typeof setTimeout } }).window = { setTimeout };

    plugin.openCreateTaskModal("2026-05-20");

    const modal = modals.at(-1);
    const fields = modal ? collectElements(modal.contentEl) : [];
    const bodyInput = fields.find((element) => element.type === "text");
    const timeInput = fields.find((element) => element.type === "time");
    const alertToggle = fields.find((element) => element.type === "checkbox");
    const addButton = buttons.find((button) => button.setButtonText.mock.calls.some((call) => call[0] === "Add"));

    expect(bodyInput).toBeDefined();
    expect(timeInput?.value).toBe("");
    expect(alertToggle?.disabled).toBe(false);

    alertToggle!.checked = true;
    dispatchFake(alertToggle!, "change");
    expect(timeInput?.value).toBe("09:00");
    alertToggle!.checked = false;
    dispatchFake(alertToggle!, "change");
    expect(timeInput?.value).toBe("09:00");

    bodyInput!.value = "Design review";
    dispatchFake(bodyInput!, "input");
    addButton?.onClickHandler?.();
    await flushAsync();

    expect(createAppleReminder).toHaveBeenCalledWith(expect.objectContaining({
      title: "Design review",
      dueDate: "2026-05-20",
      startMinutes: 540
    }));
    expect(createAppleReminder).toHaveBeenCalledWith(expect.not.objectContaining({
      alertMinutesBefore: expect.any(Number)
    }));
  });

  it("extracts modal body hashtags into Apple Reminder tags", async () => {
    const plugin = new TaskHubPlugin({} as never, {} as never);
    plugin.app = {
      workspace: {
        getLeavesOfType: jest.fn(() => [])
      }
    } as never;
    plugin.settings = {
      ...DEFAULT_SETTINGS,
      localApple: {
        ...DEFAULT_SETTINGS.localApple,
        enabled: true,
        remindersEnabled: true,
        remindersCreateEnabled: true,
        remindersCreateTagsEnabled: true
      }
    };
    plugin.syncLocalApple = jest.fn(async () => undefined) as never;

    await plugin.createTaskForDate("2026-05-20", "测试标签 #测试 #client/acme", { type: "apple-reminders" });

    expect(createAppleReminder).toHaveBeenCalledWith(expect.objectContaining({
      title: "测试标签",
      tags: ["#测试", "#client-acme"]
    }));
  });

  it("still extracts explicit modal body hashtags when source tag sync is disabled", async () => {
    const plugin = new TaskHubPlugin({} as never, {} as never);
    plugin.app = {
      workspace: {
        getLeavesOfType: jest.fn(() => [])
      }
    } as never;
    plugin.settings = {
      ...DEFAULT_SETTINGS,
      localApple: {
        ...DEFAULT_SETTINGS.localApple,
        enabled: true,
        remindersEnabled: true,
        remindersCreateEnabled: true,
        remindersCreateTagsEnabled: false
      }
    };
    plugin.syncLocalApple = jest.fn(async () => undefined) as never;

    await plugin.createTaskForDate("2026-05-20", "测试标签 #测试", { type: "apple-reminders" });

    expect(createAppleReminder).toHaveBeenCalledWith(expect.objectContaining({
      title: "测试标签",
      tags: ["#测试"]
    }));
  });

  it("creates Dida tasks with native tags separate from Apple Reminder tags", async () => {
    const plugin = new TaskHubPlugin({} as never, {} as never);
    const createTask = jest.fn(async () => ({ id: "dida-created-1" }));
    jest.spyOn(plugin as never, "createDidaClient").mockReturnValue({ createTask } as never);
    plugin.app = { workspace: { getLeavesOfType: jest.fn(() => []) } } as never;
    plugin.settings = {
      ...DEFAULT_SETTINGS,
      dida: {
        ...DEFAULT_SETTINGS.dida,
        enabled: true,
        tasksEnabled: true,
        tasksCreateEnabled: true,
        tasksCreateTagsEnabled: true,
        apiToken: "token",
        defaultProjectId: "project-1"
      }
    };
    plugin.syncDida = jest.fn(async () => undefined) as never;

    await plugin.createTaskForDate("2026-05-20", "RPA 学习 #比赛 #p/自习室", { type: "dida" });

    expect(createTask).toHaveBeenCalledWith(expect.objectContaining({
      title: "RPA 学习",
      projectId: "project-1",
      tags: ["比赛", "p/自习室"]
    }));
  });

  it("completes Dida tasks when Obsidian requestUrl has an empty JSON body", async () => {
    const { requestUrl } = jest.requireMock("obsidian");
    requestUrl.mockResolvedValueOnce({
      status: 200,
      text: "",
      get json() {
        throw new SyntaxError("Unexpected end of JSON input");
      }
    });
    const plugin = new TaskHubPlugin({} as never, {} as never);
    plugin.app = { workspace: { getLeavesOfType: jest.fn(() => []) } } as never;
    plugin.settings = {
      ...DEFAULT_SETTINGS,
      dida: {
        ...DEFAULT_SETTINGS.dida,
        enabled: true,
        tasksEnabled: true,
        tasksWritebackEnabled: true,
        apiToken: "token"
      }
    };
    plugin.syncDida = jest.fn(async () => undefined) as never;

    const result = await plugin.completeTask(task({
      id: "dida:task-1",
      filePath: "Dida",
      rawLine: "Dida task",
      text: "Dida task",
      source: "dida",
      externalId: "task-1",
      externalListId: "project-1"
    }));

    expect(result.status).toBe("updated");
    expect(requestUrl).toHaveBeenCalledWith(expect.objectContaining({
      method: "POST",
      url: "https://api.dida365.com/open/v1/project/project-1/task/task-1/complete"
    }));
    expect(notices).toContain("Task completed.");
  });

  it("requests Reminders access and retries when creating an Apple Reminder before permission is granted", async () => {
    const notDetermined = Object.assign(new Error("Apple access has not been requested yet."), { code: "not_determined" });
    createAppleReminder.mockRejectedValueOnce(notDetermined).mockResolvedValueOnce("reminder-created-after-access");
    requestLocalAppleAccess.mockResolvedValueOnce({
      ok: true,
      remindersStatus: { authorization: "fullAccess" },
      calendarStatus: { authorization: "notDetermined" }
    });
    const plugin = new TaskHubPlugin({} as never, {} as never);
    plugin.app = { workspace: { getLeavesOfType: jest.fn(() => []) } } as never;
    plugin.settings = {
      ...DEFAULT_SETTINGS,
      localApple: {
        ...DEFAULT_SETTINGS.localApple,
        enabled: true,
        remindersEnabled: true,
        remindersCreateEnabled: true
      }
    };
    plugin.syncLocalApple = jest.fn(async () => undefined) as never;

    await plugin.createTaskForDate("2026-05-20", "Design review", { type: "apple-reminders" });

    expect(requestLocalAppleAccess).toHaveBeenCalledWith({ reminders: true, calendar: false });
    expect(createAppleReminder).toHaveBeenCalledTimes(2);
    expect(notices).toContain("Apple Reminder created.: reminder-created-after-access");
  });

  it("shows an Obsidian permission reminder when Apple Reminders write access is denied", async () => {
    const denied = Object.assign(new Error("Apple access was denied in macOS Privacy & Security settings."), {
      code: "permission_denied"
    });
    createAppleReminder.mockRejectedValueOnce(denied);
    const plugin = new TaskHubPlugin({} as never, {} as never);
    plugin.app = { workspace: { getLeavesOfType: jest.fn(() => []) } } as never;
    plugin.settings = {
      ...DEFAULT_SETTINGS,
      localApple: {
        ...DEFAULT_SETTINGS.localApple,
        enabled: true,
        remindersEnabled: true,
        remindersCreateEnabled: true
      }
    };
    plugin.syncLocalApple = jest.fn(async () => undefined) as never;

    await plugin.createTaskForDate("2026-05-20", "Design review", { type: "apple-reminders" });

    expect(notices).toContain(
      "Apple Reminders permission is blocked. Open macOS System Settings > Privacy & Security > Reminders, allow Obsidian or Task Hub Apple Helper, then try again."
    );
  });

  it("shows an Obsidian permission reminder when Apple Calendar write access is denied", async () => {
    const denied = Object.assign(new Error("Apple access was denied in macOS Privacy & Security settings."), {
      code: "permission_denied"
    });
    createAppleCalendarEvent.mockRejectedValueOnce(denied);
    const plugin = new TaskHubPlugin({} as never, {} as never);
    plugin.app = { workspace: { getLeavesOfType: jest.fn(() => []) } } as never;
    plugin.settings = {
      ...DEFAULT_SETTINGS,
      localApple: {
        ...DEFAULT_SETTINGS.localApple,
        enabled: true,
        calendarEnabled: true,
        calendarTaskSendEnabled: true
      }
    };
    plugin.syncLocalApple = jest.fn(async () => undefined) as never;

    await plugin.createTaskForDate("2026-05-20", "Design review", { type: "apple-calendar" });

    expect(notices).toContain(
      "Apple Calendar permission is blocked. Open macOS System Settings > Privacy & Security > Calendars, allow Obsidian or Task Hub Apple Helper, then try again."
    );
  });

  it("deletes a Markdown task from the calendar context action", async () => {
    const file = { path: "Inbox.md", extension: "md", stat: { ctime: 1, mtime: 2, size: 3 } };
    const plugin = new TaskHubPlugin({} as never, {} as never);
    const process = jest.fn(async (_file, update) => update("- [ ] Pay invoice 📅 2026-05-20\nNext"));
    plugin.app = {
      vault: {
        getFileByPath: jest.fn(() => file),
        process
      },
      workspace: {
        getLeavesOfType: jest.fn(() => [])
      }
    } as never;
    plugin.settings = DEFAULT_SETTINGS;
    plugin.taskIndex = {
      reindexFile: jest.fn(async () => undefined)
    } as never;

    await plugin.deleteCalendarTask(task());

    await expect(process.mock.results[0].value).resolves.toBe("Next");
    expect(notices).toContain("Calendar item deleted.");
  });

  it("deletes an Apple Reminder when Apple Reminders integration is enabled", async () => {
    const plugin = new TaskHubPlugin({} as never, {} as never);
    plugin.app = {
      workspace: {
        getLeavesOfType: jest.fn(() => [])
      }
    } as never;
    plugin.settings = {
      ...DEFAULT_SETTINGS,
      localApple: {
        ...DEFAULT_SETTINGS.localApple,
        enabled: true,
        remindersEnabled: true,
        remindersWritebackEnabled: false
      }
    };
    plugin.syncLocalApple = jest.fn(async () => undefined) as never;

    await plugin.deleteCalendarTask(appleReminderTask());

    expect(deleteAppleReminder).toHaveBeenCalledWith("reminder-1");
    expect(notices).toContain("Calendar item deleted.");
  });

  it("deletes an Apple Calendar event when Apple Calendar integration is enabled", async () => {
    const plugin = new TaskHubPlugin({} as never, {} as never);
    plugin.app = {
      workspace: {
        getLeavesOfType: jest.fn(() => [])
      }
    } as never;
    plugin.settings = {
      ...DEFAULT_SETTINGS,
      localApple: {
        ...DEFAULT_SETTINGS.localApple,
        enabled: true,
        calendarEnabled: true,
        calendarWritebackEnabled: false
      }
    };
    plugin.syncLocalApple = jest.fn(async () => undefined) as never;

    await plugin.deleteCalendarEvent({
      id: "event-1",
      sourceId: "apple-calendar",
      title: "Design review",
      start: "2026-05-20T09:30:00",
      end: "2026-05-20T10:30:00",
      allDay: false
    });

    expect(deleteAppleCalendarEvent).toHaveBeenCalledWith("event-1");
    expect(notices).toContain("Calendar item deleted.");
  });

  it("updates a Markdown calendar task detail draft in place", async () => {
    const file = { path: "Inbox.md", extension: "md", stat: { ctime: 1, mtime: 2, size: 3 } };
    const plugin = new TaskHubPlugin({} as never, {} as never);
    const process = jest.fn(async (_file, update) => update("- [ ] Pay invoice 📅 2026-05-20\nNext"));
    plugin.app = {
      vault: {
        adapter: {},
        getFileByPath: jest.fn(() => file),
        process,
        cachedRead: jest.fn(async () => "Next")
      },
      workspace: { getLeavesOfType: jest.fn(() => []) }
    } as never;
    plugin.settings = DEFAULT_SETTINGS;
    plugin.taskIndex = { reindexFile: jest.fn(async () => undefined) } as never;

    await plugin.updateCalendarTask(task(), {
      kind: "task",
      title: "Send invoice",
      date: "2026-05-21",
      startTime: "09:30",
      tags: ["#finance"],
      reminderListId: ""
    });

    await expect(process.mock.results[0].value).resolves.toBe("- [ ] Send invoice 📅 2026-05-21 ⏰ 09:30 #finance\nNext");
    expect(notices).toContain("Task updated.");
  });

  it("updates Apple Reminder detail drafts through the helper", async () => {
    const plugin = new TaskHubPlugin({} as never, {} as never);
    plugin.app = { workspace: { getLeavesOfType: jest.fn(() => []) } } as never;
    plugin.settings = {
      ...DEFAULT_SETTINGS,
      localApple: {
        ...DEFAULT_SETTINGS.localApple,
        enabled: true,
        remindersEnabled: true,
        remindersWritebackEnabled: true,
        remindersCreateEnabled: true
      }
    };
    plugin.syncLocalApple = jest.fn(async () => undefined) as never;

    await plugin.updateCalendarTask(appleReminderTask(), {
      kind: "task",
      title: "Send invoice",
      date: "2026-05-21",
      startTime: "09:30",
      reminderListId: "list-1",
      notes: "Bring the signed copy"
    });

    expect(setAppleReminderDetails).toHaveBeenCalledWith({
      id: "reminder-1",
      title: "Send invoice",
      dueDate: "2026-05-21",
      startMinutes: 570,
      alertMinutesBefore: null,
      listId: "list-1",
      notes: "Bring the signed copy",
      tags: []
    });
    expect(notices).toContain("Task updated.");
  });

  it("preserves Apple Reminder tags when updating other details", async () => {
    const plugin = new TaskHubPlugin({} as never, {} as never);
    plugin.app = { workspace: { getLeavesOfType: jest.fn(() => []) } } as never;
    plugin.settings = {
      ...DEFAULT_SETTINGS,
      localApple: {
        ...DEFAULT_SETTINGS.localApple,
        enabled: true,
        remindersEnabled: true,
        remindersWritebackEnabled: true,
        remindersCreateEnabled: true
      }
    };
    plugin.syncLocalApple = jest.fn(async () => undefined) as never;

    await plugin.updateCalendarTask(appleReminderTask({ tags: ["#errand", "#client-acme"] }), {
      kind: "task",
      title: "Send invoice",
      date: "2026-05-21",
      startTime: "09:30",
      reminderListId: "list-1",
      notes: "Bring the signed copy"
    });

    expect(setAppleReminderDetails).toHaveBeenCalledWith(expect.objectContaining({
      title: "Send invoice",
      tags: ["#errand", "#client-acme"]
    }));
  });

  it("updates Apple Reminder tags from edited task tags", async () => {
    const plugin = new TaskHubPlugin({} as never, {} as never);
    plugin.app = { workspace: { getLeavesOfType: jest.fn(() => []) } } as never;
    plugin.settings = {
      ...DEFAULT_SETTINGS,
      localApple: {
        ...DEFAULT_SETTINGS.localApple,
        enabled: true,
        remindersEnabled: true,
        remindersWritebackEnabled: true
      }
    };
    plugin.syncLocalApple = jest.fn(async () => undefined) as never;

    await plugin.updateCalendarTask(appleReminderTask({ tags: ["#old"] }), {
      kind: "task",
      title: "Send invoice",
      date: "2026-05-21",
      tags: ["#errand", "#client-acme"]
    });

    expect(setAppleReminderDetails).toHaveBeenCalledWith(expect.objectContaining({
      title: "Send invoice",
      tags: ["#errand", "#client-acme"]
    }));
  });

  it("requests Reminders access and retries when updating before permission is granted", async () => {
    const notDetermined = Object.assign(new Error("Apple access has not been requested yet."), { code: "not_determined" });
    setAppleReminderDetails.mockRejectedValueOnce(notDetermined).mockResolvedValueOnce(undefined);
    requestLocalAppleAccess.mockResolvedValueOnce({
      ok: true,
      remindersStatus: { authorization: "fullAccess" },
      calendarStatus: { authorization: "notDetermined" }
    });
    const plugin = new TaskHubPlugin({} as never, {} as never);
    plugin.app = { workspace: { getLeavesOfType: jest.fn(() => []) } } as never;
    plugin.settings = {
      ...DEFAULT_SETTINGS,
      localApple: {
        ...DEFAULT_SETTINGS.localApple,
        enabled: true,
        remindersEnabled: true,
        remindersWritebackEnabled: true
      }
    };
    plugin.syncLocalApple = jest.fn(async () => undefined) as never;

    await plugin.updateCalendarTask(appleReminderTask(), {
      kind: "task",
      title: "Send invoice",
      date: "2026-05-21",
      startTime: "09:30",
      reminderListId: "",
      notes: "Bring the signed copy"
    });

    expect(requestLocalAppleAccess).toHaveBeenCalledWith({ reminders: true, calendar: false });
    expect(setAppleReminderDetails).toHaveBeenCalledTimes(2);
    expect(notices).toContain("Task updated.");
  });

  it("updates Apple Calendar event detail drafts through the helper", async () => {
    const plugin = new TaskHubPlugin({} as never, {} as never);
    plugin.app = { workspace: { getLeavesOfType: jest.fn(() => []) } } as never;
    plugin.settings = {
      ...DEFAULT_SETTINGS,
      localApple: {
        ...DEFAULT_SETTINGS.localApple,
        enabled: true,
        calendarEnabled: true,
        calendarWritebackEnabled: true
      }
    };
    plugin.syncLocalApple = jest.fn(async () => undefined) as never;

    await plugin.updateCalendarEvent({
      id: "event-1",
      sourceId: "apple-calendar",
      title: "Design review",
      start: "2026-05-20T09:30:00",
      end: "2026-05-20T10:30:00",
      allDay: false
    }, {
      kind: "event",
      title: "Updated review",
      date: "2026-05-21",
      startTime: "10:00",
      endTime: "11:15",
      allDay: false,
      calendarId: "calendar-1",
      notes: "Discuss launch scope"
    });

    expect(setAppleCalendarEventDetails).toHaveBeenCalledWith({
      id: "event-1",
      title: "Updated review",
      targetDate: "2026-05-21",
      startMinutes: 600,
      durationMinutes: 75,
      start: "2026-05-20T09:30:00",
      end: "2026-05-20T10:30:00",
      allDay: false,
      calendarId: "calendar-1",
      notes: "Discuss launch scope"
    });
    expect(notices).toContain("Event updated.");
  });
});

function task(overrides: Partial<TaskItem> = {}): TaskItem {
  return {
    id: "Inbox.md:0:904c04a88c5cf4eec11d8e6c5d80860fd24fca31",
    filePath: "Inbox.md",
    line: 0,
    rawLine: "- [ ] Pay invoice 📅 2026-05-20",
    text: "Pay invoice",
    completed: false,
    tags: [],
    dueDate: "2026-05-20",
    source: "vault",
    ...overrides
  };
}

function appleReminderTask(overrides: Partial<TaskItem> = {}): TaskItem {
  return {
    id: "apple-reminders:reminder-1",
    externalId: "reminder-1",
    filePath: "Apple Reminders",
    line: 0,
    rawLine: "Pay invoice",
    text: "Pay invoice",
    completed: false,
    tags: [],
    dueDate: "2026-05-20",
    source: "apple-reminders",
    ...overrides
  };
}

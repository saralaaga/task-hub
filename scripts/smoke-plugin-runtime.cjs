const Module = require("module");
const fs = require("fs");
const os = require("os");
const path = require("path");

const originalLoad = Module._load;
const layoutReadyCallbacks = [];
let expectedHelperPath = "";

class Plugin {
  constructor() {
    this.manifest = {
      id: "task-hub",
      dir: ".obsidian/plugins/task-hub"
    };
    this.app = {
      workspace: {
        on() {
          return {};
        },
        onLayoutReady(callback) {
          layoutReadyCallbacks.push(callback);
        },
        detachLeavesOfType() {},
        getLeavesOfType() {
          return [];
        },
        getLeaf() {
          return {
            setViewState: async () => {},
            openFile: async () => {},
            view: {}
          };
        },
        revealLeaf() {}
      },
      vault: {
        adapter: {
          getFullPath(normalizedPath) {
            return path.join(os.tmpdir(), "task-hub-smoke-vault", normalizedPath);
          }
        },
        getMarkdownFiles() {
          return [];
        },
        on() {
          return {};
        },
        getFileByPath() {
          return null;
        },
        cachedRead: async () => ""
      }
    };
  }

  async loadData() {
    return {
      localApple: {
        enabled: true,
        remindersEnabled: true,
        calendarColor: "#6f94b8",
        calendarEnabled: true,
        calendarLookbackDays: 1,
        calendarLookaheadDays: 1
      }
    };
  }

  async saveData() {}
  registerView() {}
  addSettingTab() {}
  addRibbonIcon() {}
  addCommand() {}
  registerEvent() {}
}

class PluginSettingTab {
  constructor(app, plugin) {
    this.app = app;
    this.plugin = plugin;
  }
}

class ItemView {
  constructor(leaf) {
    this.leaf = leaf;
    this.containerEl = {
      children: [
        null,
        {
          empty() {},
          createDiv() {
            return this;
          },
          createEl() {
            return this;
          }
        }
      ]
    };
  }
}

class TFile {}
class MarkdownView {}
class Setting {}
class ButtonComponent {}
class AbstractInputSuggest {
  constructor() {}
  close() {}
}

class Modal {
  constructor(app) {
    this.app = app;
    this.contentEl = {
      empty() {},
      createDiv() {
        return this;
      },
      createEl() {
        return this;
      },
      addEventListener() {}
    };
  }

  open() {}
  close() {}
  onOpen() {}
  onClose() {}
}

class Notice {
  constructor(message) {
    Notice.messages.push(message);
  }
}
Notice.messages = [];

const obsidian = {
  Plugin,
  PluginSettingTab,
  ItemView,
  TFile,
  MarkdownView,
  Modal,
  Notice,
  Setting,
  ButtonComponent,
  AbstractInputSuggest,
  Platform: { isDesktopApp: true },
  requestUrl: async () => ({
    status: 200,
    headers: {},
    text: "BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR"
  }),
  addIcon() {},
  setIcon() {},
  getAllTags() {
    return [];
  },
  parseFrontMatterTags() {
    return [];
  }
};

const childProcess = {
  execFile(file, args, options, callback) {
    if (file.endsWith("taskhub-apple-helper") && file !== expectedHelperPath) {
      callback(new Error(`Unexpected helper path: ${file}`), "", "");
      return;
    }

    if (file.endsWith("taskhub-apple-helper") && args[0] === "status") {
      callback(
        null,
        JSON.stringify({
          ok: true,
          platform: "macos",
          remindersStatus: { authorization: "fullAccess" },
          calendarStatus: { authorization: "fullAccess" }
        }),
        ""
      );
      return;
    }

    if (file.endsWith("taskhub-apple-helper") && args[0] === "reminders") {
      callback(
        null,
        JSON.stringify({
          ok: true,
          reminders: [
            {
              id: "r1",
              name: "Mock Reminder",
              listId: "inbox",
              list: "Inbox",
              completed: false,
              dueDate: "2026-05-07T00:00:00.000Z",
              notes: "note",
              priority: 0,
              url: null
            }
          ]
        }),
        ""
      );
      return;
    }

    if (file.endsWith("taskhub-apple-helper") && args[0] === "calendar") {
      callback(
        null,
        JSON.stringify({
          ok: true,
          events: [
            {
              id: "e1",
              title: "Mock Event",
              calendar: "Work",
              startDate: "2026-05-07T09:00:00.000Z",
              endDate: "2026-05-07T10:00:00.000Z",
              allDay: false,
              location: "Desk",
              notes: "agenda",
              url: null
            }
          ]
        }),
        ""
      );
      return;
    }

    if (file.endsWith("taskhub-apple-helper") && args[0] === "reminder-lists") {
      callback(
        null,
        JSON.stringify({
          ok: true,
          lists: [{ id: "inbox", name: "Inbox" }]
        }),
        ""
      );
      return;
    }

    if (file.endsWith("taskhub-apple-helper") && args[0] === "set-reminder-completed") {
      callback(null, JSON.stringify({ ok: true }), "");
      return;
    }

    if (file.endsWith("taskhub-apple-helper") && args[0] === "set-calendar-event-date") {
      callback(null, JSON.stringify({ ok: true }), "");
      return;
    }

    if (
      file.endsWith("taskhub-apple-helper") &&
      (args[0] === "set-reminder-list" || args[0] === "create-reminder" || args[0] === "set-reminder-due")
    ) {
      callback(null, JSON.stringify({ ok: true, reminderId: "created-r1" }), "");
      return;
    }

    if (file.endsWith("taskhub-apple-helper") && args[0] === "create-calendar-event") {
      callback(null, JSON.stringify({ ok: true }), "");
      return;
    }

    callback(
      null,
      JSON.stringify([
        {
          id: "r1",
          name: "Mock Reminder",
          list: "Inbox",
          completed: false,
          dueDate: "2026-05-07T00:00:00.000Z",
          notes: "note"
        }
      ]),
      ""
    );
  }
};

Module._load = function load(request, parent, isMain) {
  if (request === "obsidian") return obsidian;
  if (request === "child_process") return childProcess;
  return originalLoad.call(this, request, parent, isMain);
};

async function withPlatform(platform, run) {
  const descriptor = Object.getOwnPropertyDescriptor(process, "platform");
  Object.defineProperty(process, "platform", { value: platform });
  try {
    return await run();
  } finally {
    if (descriptor) Object.defineProperty(process, "platform", descriptor);
  }
}

async function main() {
  await withPlatform("darwin", async () => {
    const runtimeDir = fs.mkdtempSync(path.join(os.tmpdir(), "task-hub-smoke-"));
    const runtimeMain = path.join(runtimeDir, "main.js");
    expectedHelperPath = path.join(os.tmpdir(), "task-hub-smoke-vault", ".obsidian/plugins/task-hub/taskhub-apple-helper");
    fs.copyFileSync(path.join(__dirname, "..", "main.js"), runtimeMain);

    const pluginModule = require(runtimeMain);
    const PluginClass = pluginModule.default || pluginModule;
    const plugin = new PluginClass();

    await plugin.onload();
    for (const callback of layoutReadyCallbacks) callback();
    await new Promise((resolve) => setTimeout(resolve, 25));

    const result = {
      taskCount: plugin.getTasks().length,
      eventCount: plugin.getCalendarEvents().length,
      sourceStates: plugin.getCalendarSources().map((source) => [source.id, source.status.state, source.status.eventCount]),
      sourceColors: Object.fromEntries(plugin.getCalendarSources().map((source) => [source.id, source.color])),
      localAppleStatus: plugin.localAppleStatus.state,
      notices: Notice.messages
    };

    console.log(JSON.stringify(result, null, 2));

    if (result.taskCount !== 1) throw new Error(`Expected 1 Apple reminder task, got ${result.taskCount}.`);
    if (result.eventCount !== 1) throw new Error(`Expected 1 Apple calendar event, got ${result.eventCount}.`);
    if (result.sourceColors["apple-calendar"] !== "#6f94b8") {
      throw new Error(`Expected Apple Calendar color #6f94b8, got ${result.sourceColors["apple-calendar"]}.`);
    }
    if (result.localAppleStatus !== "ok") throw new Error(`Expected local Apple status ok, got ${result.localAppleStatus}.`);
  });
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});

import { resolveTaskBulkActions } from "./taskSelection";
import type { TaskItem } from "../types";

const vaultTask: TaskItem = {
  id: "vault-1",
  filePath: "Inbox.md",
  line: 0,
  rawLine: "- [ ] Vault task",
  text: "Vault task",
  completed: false,
  tags: [],
  dueDate: "2026-06-01",
  source: "vault"
};

const appleTask: TaskItem = {
  id: "apple-1",
  filePath: "Apple Reminders/Inbox",
  line: 0,
  rawLine: "",
  text: "Apple task",
  completed: false,
  tags: [],
  dueDate: "2026-06-01",
  source: "apple-reminders",
  externalId: "reminder-1",
  externalSourceName: "Apple Reminders"
};

const didaTask: TaskItem = {
  id: "dida-1",
  filePath: "Dida/Inbox",
  line: 0,
  rawLine: "",
  text: "Dida task",
  completed: false,
  tags: [],
  dueDate: "2026-06-01",
  source: "dida",
  externalId: "dida-task-1",
  externalSourceName: "Dida"
};

function actionIds(tasks: TaskItem[], capabilities = {}) {
  return resolveTaskBulkActions(tasks, {
    allowAppleReminderWriteback: false,
    ...capabilities
  }).map((action) => action.id);
}

describe("taskSelection", () => {
  it("keeps only actions every selected task can perform", () => {
    expect(actionIds([vaultTask, appleTask], {
      allowAppleReminderWriteback: true,
      allowAppleReminderCreate: true,
      allowAppleCalendarReminderConversion: true,
      taskNotesEnabled: true
    })).toEqual(["create-note", "mark-complete", "delete"]);
  });

  it("requires Apple Reminders writeback before Apple Reminder tasks can be completed or deleted", () => {
    expect(actionIds([appleTask], { taskNotesEnabled: true })).toEqual(["create-note", "open-source"]);
  });

  it("shows completion and Apple Reminder send actions for open vault tasks when enabled", () => {
    expect(actionIds([vaultTask], { allowAppleReminderCreate: true, allowDidaCreate: true })).toEqual([
      "mark-complete",
      "open-source",
      "delete",
      "send-to-apple-reminders",
      "send-to-dida"
    ]);
  });

  it("shows reopen only when every selected task is completed", () => {
    const completedVault = { ...vaultTask, id: "vault-completed", completed: true, rawLine: "- [x] Done" };

    expect(actionIds([completedVault], { allowAppleReminderCreate: true })).toEqual([
      "mark-open",
      "open-source",
      "delete",
      "send-to-apple-reminders"
    ]);
    expect(actionIds([completedVault, vaultTask], { allowAppleReminderCreate: true })).toEqual([
      "delete",
      "send-to-apple-reminders"
    ]);
  });

  it("allows Apple Reminder to Apple Calendar conversion only when every selected reminder has a due date", () => {
    const undatedAppleTask = { ...appleTask, id: "apple-undated", dueDate: undefined };

    expect(actionIds([appleTask], {
      allowAppleReminderWriteback: true,
      allowAppleCalendarReminderConversion: true
    })).toContain("send-to-apple-calendar");
    expect(actionIds([appleTask, undatedAppleTask], {
      allowAppleReminderWriteback: true,
      allowAppleCalendarReminderConversion: true
    })).not.toContain("send-to-apple-calendar");
  });

  it("uses Dida writeback and delete capabilities for Dida task bulk actions", () => {
    expect(actionIds([didaTask], {})).toEqual(["open-source"]);
    expect(actionIds([didaTask], { allowDidaWriteback: true })).toEqual([
      "mark-complete",
      "open-source"
    ]);
    expect(actionIds([didaTask], { allowDidaWriteback: true, allowDidaDelete: true })).toEqual([
      "mark-complete",
      "open-source",
      "delete"
    ]);
  });
});

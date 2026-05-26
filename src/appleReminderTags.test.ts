import { appleReminderTitleWithTags, normalizeAppleReminderTags } from "./appleReminderTags";

describe("Apple Reminder tag helpers", () => {
  it("leaves titles unchanged when tag sync is disabled", () => {
    expect(appleReminderTitleWithTags("Pay invoice", ["#work"], false)).toBe("Pay invoice");
  });

  it("appends normalized tags to titles when tag sync is enabled", () => {
    expect(appleReminderTitleWithTags("Pay invoice", ["#work", "#client/acme"], true)).toBe("Pay invoice #work #client-acme");
  });

  it("normalizes, de-duplicates, and drops empty tags", () => {
    expect(normalizeAppleReminderTags(["#work", "#Work", "#client/acme", "#", "#a b"])).toEqual([
      "#work",
      "#client-acme",
      "#a-b"
    ]);
  });
});

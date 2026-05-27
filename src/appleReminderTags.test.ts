import { appleReminderTitleWithTags, extractAppleReminderTitleTags, mergeAppleReminderTags, normalizeAppleReminderTags } from "./appleReminderTags";

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

  it("extracts tags from free-form Apple Reminder titles", () => {
    expect(extractAppleReminderTitleTags("测试标签 #测试 #client/acme")).toEqual({
      title: "测试标签",
      tags: ["#测试", "#client-acme"]
    });
  });

  it("merges Apple Reminder title and native tags without duplicates", () => {
    expect(mergeAppleReminderTags(["#errand", "#client-acme"], ["errand", "#home"])).toEqual([
      "#errand",
      "#client-acme",
      "#home"
    ]);
  });
});

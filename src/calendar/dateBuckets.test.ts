import { getTaskDateBucket } from "./dateBuckets";

describe("getTaskDateBucket", () => {
  it("treats one week from today as future", () => {
    expect(getTaskDateBucket("2026-05-15", new Date("2026-05-08T12:00:00"))).toBe("future");
  });
});

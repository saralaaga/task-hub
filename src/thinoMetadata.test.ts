import { formatThinoCompatibleTimestamp, thinoIdFromIso } from "./thinoMetadata";

describe("thino metadata helpers", () => {
  it("derives Thino IDs from ISO timestamps", () => {
    expect(thinoIdFromIso("2026-07-13T13:15:11.125Z")).toBe("20260713131511");
  });

  it("formats UTC timestamps into local Thino timestamps with an explicit offset", () => {
    expect(formatThinoCompatibleTimestamp("2026-07-13T13:15:11.125Z", 8 * 60)).toBe("2026/07/13 21:15:11");
  });

  it("preserves local wall-clock timestamps without adding a timezone shift", () => {
    expect(formatThinoCompatibleTimestamp("2026-05-29T10:30:12")).toBe("2026/05/29 10:30:12");
  });

  it("leaves invalid timestamps untouched", () => {
    expect(formatThinoCompatibleTimestamp("not-a-date")).toBe("not-a-date");
  });
});

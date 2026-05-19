import { readFileSync } from "fs";
import * as path from "path";

describe("Task Hub styles", () => {
  it("places drag time feedback near the dragged card content instead of centered below it", () => {
    const styles = readFileSync(path.join(__dirname, "styles.css"), "utf8");
    const rule = styles.match(/\.task-hub-calendar-drag-feedback\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";

    expect(rule).toContain("left: clamp(36px, 16%, 56px)");
    expect(rule).toContain("top: clamp(28px, 38%, 44px)");
    expect(rule).toContain("position: fixed");
    expect(rule).toContain("color: color-mix(in srgb, var(--text-normal) 86%, black)");
    expect(rule).toContain("text-shadow: 0 1px 1px rgb(0 0 0 / 18%)");
    expect(rule).not.toContain("left: 50%");
    expect(rule).not.toContain("top: 50%");
    expect(rule).not.toContain("translate(-50%, -50%)");
  });
});

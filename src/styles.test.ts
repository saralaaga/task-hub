import { readFileSync } from "fs";
import * as path from "path";

describe("Task Hub styles", () => {
  it("keeps dense calendar item lists scrollable without shrinking cards", () => {
    const styles = readFileSync(path.join(__dirname, "styles.css"), "utf8");
    const monthRule = styles.match(/\.task-hub-calendar-day-items\s*>\s*\.task-hub-calendar-item\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const allDaySlotRule = styles.match(/\.task-hub-agenda-all-day-slot\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const allDayRule = styles.match(/\.task-hub-agenda-all-day-slot\s*>\s*\.task-hub-calendar-item\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";

    expect(monthRule).toContain("flex: 0 0 auto");
    expect(allDaySlotRule).toContain("grid-auto-rows: max-content");
    expect(allDayRule).toContain("flex: 0 0 auto");
    expect(allDayRule).toContain("min-height: max-content");
  });

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

  it("aligns calendar detail date/all-day with the start/end time columns", () => {
    const styles = readFileSync(path.join(__dirname, "styles.css"), "utf8");
    const dateRule = styles.match(/\.task-hub-calendar-detail-date-row\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const timeRule = styles.match(/\.task-hub-calendar-detail-time-row\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const headerWithSelectRule = styles.match(/\.task-hub-calendar-detail-header\.has-calendar-select\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const headerControlsRule = styles.match(/\.task-hub-calendar-detail-header-controls\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const headerSelectRule = styles.match(/\.task-hub-calendar-detail-header-select\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const closeRule = styles.match(/\.task-hub-calendar-detail-header\s*>\s*\.task-hub-icon-button\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";

    expect(dateRule).toContain("grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)");
    expect(timeRule).toContain("grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)");
    expect(headerWithSelectRule).toContain("grid-template-columns: minmax(0, 1fr) minmax(96px, 148px) 32px");
    expect(headerControlsRule).toContain("grid-column: 2");
    expect(headerControlsRule).toContain("grid-row: 1");
    expect(headerControlsRule).not.toContain("grid-column: 1 / -1");
    expect(headerControlsRule).not.toContain("grid-row: 2");
    expect(headerSelectRule).toContain("background: color-mix(in srgb, var(--task-hub-item-color, var(--interactive-accent)) 18%, var(--background-primary))");
    expect(headerSelectRule).toContain("color: var(--text-normal)");
    expect(headerSelectRule).toContain("font-weight: 400");
    expect(closeRule).toContain("border: 0");
    expect(closeRule).toContain("background: transparent");
  });

  it("renders Apple calendar color swatches as filled colors in settings", () => {
    const styles = readFileSync(path.join(__dirname, "styles.css"), "utf8");
    const swatchRule = styles.match(/\.task-hub-color-swatch\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const buttonSwatchRule = styles.match(/button\.task-hub-color-swatch,\s*body\s+\.task-hub-view\s+button\.task-hub-color-swatch\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const selectedSwatchRule = styles.match(/\.task-hub-color-swatch\.is-selected\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";

    expect(swatchRule).toContain("background: var(--task-hub-swatch-color)");
    expect(swatchRule).toContain("background-color: var(--task-hub-swatch-color)");
    expect(buttonSwatchRule).toContain("background: var(--task-hub-swatch-color)");
    expect(buttonSwatchRule).toContain("background-image: none");
    expect(selectedSwatchRule).toContain("inset 0 0 0 3px color-mix(in srgb, var(--task-hub-swatch-color) 72%, white)");
    expect(selectedSwatchRule).not.toContain("inset 0 0 0 2px var(--background-primary)");
  });

  it("keeps the calendar creation modal narrow with aligned controls", () => {
    const styles = readFileSync(path.join(__dirname, "styles.css"), "utf8");
    const modalRule = styles.match(/\.task-hub-create-modal\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const rowRule = styles.match(/\.task-hub-create-modal\s+\.setting-item\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const infoRule = styles.match(/\.task-hub-create-modal\s+\.setting-item-info\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const controlRule = styles.match(/\.task-hub-create-modal\s+\.setting-item-control\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const textareaRule = styles.match(/\.task-hub-create-modal\s+\.setting-item-control\s+textarea\s*\{(?<body>\s*min-height:[^}]+)\}/)?.groups?.body ?? "";

    expect(modalRule).toContain("width: min(560px, calc(100vw - 32px))");
    expect(rowRule).toContain("grid-template-columns: minmax(0, 1fr) minmax(220px, 280px)");
    expect(infoRule).toContain("text-align: left");
    expect(controlRule).toContain("justify-content: end");
    expect(textareaRule).toContain("min-height: 96px");
  });
});

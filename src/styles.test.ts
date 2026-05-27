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

  it("renders tag view chips with white lightweight text and lifted shadows", () => {
    const styles = readFileSync(path.join(__dirname, "styles.css"), "utf8");
    const tagViewChipRule = styles.match(/\.task-hub-tag-task\s+\.task-hub-task-tag\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const contextChipRule = styles.match(/\.task-hub-tag-task\.is-context\s+\.task-hub-task-tag\s*\{(?<body>[^}]+)\}/g)?.at(-1) ?? "";

    expect(tagViewChipRule).toContain("color: white");
    expect(tagViewChipRule).toContain("font-weight: 400");
    expect(tagViewChipRule).toContain("0 3px 8px color-mix(in srgb, var(--task-hub-source-color) 28%, transparent)");
    expect(tagViewChipRule).toContain("0 1px 2px rgb(0 0 0 / 16%)");
    expect(contextChipRule).toContain("color: white");
    expect(contextChipRule).toContain("font-weight: 400");
  });

  it("renders task list chips with white lightweight text and lifted shadows", () => {
    const styles = readFileSync(path.join(__dirname, "styles.css"), "utf8");
    const taskListChipRule = styles.match(/\.task-hub-task-row\s+\.task-hub-task-tag\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";

    expect(taskListChipRule).toContain("color: white");
    expect(taskListChipRule).toContain("font-weight: 400");
    expect(taskListChipRule).toContain("0 3px 8px color-mix(in srgb, var(--task-hub-source-color) 28%, transparent)");
    expect(taskListChipRule).toContain("0 1px 2px rgb(0 0 0 / 16%)");
  });

  it("keeps task content text lightweight in task and calendar cards", () => {
    const styles = readFileSync(path.join(__dirname, "styles.css"), "utf8");
    const taskTextRule = styles.match(/\.task-hub-task-text\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const calendarTitleRule = Array.from(styles.matchAll(/\.task-hub-calendar-item-title\s*\{(?<body>[^}]+)\}/g))
      .map((match) => match.groups?.body ?? "")
      .find((body) => body.includes("font-size")) ?? "";

    expect(taskTextRule).toContain("font-weight: 400");
    expect(calendarTitleRule).toContain("font-weight: 400");
  });

  it("keeps source filtering inside the condition panel instead of a task sidebar", () => {
    const styles = readFileSync(path.join(__dirname, "styles.css"), "utf8");
    const workbenchRule = styles.match(/\.task-hub-task-workbench\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const chipRule = styles.match(/\.task-hub-source-filter-chip\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const activeChipRule = styles.match(/\.task-hub-source-filter-chip:hover,\s*\.task-hub-source-filter-chip:focus-visible,\s*\.task-hub-source-filter-chip\.is-active\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";

    expect(workbenchRule).toContain("grid-template-columns: minmax(0, 1fr) auto");
    expect(styles).not.toContain(".task-hub-task-sidebar {");
    expect(chipRule).toContain("display: inline-flex");
    expect(chipRule).toContain("border-radius: 7px");
    expect(activeChipRule).toContain("var(--interactive-accent)");
  });

  it("centers the task list at a comfortable responsive width", () => {
    const styles = readFileSync(path.join(__dirname, "styles.css"), "utf8");
    const paneRule = styles.match(/\.task-hub-task-list-pane\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const sectionRule = styles.match(/\.task-hub-task-section\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";

    expect(paneRule).toContain("justify-items: center");
    expect(paneRule).toContain("padding-inline: clamp(4px, 2vw, 24px)");
    expect(sectionRule).toContain("margin-inline: auto");
    expect(sectionRule).toContain("width: min(760px, 100%)");
  });

  it("keeps task details moderately wide without horizontal resize scrollbars", () => {
    const styles = readFileSync(path.join(__dirname, "styles.css"), "utf8");
    const detailsRules = Array.from(styles.matchAll(/\.task-hub-task-details\s*\{(?<body>[^}]+)\}/g)).map((match) => match.groups?.body ?? "");
    const sizingRule = detailsRules.find((body) => body.includes("max-height")) ?? "";
    const actionRule = styles.match(/\.task-hub-detail-actions\.has-three-actions\.is-long-language\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";

    expect(sizingRule).toContain("overflow-x: hidden");
    expect(sizingRule).toContain("overflow-y: auto");
    expect(sizingRule).toContain("resize: none");
    expect(sizingRule).toContain("width: clamp(300px, 24vw, 460px)");
    expect(actionRule).toContain("grid-template-columns: repeat(3, minmax(72px, 1fr))");
  });

  it("animates completed task rows out when hidden by the open-task filter", () => {
    const styles = readFileSync(path.join(__dirname, "styles.css"), "utf8");
    const exitingRule = styles.match(/\.task-hub-task-row\.is-exiting\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const keyframes = styles.match(/@keyframes task-hub-complete-exit\s*\{(?<body>[\s\S]+?)\n\}/)?.groups?.body ?? "";

    expect(exitingRule).toContain("animation: task-hub-complete-exit 360ms ease-in forwards");
    expect(exitingRule).toContain("pointer-events: none");
    expect(keyframes).toContain("opacity: 0");
    expect(keyframes).toContain("max-height: 0");
  });
});

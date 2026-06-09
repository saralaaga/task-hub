import { readFileSync } from "fs";
import * as path from "path";

describe("Task Hub styles", () => {
  it("keeps dense calendar item lists scrollable without shrinking cards", () => {
    const styles = readFileSync(path.join(__dirname, "styles.css"), "utf8");
    const monthRule = styles.match(/\.task-hub-calendar-day-items\s*>\s*\.task-hub-calendar-item\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const allDaySlotRule = styles.match(/\.task-hub-agenda-all-day-slot\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const fitAllDaySlotRule = styles.match(/\.task-hub-agenda\.is-scale-fit\s+\.task-hub-agenda-all-day-slot\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const allDayRule = styles.match(/\.task-hub-agenda-all-day-slot\s*>\s*\.task-hub-calendar-item\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";

    expect(monthRule).toContain("flex: 0 0 auto");
    expect(allDaySlotRule).toContain("grid-auto-rows: max-content");
    expect(fitAllDaySlotRule).toContain("max-height: 86px");
    expect(allDayRule).toContain("flex: 0 0 auto");
    expect(allDayRule).toContain("min-height: max-content");
  });

  it("uses content-only calendar rows in month view and the coarsest agenda scale", () => {
    const styles = readFileSync(path.join(__dirname, "styles.css"), "utf8");
    const compactItemRule = styles.match(/\.task-hub-calendar-month\s+\.task-hub-calendar-item,\s*\.task-hub-agenda\.is-scale-fit\s+\.task-hub-calendar-item\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const compactCompletedRule = styles.match(/\.task-hub-calendar-month\s+\.task-hub-calendar-item\.is-completed,\s*\.task-hub-agenda\.is-scale-fit\s+\.task-hub-calendar-item\.is-completed\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const compactSelectedRule = styles.match(/\.task-hub-calendar-month\s+\.task-hub-calendar-item\.is-selected,\s*\.task-hub-agenda\.is-scale-fit\s+\.task-hub-calendar-item\.is-selected\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const compactTitleRule = styles.match(/\.task-hub-calendar-month\s+\.task-hub-calendar-item\.is-selected\s+\.task-hub-calendar-item-title,\s*\.task-hub-agenda\.is-scale-fit\s+\.task-hub-calendar-item\.is-selected\s+\.task-hub-calendar-item-title\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const compactItemListRule = styles.match(/\.task-hub-calendar-month\s+\.task-hub-calendar-day-items\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const compactFitAllDayRule = styles.match(/\.task-hub-agenda\.is-scale-fit\s+\.task-hub-agenda-all-day-slot\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";

    const compactBodyRule = styles.match(/\.task-hub-calendar-month\s+\.task-hub-calendar-item-body,\s*\.task-hub-agenda\.is-scale-fit\s+\.task-hub-calendar-item-body\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const compactAccentRule = styles.match(/\.task-hub-calendar-month\s+\.task-hub-calendar-item-body::before,\s*\.task-hub-agenda\.is-scale-fit\s+\.task-hub-calendar-item-body::before\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const checkboxRule = styles.match(/\.task-hub-calendar-item\.has-checkbox\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const compactEventAlignmentRule = styles.match(/\.task-hub-calendar-month\s+\.task-hub-calendar-item:not\(\.has-checkbox\),\s*\.task-hub-agenda\.is-scale-fit\s+\.task-hub-calendar-item:not\(\.has-checkbox\)\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const compactEventBodyRule = styles.match(/\.task-hub-calendar-month\s+\.task-hub-calendar-item:not\(\.has-checkbox\)\s+\.task-hub-calendar-item-body,\s*\.task-hub-agenda\.is-scale-fit\s+\.task-hub-calendar-item:not\(\.has-checkbox\)\s+\.task-hub-calendar-item-body\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";

    expect(compactItemRule).toContain("background: transparent");
    expect(compactItemRule).toContain("border-left: 0");
    expect(compactItemRule).toContain("border-radius: 0");
    expect(compactItemRule).toContain("box-shadow: none");
    expect(compactItemRule).toContain("padding: 0");
    expect(compactBodyRule).toContain("padding-left: 9px");
    expect(compactBodyRule).toContain("position: relative");
    expect(checkboxRule).toContain("grid-template-columns: 18px minmax(0, 1fr)");
    expect(compactEventAlignmentRule).toContain("grid-template-columns: 18px minmax(0, 1fr)");
    expect(compactEventBodyRule).toContain("grid-column: 2");
    expect(compactAccentRule).toContain("border-radius: 999px");
    expect(compactAccentRule).toContain("height: 0.85em");
    expect(compactAccentRule).toContain("top: 0.2em");
    expect(compactAccentRule).toContain("width: 4px");
    expect(compactAccentRule).toContain("box-shadow: 0 1px 2px color-mix(in srgb, var(--task-hub-item-color) 34%, transparent)");
    expect(compactCompletedRule).toContain("background: transparent");
    expect(compactCompletedRule).toContain("border-left-color: transparent");
    expect(compactSelectedRule).toContain("background: transparent");
    expect(compactSelectedRule).toContain("box-shadow: none");
    expect(compactSelectedRule).toContain("border-left-color: transparent");
    expect(compactTitleRule).toContain("color: var(--text-normal)");
    expect(compactItemListRule).toContain("gap: 2px");
    expect(compactFitAllDayRule).toContain("gap: 2px");
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
    const alertRule = styles.match(/\.task-hub-reminder-alert-row,\s*\.task-hub-create-alert-row\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const headerWithSelectRule = styles.match(/\.task-hub-calendar-detail-header\.has-calendar-select\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const headerControlsRule = styles.match(/\.task-hub-calendar-detail-header-controls\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const headerSelectRule = styles.match(/\.task-hub-calendar-detail-header-select\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const closeRule = styles.match(/\.task-hub-calendar-detail-header\s*>\s*\.task-hub-icon-button\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const popoverRule = styles.match(/\.task-hub-calendar-detail-popover\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const popoverKeyframes = styles.match(/@keyframes task-hub-calendar-detail-popover-enter\s*\{(?<body>[\s\S]+?)\n\}/)?.groups?.body ?? "";
    const detailRowRule = styles.match(/\.task-hub-detail-row\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const detailControlCheckboxRule = styles.match(/\.task-hub-calendar-detail-row\s+\.task-hub-detail-control\s+input\[type="checkbox"\]\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const reducedMotionRule = styles.match(/@media \(prefers-reduced-motion: reduce\)\s*\{(?<body>[\s\S]+?)\n\}/)?.groups?.body ?? "";

    expect(popoverRule).toContain("animation: task-hub-calendar-detail-popover-enter 180ms cubic-bezier(0.2, 0.9, 0.2, 1) both");
    expect(popoverRule).toContain("transform-origin: 32px 32px");
    expect(popoverKeyframes).toContain("transform: translateY(10px) scale(0.96)");
    expect(reducedMotionRule).toContain(".task-hub-calendar-detail-popover");
    expect(detailRowRule).toContain("grid-template-columns: 36px var(--task-hub-detail-label-width, 128px) minmax(0, 1fr)");
    expect(detailControlCheckboxRule).toContain("height: 18px");
    expect(detailControlCheckboxRule).toContain("min-height: 18px");
    expect(detailControlCheckboxRule).toContain("width: 18px");
    expect(detailControlCheckboxRule).toContain("padding: 0");
    expect(dateRule).toContain("grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)");
    expect(timeRule).toContain("grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)");
    expect(alertRule).toContain("grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)");
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
    const modalEnterKeyframes = styles.match(/@keyframes task-hub-create-modal-enter\s*\{(?<body>[\s\S]+?)\n\}/)?.groups?.body ?? "";
    const reducedMotionRule = styles.match(/@media \(prefers-reduced-motion: reduce\)\s*\{(?<body>[\s\S]+?)\n\}/)?.groups?.body ?? "";
    const rowRule = styles.match(/\.task-hub-create-modal\s+\.setting-item\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const infoRule = styles.match(/\.task-hub-create-modal\s+\.setting-item-info\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const controlRule = styles.match(/\.task-hub-create-modal\s+\.setting-item-control\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const scheduleControlRule = styles.match(/\.task-hub-create-schedule-setting\s+\.setting-item-control\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const pickerRule = styles.match(/\.task-hub-create-picker\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const datePickerRule = styles.match(/\.task-hub-create-date-picker\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const pickerInputRule = styles.match(/\.task-hub-create-picker\s+input\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const pickerIndicatorRule = styles.match(/\.task-hub-create-picker\s+input::-webkit-calendar-picker-indicator\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const pickerControlInputRule = styles.match(/\.task-hub-create-modal\s+\.setting-item-control\s+\.task-hub-create-picker\s+input\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const alertSettingRule = styles.match(/\.task-hub-create-alert-setting\s+\.setting-item-control\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const alertCheckboxRule = styles.match(/\.task-hub-create-modal\s+\.task-hub-create-alert-setting\s+input\.task-hub-reminder-alert-toggle\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const textareaRule = styles.match(/\.task-hub-create-modal\s+\.setting-item-control\s+textarea\s*\{(?<body>\s*min-height:[^}]+)\}/)?.groups?.body ?? "";

    expect(modalRule).toContain("width: min(560px, calc(100vw - 32px))");
    expect(modalRule).toContain("animation: task-hub-create-modal-enter 160ms cubic-bezier(0.2, 0.9, 0.2, 1) both");
    expect(modalEnterKeyframes).toContain("transform: translateY(8px) scale(0.96)");
    expect(reducedMotionRule).toContain(".task-hub-create-modal");
    expect(rowRule).toContain("grid-template-columns: minmax(0, 1fr) minmax(220px, 280px)");
    expect(infoRule).toContain("text-align: left");
    expect(controlRule).toContain("justify-content: end");
    expect(scheduleControlRule).toContain("grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)");
    expect(pickerRule).toContain("width: min(132px, 100%)");
    expect(datePickerRule).toContain("width: min(164px, 100%)");
    expect(pickerInputRule).toContain("appearance: none");
    expect(pickerInputRule).toContain("font-family: var(--font-interface)");
    expect(pickerInputRule).toContain("font-variant-numeric: tabular-nums");
    expect(pickerInputRule).toContain("padding: 0 10px 0 36px");
    expect(pickerIndicatorRule).toContain("display: none");
    expect(pickerIndicatorRule).toContain("-webkit-appearance: none");
    expect(pickerIndicatorRule).toContain("width: 0");
    expect(pickerControlInputRule).toContain("width: 100%");
    expect(alertSettingRule).toContain("grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)");
    expect(alertCheckboxRule).toContain("height: 18px");
    expect(alertCheckboxRule).toContain("max-width: 18px");
    expect(alertCheckboxRule).toContain("min-width: 18px");
    expect(alertCheckboxRule).toContain("width: 18px !important");
    expect(textareaRule).toContain("min-height: 96px");
  });

  it("hides Obsidian metadata containers inside task note modals when frontmatter is disabled", () => {
    const styles = readFileSync(path.join(__dirname, "styles.css"), "utf8");
    const modalRule = styles.match(/\.task-hub-note-modal-hide-frontmatter\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";

    expect(modalRule).toContain("--metadata-display-editing: none");
    expect(modalRule).toContain("--metadata-display-reading: none");
    expect(styles).toContain(".task-hub-note-modal-hide-frontmatter .metadata-container");
    expect(styles).toContain(".task-hub-note-modal-hide-frontmatter .metadata-properties");
    expect(styles).toContain(".task-hub-note-modal-hide-frontmatter .metadata-add-button");
    expect(styles).toContain(".task-hub-note-modal-hide-frontmatter .frontmatter-container");
    expect(styles).toContain("display: none !important");
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

  it("renders editable tag chips as an Obsidian-style property value, not a visible input box", () => {
    const styles = readFileSync(path.join(__dirname, "styles.css"), "utf8");
    const editorRule = styles.match(/\.task-hub-tag-editor\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const hoverRule = styles.match(/\.task-hub-tag-editor:hover\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const focusRule = styles.match(/\.task-hub-tag-editor:focus-within\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const placeholderRule = styles.match(/\.task-hub-tag-editor-placeholder\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const inputRule = styles.match(/\.task-hub-tag-editor-input\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const chipRule = styles.match(/\.task-hub-tag-editor-chip\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";

    expect(editorRule).toContain("background: transparent");
    expect(editorRule).toContain("border: 1px solid transparent");
    expect(editorRule).toContain("border-radius: 4px");
    expect(editorRule).toContain("cursor: text");
    expect(editorRule).toContain("padding: 2px 6px");
    expect(hoverRule).toContain("background: var(--background-modifier-hover)");
    expect(focusRule).toContain("box-shadow: none");
    expect(placeholderRule).toContain("color: var(--text-faint)");
    expect(inputRule).toContain("background: transparent !important");
    expect(inputRule).toContain("border: 0 !important");
    expect(inputRule).toContain("min-width: 1ch");
    expect(chipRule).toContain("background: color-mix(in srgb, var(--task-hub-source-color, var(--interactive-accent)) 12%, var(--background-secondary))");
    expect(chipRule).toContain("color: var(--text-normal)");
  });

  it("keeps task detail reminder controls aligned with the shared input column", () => {
    const styles = readFileSync(path.join(__dirname, "styles.css"), "utf8");
    const detailRowRule = styles.match(/\.task-hub-detail-row\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const reminderDetailOverride = styles.match(/\.task-hub-reminder-alert-row\.task-hub-detail-row\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const detailExtraExpandingRule = styles.match(/\.task-hub-detail-extra\.is-expanding\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const detailExtraHiddenRule = styles.match(/\.task-hub-detail-extra\.is-hidden,\s*\.task-hub-detail-extra\.is-opening,\s*\.task-hub-detail-extra\.is-closing\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const reducedMotionRule = styles.match(/@media \(prefers-reduced-motion: reduce\)\s*\{(?<body>[\s\S]+?)\n\}/)?.groups?.body ?? "";

    expect(detailRowRule).toContain("grid-template-columns: 36px var(--task-hub-detail-label-width, 128px) minmax(0, 1fr)");
    expect(reminderDetailOverride).not.toContain("grid-template-columns");
    expect(detailExtraExpandingRule).toContain("max-height 220ms cubic-bezier(0.2, 0.85, 0.25, 1)");
    expect(detailExtraExpandingRule).toContain("overflow: clip");
    expect(detailExtraHiddenRule).toContain("opacity: 0");
    expect(detailExtraHiddenRule).toContain("transform: translateY(-8px)");
    expect(reducedMotionRule).toContain(".task-hub-detail-extra.is-expanding");
  });

  it("animates the unscheduled side panel open and closed", () => {
    const styles = readFileSync(path.join(__dirname, "styles.css"), "utf8");
    const panelRule = styles.match(/\.task-hub-unscheduled-panel\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const closingRule = styles.match(/\.task-hub-unscheduled-panel\.is-closing\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const hostClosingRule = styles.match(/\.task-hub-calendar-with-sidebar\.is-unscheduled-closing\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const paneOpenRule = styles.match(/\.task-hub-calendar-with-sidebar\.is-unscheduled-open\s+\.task-hub-calendar-pane\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const paneClosingRule = styles.match(/\.task-hub-calendar-with-sidebar\.is-unscheduled-closing\s+\.task-hub-calendar-pane\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const enterKeyframes = styles.match(/@keyframes task-hub-unscheduled-panel-enter\s*\{(?<body>[\s\S]+?)\n\}/)?.groups?.body ?? "";
    const exitKeyframes = styles.match(/@keyframes task-hub-unscheduled-panel-exit\s*\{(?<body>[\s\S]+?)\n\}/)?.groups?.body ?? "";
    const paneOpenKeyframes = styles.match(/@keyframes task-hub-calendar-pane-make-room\s*\{(?<body>[\s\S]+?)\n\}/)?.groups?.body ?? "";
    const paneCloseKeyframes = styles.match(/@keyframes task-hub-calendar-pane-restore-room\s*\{(?<body>[\s\S]+?)\n\}/)?.groups?.body ?? "";
    const reducedMotionRule = styles.match(/@media \(prefers-reduced-motion: reduce\)\s*\{(?<body>[\s\S]+?)\n\}/)?.groups?.body ?? "";

    expect(panelRule).toContain("animation: task-hub-unscheduled-panel-enter 220ms cubic-bezier(0.2, 0.85, 0.25, 1) both");
    expect(panelRule).toContain("transform-origin: right center");
    expect(hostClosingRule).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(closingRule).toContain("animation: task-hub-unscheduled-panel-exit 190ms cubic-bezier(0.4, 0, 0.2, 1) both");
    expect(closingRule).toContain("position: absolute");
    expect(closingRule).toContain("right: 0");
    expect(paneOpenRule).toContain("animation: task-hub-calendar-pane-make-room 220ms cubic-bezier(0.2, 0.85, 0.25, 1) both");
    expect(paneClosingRule).toContain("animation: task-hub-calendar-pane-restore-room 190ms cubic-bezier(0.4, 0, 0.2, 1) both");
    expect(enterKeyframes).toContain("clip-path: inset(0 0 0 100%)");
    expect(exitKeyframes).toContain("transform: translateX(18px) scaleX(0.96)");
    expect(paneOpenKeyframes).toContain("transform: translateX(12px) scaleX(1.012)");
    expect(paneCloseKeyframes).toContain("transform: translateX(10px) scaleX(1.01)");
    expect(reducedMotionRule).toContain(".task-hub-calendar-with-sidebar .task-hub-calendar-pane");
    expect(reducedMotionRule).toContain(".task-hub-unscheduled-panel");
  });

  it("animates calendar mode switches horizontally", () => {
    const styles = readFileSync(path.join(__dirname, "styles.css"), "utf8");
    const leftRule = styles.match(/\.task-hub-calendar-view-stage\.is-slide-left\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const rightRule = styles.match(/\.task-hub-calendar-view-stage\.is-slide-right\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const leftKeyframes = styles.match(/@keyframes task-hub-calendar-view-slide-left\s*\{(?<body>[\s\S]+?)\n\}/)?.groups?.body ?? "";
    const rightKeyframes = styles.match(/@keyframes task-hub-calendar-view-slide-right\s*\{(?<body>[\s\S]+?)\n\}/)?.groups?.body ?? "";
    const reducedMotionRule = styles.match(/@media \(prefers-reduced-motion: reduce\)\s*\{(?<body>[\s\S]+?)\n\}/)?.groups?.body ?? "";

    expect(leftRule).toContain("animation: task-hub-calendar-view-slide-left 240ms cubic-bezier(0.2, 0.85, 0.25, 1) both");
    expect(rightRule).toContain("animation: task-hub-calendar-view-slide-right 240ms cubic-bezier(0.2, 0.85, 0.25, 1) both");
    expect(leftKeyframes).toContain("transform: translateX(34px) scale(0.985)");
    expect(rightKeyframes).toContain("transform: translateX(-34px) scale(0.985)");
    expect(reducedMotionRule).toContain(".task-hub-calendar-view-stage.is-slide-left");
    expect(reducedMotionRule).toContain(".task-hub-calendar-view-stage.is-slide-right");
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
    const shellRule = detailsRules.find((body) => body.includes("--task-hub-detail-label-width")) ?? "";
    const actionRule = styles.match(/\.task-hub-detail-actions\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const sendButtonRule = styles.match(/\.task-hub-send-control button\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const sendTargetRule = styles.match(/\.task-hub-send-target-trigger\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";

    expect(sizingRule).toContain("overflow-x: hidden");
    expect(sizingRule).toContain("overflow-y: auto");
    expect(sizingRule).toContain("resize: none");
    expect(sizingRule).toContain("width: clamp(420px, 34vw, 620px)");
    expect(shellRule).toContain("--task-hub-detail-label-width: 92px");
    expect(actionRule).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(sendButtonRule).toContain("border-radius: 8px");
    expect(sendButtonRule).toContain("height: 38px");
    expect(sendTargetRule).toContain("border-radius: 8px");
    expect(sendTargetRule).toContain("height: 38px");
    expect(sendTargetRule).toContain("min-height: 38px");
    expect(styles).not.toContain(".task-hub-detail-save");
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

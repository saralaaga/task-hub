import { readFileSync } from "fs";
import * as path from "path";

describe("Task Hub styles", () => {
  it("keeps dense calendar item lists scrollable without shrinking cards", () => {
    const styles = readFileSync(path.join(__dirname, "styles.css"), "utf8");
    const dayAgendaRule = styles.match(/\.task-hub-agenda-day\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const monthRule = styles.match(/\.task-hub-calendar-day-items\s*>\s*\.task-hub-calendar-item\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const allDaySlotRule = styles.match(/\.task-hub-agenda-all-day-slot\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const dayAllDayStickyRule = styles.match(/\.task-hub-agenda-day\s+\.task-hub-agenda-all-day-slot\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const dayAllDayLabelStickyRule = styles.match(/\.task-hub-agenda-day\s+\.task-hub-agenda-all-day-label\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const fitAllDaySlotRule = styles.match(/\.task-hub-agenda\.is-scale-fit\s+\.task-hub-agenda-all-day-slot\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const allDayRule = styles.match(/\.task-hub-agenda-all-day-slot\s*>\s*\.task-hub-calendar-item\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";

    expect(dayAgendaRule).toContain("overflow: visible");
    expect(monthRule).toContain("flex: 0 0 auto");
    expect(allDaySlotRule).toContain("grid-auto-rows: max-content");
    expect(dayAllDayStickyRule).toContain("position: sticky");
    expect(dayAllDayStickyRule).toContain("top: var(--task-hub-agenda-header-sticky-offset)");
    expect(dayAllDayLabelStickyRule).toContain("top: var(--task-hub-agenda-header-sticky-offset)");
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

  it("keeps the condition filter popover above sticky calendar headers", () => {
    const styles = readFileSync(path.join(__dirname, "styles.css"), "utf8");
    const toolbarRule = styles.match(/\.task-hub-toolbar\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const filterStripRule = styles.match(/\.task-hub-filter-strip\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const conditionMenuRule = styles.match(/\.task-hub-condition-menu\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const conditionPanelRule = styles.match(/\.task-hub-condition-panel\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";

    expect(toolbarRule).toContain("position: relative");
    expect(toolbarRule).toContain("z-index: 30");
    expect(filterStripRule).toContain("position: relative");
    expect(filterStripRule).toContain("z-index: 31");
    expect(conditionMenuRule).toContain("z-index: 40");
    expect(conditionPanelRule).toContain("z-index: 41");
  });

  it("keeps the task filter popover above task list checkboxes", () => {
    const styles = readFileSync(path.join(__dirname, "styles.css"), "utf8");
    const sidebarRule = styles.match(/\.task-hub-task-filter-sidebar\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const paneRule = styles.match(/\.task-hub-task-list-pane\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const detailsHostRule = styles.match(/\.task-hub-task-details-host\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const workbenchRule = styles.match(/\.task-hub-task-workbench\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const mobileRule = styles.match(/@media \(max-width: 720px\)\s*\{(?<body>[\s\S]+?)\n\}/)?.groups?.body ?? "";

    expect(workbenchRule).toContain("--task-hub-task-list-first-row-offset: calc(var(--font-ui-large) * 1.25 + 14px)");
    expect(sidebarRule).toContain("position: sticky");
    expect(sidebarRule).toContain("overflow: visible");
    expect(sidebarRule).toContain("margin-top: var(--task-hub-task-list-first-row-offset)");
    expect(sidebarRule).toContain("max-height: calc(100vh - 190px - var(--task-hub-task-list-first-row-offset))");
    expect(sidebarRule).toContain("z-index: 50");
    expect(paneRule).toContain("position: relative");
    expect(paneRule).toContain("z-index: 0");
    expect(detailsHostRule).toContain("margin-top: var(--task-hub-task-list-first-row-offset)");
    expect(detailsHostRule).toContain("max-height: calc(100vh - 190px - var(--task-hub-task-list-first-row-offset))");
    expect(detailsHostRule).toContain("position: relative");
    expect(detailsHostRule).toContain("z-index: 0");
    expect(mobileRule).toContain("--task-hub-task-list-first-row-offset: 0px");
  });

  it("renders task list rows as compact dividers instead of tall cards", () => {
    const styles = readFileSync(path.join(__dirname, "styles.css"), "utf8");
    const flowRule = styles.match(/\.task-hub-task-list-flow\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const rowRule = styles.match(/\.task-hub-task-list-flow\s+\.task-hub-task-row\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const bulkDragRule = styles.match(/\.task-hub-task-row\.is-bulk-dragging\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const subtaskListRule = styles.match(/\.task-hub-task-list-flow\s+\.task-hub-subtask-list\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const textRule = styles.match(/\.task-hub-task-list-flow\s+\.task-hub-task-text\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const tagRule = styles.match(/\.task-hub-task-list-flow\s+\.task-hub-task-row\s+\.task-hub-task-tag,\s*\.task-hub-tag-editor\s+\.task-hub-task-tag\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";

    expect(flowRule).toContain("gap: 0");
    expect(rowRule).toContain("background: transparent");
    expect(rowRule).toContain("border-bottom: 1px solid");
    expect(rowRule).toContain("border-left: 3px solid");
    expect(rowRule).toContain("border-radius: 0");
    expect(rowRule).toContain("min-height: 32px");
    expect(bulkDragRule).toContain("opacity: 0.68");
    expect(bulkDragRule).toContain("box-shadow:");
    expect(subtaskListRule).toContain("margin-left: 19px");
    expect(textRule).toContain("line-height: 1.2");
    expect(tagRule).toContain("box-shadow:");
    expect(tagRule).toContain("font-size: var(--font-ui-medium)");
  });

  it("keeps smart list selection styled as one compact row", () => {
    const styles = readFileSync(path.join(__dirname, "styles.css"), "utf8");
    const cardRule = styles.match(/\.task-hub-smart-list-card\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const itemRule = styles.match(/\.task-hub-smart-list-item\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const headerActionsRule = styles.match(/\.task-hub-smart-list-header-actions\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const removeRule = styles.match(/\.task-hub-smart-list-remove-drop\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const removeDropRule = styles.match(/\.task-hub-smart-list-remove-drop\.is-drop-target\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const hoverRule = styles.match(/\.task-hub-smart-list-item:hover\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const activeRule = styles.match(/\.task-hub-smart-list-item\.is-active\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const dropRule = styles.match(/\.task-hub-smart-list-item\.is-drop-target\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const applyButtonRule = styles.match(/button\.task-hub-smart-list-apply,\s*body\s+\.task-hub-view\s+button\.task-hub-smart-list-apply\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const applyButtonHoverRule = styles.match(/button\.task-hub-smart-list-apply:hover,\s*button\.task-hub-smart-list-apply:focus-visible,\s*body\s+\.task-hub-view\s+button\.task-hub-smart-list-apply:hover,\s*body\s+\.task-hub-view\s+button\.task-hub-smart-list-apply:focus-visible\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const renameInputRule = styles.match(/\.task-hub-smart-list-rename-input\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const contextMenuRule = styles.match(/\.task-hub-smart-list-context-menu\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const contextActionRule = styles.match(/\.task-hub-smart-list-context-action,\s*\.task-hub-smart-list-color-action\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const contextGroupDividerRule = styles.match(/\.task-hub-smart-list-context-group\s+\+\s+\.task-hub-smart-list-context-action\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const contextSeparatorRule = styles.match(/\.task-hub-smart-list-context-separator\.menu-separator\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const colorSubmenuRule = styles.match(/\.task-hub-smart-list-color-submenu\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const colorSubmenuOpenRule = styles.match(/\.task-hub-smart-list-context-group:hover\s*>\s*\.task-hub-smart-list-color-submenu,\s*\.task-hub-smart-list-context-group:focus-within\s*>\s*\.task-hub-smart-list-color-submenu\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const dotRule = styles.match(/\.task-hub-smart-list-menu-color-dot\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";

    expect(cardRule).not.toContain("border:");
    expect(headerActionsRule).toContain("display: flex");
    expect(removeRule).toContain("display: inline-flex");
    expect(removeRule).toContain("color: var(--text-muted)");
    expect(removeRule).not.toContain("background:");
    expect(removeDropRule).toContain("outline: 1px solid var(--text-error)");
    expect(removeDropRule).not.toContain("background:");
    expect(itemRule).toContain("background: color-mix(in srgb, var(--task-hub-smart-list-color, var(--interactive-accent)) 7%, transparent)");
    expect(itemRule).toContain("border: 0");
    expect(itemRule).toContain("box-shadow: none");
    expect(itemRule).toContain("background-color 300ms ease");
    expect(itemRule).not.toContain("border-left:");
    expect(hoverRule).toContain("background: color-mix(in srgb, var(--task-hub-smart-list-color, var(--interactive-accent)) 12%, transparent)");
    expect(activeRule).toContain("background: color-mix(in srgb, var(--task-hub-smart-list-color, var(--interactive-accent)) 28%, transparent)");
    expect(activeRule).toContain("box-shadow: inset 3px 0 0 var(--task-hub-smart-list-color, var(--interactive-accent))");
    expect(dropRule).toContain("outline: 1px solid var(--task-hub-smart-list-color, var(--interactive-accent))");
    expect(applyButtonRule).toContain("background: transparent !important");
    expect(applyButtonRule).toContain("background-color: transparent !important");
    expect(applyButtonRule).toContain("background-image: none !important");
    expect(applyButtonRule).toContain("border: 0 !important");
    expect(applyButtonRule).toContain("box-shadow: none !important");
    expect(applyButtonRule).toContain("--button-shadow: none");
    expect(applyButtonRule).toContain("--button-shadow-hover: none");
    expect(applyButtonHoverRule).toContain("background: transparent !important");
    expect(renameInputRule).toContain("height: 32px");
    expect(renameInputRule).toContain("width: 100%");
    expect(contextMenuRule).toContain("position: fixed");
    expect(contextMenuRule).toContain("overflow: visible");
    expect(contextMenuRule).not.toContain("background:");
    expect(contextMenuRule).not.toContain("border:");
    expect(contextMenuRule).not.toContain("box-shadow:");
    expect(contextActionRule).toContain("font-size: var(--font-ui-medium)");
    expect(contextActionRule).toContain("line-height: 1.25");
    expect(contextActionRule).toContain("min-height: 38px");
    expect(contextActionRule).toContain("padding: 7px 16px");
    expect(contextGroupDividerRule).toContain("border-top: 1px solid var(--background-modifier-border)");
    expect(contextSeparatorRule).toContain("box-sizing: border-box");
    expect(contextSeparatorRule).toContain("margin: 4px 0");
    expect(contextSeparatorRule).toContain("width: 100%");
    expect(colorSubmenuRule).toContain("display: none");
    expect(colorSubmenuRule).toContain("position: fixed");
    expect(colorSubmenuRule).toContain("z-index: 1001");
    expect(colorSubmenuRule).not.toContain("background:");
    expect(colorSubmenuRule).not.toContain("border:");
    expect(colorSubmenuRule).not.toContain("box-shadow:");
    expect(colorSubmenuOpenRule).toContain("display: grid");
    expect(dotRule).toContain("background: var(--task-hub-smart-list-menu-color, var(--interactive-accent))");
    expect(dotRule).toContain("border-radius: 999px");
    expect(styles).not.toContain("task-hub-smart-list-delete");
  });

  it("animates task progress bars when recursive completion percentages change", () => {
    const styles = readFileSync(path.join(__dirname, "styles.css"), "utf8");
    const fillRule = styles.match(/\.task-hub-task-progress-fill\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const valueRule = styles.match(/\.task-hub-task-progress-value\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const animatingFillRule = styles.match(/\.task-hub-task-progress\.is-progress-animating\s+\.task-hub-task-progress-fill\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const increasingRule = styles.match(/\.task-hub-task-progress\.is-progress-increasing\s+\.task-hub-task-progress-fill\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const decreasingRule = styles.match(/\.task-hub-task-progress\.is-progress-decreasing\s+\.task-hub-task-progress-fill\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const reducedMotionRule = styles.match(/@media \(prefers-reduced-motion: reduce\)\s*\{(?<body>[\s\S]+?)\n\}/)?.groups?.body ?? "";

    expect(fillRule).toContain("transition:");
    expect(fillRule).toContain("width 240ms cubic-bezier(0.22, 1, 0.36, 1)");
    expect(fillRule).toContain("will-change: width");
    expect(valueRule).toContain("transform 240ms cubic-bezier(0.22, 1, 0.36, 1)");
    expect(animatingFillRule).toContain("filter: saturate(1.08)");
    expect(increasingRule).toContain("box-shadow:");
    expect(decreasingRule).toContain("box-shadow:");
    expect(reducedMotionRule).toContain(".task-hub-task-progress-fill");
    expect(reducedMotionRule).toContain(".task-hub-task-progress-value");
  });

  it("lets auto-growing calendar task body fields stay compact for short text", () => {
    const styles = readFileSync(path.join(__dirname, "styles.css"), "utf8");
    const fixedTextareaMatch = /\.task-hub-calendar-detail-row\s+\.task-hub-detail-control\s+textarea\s*\{[^}]*min-height:\s*96px[^}]*\}/.exec(styles);
    const autoGrowMatch = /\.task-hub-calendar-detail-row\s+\.task-hub-detail-control\s+textarea\.task-hub-auto-grow-textarea\s*\{(?<body>[^}]+)\}/.exec(styles);
    const fixedTextareaIndex = fixedTextareaMatch?.index ?? -1;
    const autoGrowIndex = autoGrowMatch?.index ?? -1;
    const autoGrowRule = autoGrowMatch?.groups?.body ?? "";

    expect(fixedTextareaIndex).toBeGreaterThanOrEqual(0);
    expect(autoGrowIndex).toBeGreaterThan(fixedTextareaIndex);
    expect(autoGrowRule).toContain("min-height: 34px");
    expect(autoGrowRule).toContain("resize: none");
  });

  it("aligns native date and time picker icons at the start of detail inputs", () => {
    const styles = readFileSync(path.join(__dirname, "styles.css"), "utf8");
    const dateTimeInputRule = styles.match(/\.task-hub-detail-control input\[type="date"\],\s*\.task-hub-detail-control input\[type="time"\]\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const pickerIndicatorRule = styles.match(/\.task-hub-detail-control input\[type="date"\]::-webkit-calendar-picker-indicator,\s*\.task-hub-detail-control input\[type="time"\]::-webkit-calendar-picker-indicator\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const calendarRowInputMatch = /\.task-hub-calendar-detail-row\s+\.task-hub-detail-control\s+input,\s*\.task-hub-calendar-detail-row\s+\.task-hub-detail-control\s+select,\s*\.task-hub-calendar-detail-row\s+\.task-hub-detail-control\s+textarea\s*\{[^}]*padding:\s*6px 9px[^}]*\}/.exec(styles);
    const calendarRowDateInputMatch = /\.task-hub-calendar-detail-row\s+\.task-hub-detail-control\s+input\[type="date"\]\s*\{(?<body>[^}]+)\}/.exec(styles);
    const calendarRowTimeInputMatch = /\.task-hub-calendar-detail-row\s+\.task-hub-detail-control\s+input\[type="time"\]\s*\{(?<body>[^}]+)\}/.exec(styles);
    const calendarRowDateInputRule = calendarRowDateInputMatch?.groups?.body ?? "";
    const calendarRowTimeInputRule = calendarRowTimeInputMatch?.groups?.body ?? "";

    expect(dateTimeInputRule).toContain("position: relative");
    expect(styles).toContain('.task-hub-detail-control input[type="date"] {\n  padding-left: calc(36px + 4ch);\n}');
    expect(styles).toContain('.task-hub-detail-control input[type="time"] {\n  padding-left: 36px;\n}');
    expect(styles).toContain('.task-hub-detail-control input[type="date"]::-webkit-datetime-edit {\n  padding-left: 2ch;\n}');
    expect(pickerIndicatorRule).toContain("left: 10px");
    expect(pickerIndicatorRule).toContain("right: auto");
    expect(pickerIndicatorRule).toContain("position: absolute");
    expect(calendarRowDateInputMatch?.index ?? -1).toBeGreaterThan(calendarRowInputMatch?.index ?? -1);
    expect(calendarRowTimeInputMatch?.index ?? -1).toBeGreaterThan(calendarRowInputMatch?.index ?? -1);
    expect(calendarRowDateInputRule).toContain("padding-left: calc(36px + 4ch)");
    expect(calendarRowTimeInputRule).toContain("padding-left: 42px");
  });

  it("aligns calendar detail date/all-day with the start/end time columns", () => {
    const styles = readFileSync(path.join(__dirname, "styles.css"), "utf8");
    const dateRule = styles.match(/\.task-hub-calendar-detail-date-row\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const timeRule = styles.match(/\.task-hub-calendar-detail-time-row\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const alertRule = styles.match(/\.task-hub-reminder-alert-row,\s*\.task-hub-create-alert-row\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const headerWithSelectRule = styles.match(/\.task-hub-calendar-detail-header\.has-calendar-select\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const titleWithCheckboxRule = styles.match(/\.task-hub-calendar-detail-title\.has-complete-checkbox\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const eventTitleRule = styles.match(/(?:^|\n)\.task-hub-calendar-detail-title\.is-event\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const eventTitleBeforeRule = styles.match(/\.task-hub-calendar-detail-title\.is-event::before\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const eventTitleTextRule = styles.match(/\.task-hub-calendar-detail-title\.is-event\s+\.task-hub-calendar-detail-title-text\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const eventTitleLogoRule = styles.match(/\.task-hub-calendar-detail-title\.is-event\s+\.task-hub-calendar-detail-logo\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const titleCheckboxCellRule = styles.match(/\.task-hub-calendar-detail-title-check-cell\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const titleCheckboxRule = styles.match(/\.task-hub-calendar-detail-title-check-cell\s+\.task-hub-detail-complete-checkbox\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const titleTextRule = styles.match(/(?:^|\n)\.task-hub-calendar-detail-title-text\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
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
    expect(titleWithCheckboxRule).toContain("gap: 10px");
    expect(eventTitleRule).toContain("display: grid");
    expect(eventTitleRule).toContain("grid-template-columns: 36px minmax(0, max-content) 28px minmax(0, 1fr)");
    expect(eventTitleBeforeRule).toContain('content: ""');
    expect(eventTitleTextRule).toContain("grid-column: 2");
    expect(eventTitleLogoRule).toContain("grid-column: 3");
    expect(titleCheckboxCellRule).toContain("flex: 0 0 36px");
    expect(titleCheckboxCellRule).toContain("justify-content: center");
    expect(titleCheckboxRule).toContain("accent-color: var(--task-hub-item-color");
    expect(titleCheckboxRule).toContain("height: 18px");
    expect(titleCheckboxRule).toContain("min-height: 18px");
    expect(titleCheckboxRule).toContain("width: 18px");
    expect(titleCheckboxRule).toContain("padding: 0");
    expect(titleCheckboxRule).toContain("margin: 0");
    expect(titleTextRule).toContain("text-overflow: ellipsis");
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
    const datePickerDatetimeEditRule = styles.match(/\.task-hub-create-date-picker\s+input::-webkit-datetime-edit,\s*\.task-hub-create-date-picker\s+input::-webkit-datetime-edit-fields-wrapper\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
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
    expect(scheduleControlRule).toContain("grid-template-columns: minmax(0, 1.14fr) minmax(96px, 0.86fr)");
    expect(pickerRule).toContain("width: min(132px, 100%)");
    expect(datePickerRule).toContain("width: min(164px, 100%)");
    expect(pickerInputRule).toContain("appearance: none");
    expect(pickerInputRule).toContain("font-family: var(--font-interface)");
    expect(pickerInputRule).toContain("font-variant-numeric: tabular-nums");
    expect(pickerInputRule).toContain("padding: 0 10px 0 36px");
    expect(datePickerDatetimeEditRule).toContain("padding-left: 0.75ch");
    expect(pickerIndicatorRule).toContain("display: none");
    expect(pickerIndicatorRule).toContain("-webkit-appearance: none");
    expect(pickerIndicatorRule).toContain("width: 0");
    expect(pickerControlInputRule).toContain("width: 100%");
    expect(alertSettingRule).toContain("grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)");
    expect(alertCheckboxRule).toContain("height: 18px");
    expect(alertCheckboxRule).toContain("max-width: 18px");
    expect(alertCheckboxRule).toContain("min-width: 18px");
    expect(alertCheckboxRule).toContain("width: 18px");
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
    expect(styles).toContain("display: none");
  });

  it("keeps task note cards padded and Markdown paragraphs compact", () => {
    const styles = readFileSync(path.join(__dirname, "styles.css"), "utf8");
    const noteCardRule = styles.match(/\.task-hub-task-note-card\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const pinnedCardRule = styles.match(/\.task-hub-task-note-card\.is-pinned\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const noteBodyRule = styles.match(/\.task-hub-task-note-body\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const noteTitleRule = styles.match(/\.task-hub-task-note-title\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const pinRule = styles.match(/button\.task-hub-task-note-pin\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const pinActiveRule = styles.match(/button\.task-hub-task-note-pin\.is-active\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const plainTextRule = styles.match(/\.task-hub-task-note-text\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const blockRule = styles.match(/\.task-hub-task-note-card\s+\.task-hub-task-note-body p,\s*\.task-hub-task-note-card\s+\.task-hub-task-note-body ul,\s*\.task-hub-task-note-card\s+\.task-hub-task-note-body ol\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const listItemRule = styles.match(/\.task-hub-task-note-card\s+\.task-hub-task-note-body li\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";

    expect(noteCardRule).toContain("padding: 14px 16px 12px");
    expect(pinnedCardRule).toContain("border-color: color-mix");
    expect(noteTitleRule).toContain("color: var(--text-muted)");
    expect(noteTitleRule).toContain("font-size: var(--font-ui-small)");
    expect(noteBodyRule).toContain("padding: 0 0 0 2px");
    expect(noteBodyRule).toContain("margin-top: 10px");
    expect(noteBodyRule).toContain("white-space: normal");
    expect(pinRule).toContain("right: 42px");
    expect(pinRule).toContain("border-radius: 999px");
    expect(pinActiveRule).toContain("color: var(--task-hub-source-color)");
    expect(plainTextRule).toContain("white-space: pre-wrap");
    expect(blockRule).toContain("margin-block: 0 2px");
    expect(listItemRule).toContain("margin-block: 0 2px");
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
    expect(taskListChipRule).toContain("0 3px 8px color-mix(in srgb, var(--task-hub-source-color, var(--interactive-accent)) 28%, transparent)");
    expect(taskListChipRule).toContain("0 1px 2px rgb(0 0 0 / 16%)");
  });

  it("renders editable tag chips as an Obsidian-style property value, not a visible input box", () => {
    const styles = readFileSync(path.join(__dirname, "styles.css"), "utf8");
    const editorRule = styles.match(/\.task-hub-tag-editor\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const hoverRule = styles.match(/\.task-hub-tag-editor:hover\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const focusRule = styles.match(/\.task-hub-tag-editor:focus-within\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const placeholderRule = styles.match(/\.task-hub-tag-editor-placeholder\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const inputRule = styles.match(/input\.task-hub-tag-editor-input\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const chipRule = styles.match(/\.task-hub-tag-editor-chip\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const sharedChipRule = styles.match(/\.task-hub-task-list-flow\s+\.task-hub-task-row\s+\.task-hub-task-tag,\s*\.task-hub-tag-editor\s+\.task-hub-task-tag\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const taskTagRule = styles.match(/\.task-hub-task-tag\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const detailTitleInputRule = styles.match(/\.task-hub-detail-control\s+textarea\.task-hub-detail-title-input\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";

    expect(editorRule).toContain("background: transparent");
    expect(editorRule).toContain("border: 1px solid transparent");
    expect(editorRule).toContain("border-radius: 4px");
    expect(editorRule).toContain("cursor: text");
    expect(editorRule).toContain("padding: 2px 6px");
    expect(hoverRule).toContain("background: var(--background-modifier-hover)");
    expect(focusRule).toContain("box-shadow: none");
    expect(placeholderRule).toContain("color: var(--text-faint)");
    expect(inputRule).toContain("background: transparent");
    expect(inputRule).toContain("border: 0");
    expect(inputRule).toContain("min-width: 1ch");
    expect(chipRule).toContain("cursor: text");
    expect(chipRule).not.toContain("background:");
    expect(chipRule).not.toContain("color: var(--text-normal)");
    expect(taskTagRule).toContain("var(--task-hub-source-color, var(--interactive-accent))");
    expect(sharedChipRule).toContain("font-size: var(--font-ui-medium)");
    expect(sharedChipRule).toContain("font-weight: 400");
    expect(sharedChipRule).toContain("padding: 1px 6px");
    expect(detailTitleInputRule).toContain("font-size: var(--font-ui-medium)");
  });

  it("keeps task detail reminder controls aligned with the shared input column", () => {
    const styles = readFileSync(path.join(__dirname, "styles.css"), "utf8");
    const detailRowRule = styles.match(/\.task-hub-detail-row\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const detailHeaderRule = styles.match(/\.task-hub-detail-header\.task-hub-detail-title-header\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const detailHeaderLogoRule = styles.match(/\.task-hub-detail-header-logo-cell\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const detailHeaderSpacerRule = styles.match(/\.task-hub-detail-header-spacer\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const reminderDetailOverride = styles.match(/\.task-hub-reminder-alert-row\.task-hub-detail-row\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const detailEditorRule = styles.match(/\.task-hub-detail-editor\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const detailExtraRule = styles.match(/\.task-hub-detail-extra\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const detailExtraExpandingRule = styles.match(/\.task-hub-detail-extra\.is-expanding\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const detailExtraHiddenRule = styles.match(/\.task-hub-detail-extra\.is-hidden,\s*\.task-hub-detail-extra\.is-opening,\s*\.task-hub-detail-extra\.is-closing\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const autoGrowRule = styles.match(/\.task-hub-detail-control textarea\.task-hub-auto-grow-textarea\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const reducedMotionRule = styles.match(/@media \(prefers-reduced-motion: reduce\)\s*\{(?<body>[\s\S]+?)\n\}/)?.groups?.body ?? "";

    expect(detailRowRule).toContain("grid-template-columns: 36px var(--task-hub-detail-label-width, 128px) minmax(0, 1fr)");
    expect(detailHeaderRule).toContain("grid-template-columns: 36px max-content 28px minmax(0, 1fr)");
    expect(detailHeaderLogoRule).toContain("justify-content: flex-start");
    expect(detailHeaderLogoRule).toContain("min-height: 32px");
    expect(detailHeaderSpacerRule).toContain("min-width: 0");
    expect(reminderDetailOverride).not.toContain("grid-template-columns");
    expect(detailEditorRule).toContain("gap: 8px");
    expect(detailExtraRule).toContain("display: grid");
    expect(detailExtraRule).toContain("gap: 8px");
    expect(detailExtraExpandingRule).toContain("max-height 220ms cubic-bezier(0.2, 0.85, 0.25, 1)");
    expect(detailExtraExpandingRule).toContain("overflow: clip");
    expect(detailExtraHiddenRule).toContain("opacity: 0");
    expect(detailExtraHiddenRule).toContain("transform: translateY(-8px)");
    expect(autoGrowRule).toContain("min-height: 34px");
    expect(autoGrowRule).toContain("overflow-y: auto");
    expect(autoGrowRule).toContain("resize: none");
    expect(reducedMotionRule).toContain(".task-hub-detail-extra.is-expanding");
  });

  it("animates the unscheduled side panel open and closed", () => {
    const styles = readFileSync(path.join(__dirname, "styles.css"), "utf8");
    const panelRule = styles.match(/\.task-hub-unscheduled-panel\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const openingRule = styles.match(/\.task-hub-unscheduled-panel\.is-opening\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const closingRule = styles.match(/\.task-hub-unscheduled-panel\.is-closing\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const hostClosingRule = styles.match(/\.task-hub-calendar-with-sidebar\.is-unscheduled-closing\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const paneOpenRule = styles.match(/\.task-hub-calendar-with-sidebar\.is-unscheduled-opening\s+\.task-hub-calendar-pane\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const paneClosingRule = styles.match(/\.task-hub-calendar-with-sidebar\.is-unscheduled-closing\s+\.task-hub-calendar-pane\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const completedRowRule = styles.match(/\.task-hub-unscheduled-task\.is-completed\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const completingRowRule = styles.match(/\.task-hub-unscheduled-task\.is-completing\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const enterKeyframes = styles.match(/@keyframes task-hub-unscheduled-panel-enter\s*\{(?<body>[\s\S]+?)\n\}/)?.groups?.body ?? "";
    const exitKeyframes = styles.match(/@keyframes task-hub-unscheduled-panel-exit\s*\{(?<body>[\s\S]+?)\n\}/)?.groups?.body ?? "";
    const rowCompleteKeyframes = styles.match(/@keyframes task-hub-unscheduled-task-complete\s*\{(?<body>[\s\S]+?)\n\}/)?.groups?.body ?? "";
    const paneOpenKeyframes = styles.match(/@keyframes task-hub-calendar-pane-make-room\s*\{(?<body>[\s\S]+?)\n\}/)?.groups?.body ?? "";
    const paneCloseKeyframes = styles.match(/@keyframes task-hub-calendar-pane-restore-room\s*\{(?<body>[\s\S]+?)\n\}/)?.groups?.body ?? "";
    const reducedMotionRule = styles.match(/@media \(prefers-reduced-motion: reduce\)\s*\{(?<body>[\s\S]+?)\n\}/)?.groups?.body ?? "";

    expect(panelRule).not.toContain("animation: task-hub-unscheduled-panel-enter");
    expect(openingRule).toContain("animation: task-hub-unscheduled-panel-enter 220ms cubic-bezier(0.2, 0.85, 0.25, 1) both");
    expect(panelRule).toContain("transform-origin: right center");
    expect(hostClosingRule).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(closingRule).toContain("animation: task-hub-unscheduled-panel-exit 190ms cubic-bezier(0.4, 0, 0.2, 1) both");
    expect(closingRule).toContain("position: absolute");
    expect(closingRule).toContain("right: 0");
    expect(paneOpenRule).toContain("animation: task-hub-calendar-pane-make-room 220ms cubic-bezier(0.2, 0.85, 0.25, 1) both");
    expect(paneClosingRule).toContain("animation: task-hub-calendar-pane-restore-room 190ms cubic-bezier(0.4, 0, 0.2, 1) both");
    expect(completedRowRule).not.toContain("animation:");
    expect(completingRowRule).toContain("animation: task-hub-unscheduled-task-complete 260ms cubic-bezier(0.2, 0.85, 0.25, 1) both");
    expect(completingRowRule).toContain("pointer-events: none");
    expect(enterKeyframes).toContain("transform: translateX(18px) scale(0.98)");
    expect(exitKeyframes).toContain("transform: translateX(18px) scale(0.98)");
    expect(rowCompleteKeyframes).toContain("transform: translateX(4px)");
    expect(paneOpenKeyframes).toContain("transform: translateX(12px) scaleX(1.012)");
    expect(paneCloseKeyframes).toContain("transform: translateX(10px) scaleX(1.01)");
    expect(reducedMotionRule).toContain(".task-hub-calendar-with-sidebar.is-unscheduled-opening .task-hub-calendar-pane");
    expect(reducedMotionRule).toContain(".task-hub-unscheduled-panel");
    expect(reducedMotionRule).toContain(".task-hub-unscheduled-task.is-completed");
  });

  it("styles the day view with a persistent details sidebar and mini month navigator", () => {
    const styles = readFileSync(path.join(__dirname, "styles.css"), "utf8");
    const layoutRule = styles.match(/\.task-hub-calendar-day-layout\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const sidebarRule = styles.match(/\.task-hub-calendar-day-sidebar\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const sectionRule = styles.match(/\.task-hub-calendar-day-sidebar-section\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const detailRule = styles.match(/\.task-hub-calendar-day-detail\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const dayUnscheduledRule = styles.match(/\.task-hub-calendar-day-unscheduled\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const taskDetailRule = styles.match(/\.task-hub-calendar-day-task-detail\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const taskDetailRowRule = styles.match(/\.task-hub-calendar-day-task-detail \.task-hub-detail-row\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const taskSendControlRule = styles.match(/\.task-hub-calendar-day-task-detail \.task-hub-send-control\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const eventDetailRule = styles.match(/\.task-hub-calendar-day-event-detail\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const eventDetailRowRule = styles.match(/\.task-hub-calendar-day-event-detail \.task-hub-calendar-detail-row\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const eventTitleRule = styles.match(/\.task-hub-calendar-day-event-detail \.task-hub-calendar-detail-title\.is-event\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const weekdayRule = styles.match(/\.task-hub-calendar-mini-month-weekdays > span\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const miniGridRule = styles.match(/\.task-hub-calendar-mini-month-weekdays,\s*\.task-hub-calendar-mini-month-grid\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const miniMonthTitleRule = styles.match(/\.task-hub-calendar-mini-month-title\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const dayButtonRule = styles.match(/\.task-hub-calendar-mini-month-grid > \.task-hub-calendar-mini-month-day\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const todayRule = styles.match(/\.task-hub-calendar-mini-month-grid > \.task-hub-calendar-mini-month-day\.is-today::after\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const selectedRule = styles.match(/\.task-hub-calendar-mini-month-grid > \.task-hub-calendar-mini-month-day\.has-task\.is-selected\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const completionRule = styles.match(/\.task-hub-calendar-mini-month-grid > \.task-hub-calendar-mini-month-day\.is-completion-4\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const lunarInlineRule = styles.match(/\.task-hub-calendar-lunar-inline\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";

    expect(layoutRule).toContain("grid-template-columns: minmax(0, 1fr) minmax(320px, 392px)");
    expect(sidebarRule).toContain("position: sticky");
    expect(sidebarRule).toContain("display: flex");
    expect(sidebarRule).toContain("flex-direction: column");
    expect(sidebarRule).toContain("max-height: calc(100vh - 176px)");
    expect(sidebarRule).toContain("overflow-y: auto");
    expect(sidebarRule).toContain("padding-inline: 0");
    expect(sectionRule).toContain("border-radius: 12px");
    expect(sectionRule).toContain("position: relative");
    expect(sectionRule).not.toContain("border:");
    expect(detailRule).toContain("border-radius: 0");
    expect(detailRule).toContain("border: 1px solid");
    expect(detailRule).toContain("padding: 12px");
    expect(detailRule).toContain("position: relative");
    expect(dayUnscheduledRule).toContain("transform-origin: right top");
    expect(dayUnscheduledRule).toContain("overflow: hidden");
    expect(taskDetailRule).toContain("--task-hub-detail-label-width: 60px");
    expect(taskDetailRule).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(taskDetailRowRule).toContain("grid-template-columns: 28px minmax(0, var(--task-hub-detail-label-width, 60px)) minmax(0, 1fr)");
    expect(taskSendControlRule).toContain("grid-template-columns: 28px max-content minmax(0, 1fr)");
    expect(eventDetailRule).toContain("--task-hub-detail-label-width: 60px");
    expect(eventDetailRule).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(eventDetailRowRule).toContain("grid-template-columns: 28px minmax(0, var(--task-hub-detail-label-width, 60px)) minmax(0, 1fr)");
    expect(eventTitleRule).toContain("grid-template-columns: 28px minmax(0, max-content) 28px minmax(0, 1fr)");
    expect(weekdayRule).toContain("white-space: nowrap");
    expect(miniMonthTitleRule).toContain("font-weight: 500");
    expect(miniGridRule).toContain("grid-template-columns: repeat(7, minmax(0, 1fr))");
    expect(miniGridRule).toContain("gap: 1px");
    expect(dayButtonRule).toContain("border-radius: 0");
    expect(dayButtonRule).toContain("appearance: none");
    expect(dayButtonRule).toContain("background-color: var(--task-hub-mini-month-fill)");
    expect(dayButtonRule).toContain("border: none");
    expect(dayButtonRule).toContain("border-color: transparent");
    expect(dayButtonRule).toContain("width: 100%");
    expect(dayButtonRule).toContain("max-width: none");
    expect(dayButtonRule).toContain("aspect-ratio: 1 / 0.82");
    expect(dayButtonRule).toContain("font-variant-numeric: tabular-nums");
    expect(todayRule).toContain("border-radius: 999px");
    expect(todayRule).toContain("height: 4px");
    expect(selectedRule).toContain("filter: saturate(1.08)");
    expect(dayButtonRule).toContain("box-shadow: none");
    expect(completionRule).toContain("--task-hub-mini-month-fill: color-mix");
    expect(completionRule).toContain("--task-hub-mini-month-text: color-mix");
    expect(lunarInlineRule).toContain("margin-left: 6px");
    expect(lunarInlineRule).toContain("font-size: var(--font-ui-smaller)");
  });

  it("animates subtask expansion with a staggered reveal and reduced-motion fallback", () => {
    const styles = readFileSync(path.join(__dirname, "styles.css"), "utf8");
    const openingRule = styles.match(/\.task-hub-subtask-list\.is-opening\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const closingRule = styles.match(/\.task-hub-subtask-list\.is-closing\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const rowRule = styles.match(/\.task-hub-subtask-list\.is-opening\s*>\s*\.task-hub-task-row\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const closingRowRule = styles.match(/\.task-hub-subtask-list\.is-closing\s*>\s*\.task-hub-task-row\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const firstDelayRule = styles.match(/\.task-hub-subtask-list\.is-opening\s*>\s*\.task-hub-task-row:nth-child\(1\)\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const listKeyframes = styles.match(/@keyframes task-hub-subtask-list-enter\s*\{(?<body>[\s\S]+?)\n\}/)?.groups?.body ?? "";
    const rowKeyframes = styles.match(/@keyframes task-hub-subtask-row-enter\s*\{(?<body>[\s\S]+?)\n\}/)?.groups?.body ?? "";
    const listExitKeyframes = styles.match(/@keyframes task-hub-subtask-list-exit\s*\{(?<body>[\s\S]+?)\n\}/)?.groups?.body ?? "";
    const rowExitKeyframes = styles.match(/@keyframes task-hub-subtask-row-exit\s*\{(?<body>[\s\S]+?)\n\}/)?.groups?.body ?? "";
    const reducedMotionRule = styles.match(/@media \(prefers-reduced-motion: reduce\)\s*\{(?<body>[\s\S]+?)\n\}/)?.groups?.body ?? "";

    expect(openingRule).toContain("animation: task-hub-subtask-list-enter 260ms cubic-bezier(0.16, 1, 0.3, 1) both");
    expect(openingRule).toContain("transition: max-height 260ms cubic-bezier(0.16, 1, 0.3, 1)");
    expect(openingRule).toContain("overflow: clip");
    expect(openingRule).toContain("transform-origin: top left");
    expect(closingRule).toContain("animation: task-hub-subtask-list-exit 240ms cubic-bezier(0.4, 0, 0.2, 1) both");
    expect(closingRule).toContain("pointer-events: none");
    expect(closingRule).toContain("transition: max-height 240ms cubic-bezier(0.4, 0, 0.2, 1)");
    expect(rowRule).toContain("animation: task-hub-subtask-row-enter 220ms cubic-bezier(0.16, 1, 0.3, 1) both");
    expect(closingRowRule).toContain("animation: task-hub-subtask-row-exit 180ms cubic-bezier(0.4, 0, 0.2, 1) both");
    expect(firstDelayRule).toContain("animation-delay: 24ms");
    expect(listKeyframes).toContain("transform: translateY(18px) scaleY(0.92)");
    expect(rowKeyframes).toContain("transform: translateY(12px) scale(0.98)");
    expect(listExitKeyframes).toContain("transform: translateY(16px) scaleY(0.94)");
    expect(rowExitKeyframes).toContain("transform: translateY(10px) scale(0.98)");
    expect(reducedMotionRule).toContain(".task-hub-subtask-list.is-opening");
    expect(reducedMotionRule).toContain(".task-hub-subtask-list.is-closing");
    expect(reducedMotionRule).toContain(".task-hub-subtask-list.is-opening > .task-hub-task-row");
    expect(reducedMotionRule).toContain(".task-hub-subtask-list.is-closing > .task-hub-task-row");
  });

  it("styles compact task and detail progress bars for subtask progress", () => {
    const styles = readFileSync(path.join(__dirname, "styles.css"), "utf8");
    const contentRule = styles.match(/\.task-hub-task-content\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const titleRule = styles.match(/\.task-hub-task-title-line\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const rowRule = styles.match(/\.task-hub-task-progress\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const barRule = styles.match(/\.task-hub-task-progress-bar\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const fillRule = styles.match(/\.task-hub-task-progress-fill\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const detailRule = styles.match(/\.task-hub-detail-progress\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const inlineProgressRule = styles.match(/\.task-hub-task-row\.has-progress \.task-hub-task-progress\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";

    expect(contentRule).toContain("display: flex");
    expect(contentRule).toContain("align-items: center");
    expect(titleRule).toContain("flex-wrap: nowrap");
    expect(titleRule).toContain("overflow: visible");
    expect(titleRule).toContain("white-space: nowrap");
    expect(rowRule).toContain("grid-template-columns: minmax(0, 1fr) auto");
    expect(barRule).toContain("border-radius: 999px");
    expect(barRule).toContain("height: 7px");
    expect(fillRule).toContain("max-width: 100%");
    expect(detailRule).toContain("border-radius: 8px");
    expect(detailRule).toContain("display: grid");
    expect(inlineProgressRule).toContain("flex: 0 0 33%");
    expect(inlineProgressRule).toContain("max-width: 33%");
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
    const sectionHeadingRule = Array.from(styles.matchAll(/\.task-hub-task-section h3\s*\{(?<body>[^}]+)\}/g))
      .map((match) => match.groups?.body ?? "")
      .find((body) => body.includes("font-size")) ?? "";
    const calendarTitleRule = Array.from(styles.matchAll(/\.task-hub-calendar-item-title\s*\{(?<body>[^}]+)\}/g))
      .map((match) => match.groups?.body ?? "")
      .find((body) => body.includes("font-size")) ?? "";

    expect(taskTextRule).toContain("font-weight: 400");
    expect(sectionHeadingRule).toContain("font-weight: 400");
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
    expect(chipRule).toContain("background-color 300ms ease");
    expect(activeChipRule).toContain("var(--interactive-accent)");
  });

  it("centers the task list at a comfortable responsive width", () => {
    const styles = readFileSync(path.join(__dirname, "styles.css"), "utf8");
    const paneRule = styles.match(/\.task-hub-task-list-pane\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const transitionRule = styles.match(/\.task-hub-task-list-pane-transition\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
    const refreshKeyframes = styles.match(/@keyframes task-hub-task-list-refresh\s*\{(?<body>[\s\S]+?)\n\}/)?.groups?.body ?? "";
    const reducedMotionRule = styles.match(/@media \(prefers-reduced-motion: reduce\)\s*\{(?<body>[\s\S]+?)\n\}/)?.groups?.body ?? "";
    const sectionRule = styles.match(/\.task-hub-task-section\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";

    expect(paneRule).toContain("justify-items: center");
    expect(paneRule).toContain("padding-inline: clamp(4px, 2vw, 24px)");
    expect(transitionRule).toContain("task-hub-task-list-refresh 300ms");
    expect(refreshKeyframes).toContain("opacity: 0.72");
    expect(refreshKeyframes).toContain("transform: translateY(3px)");
    expect(reducedMotionRule).toContain(".task-hub-task-list-pane-transition");
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
    const sendTargetRule = styles.match(/\.task-hub-send-target-select\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";

    expect(sizingRule).toContain("overflow-x: hidden");
    expect(sizingRule).toContain("overflow-y: auto");
    expect(sizingRule).toContain("resize: none");
    expect(sizingRule).toContain("width: clamp(420px, 34vw, 620px)");
    expect(shellRule).toContain("--task-hub-detail-label-width: 92px");
    expect(actionRule).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(sendButtonRule).toContain("border-radius: 8px");
    expect(sendButtonRule).toContain("height: 38px");
    expect(sendTargetRule).toContain("appearance: auto");
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

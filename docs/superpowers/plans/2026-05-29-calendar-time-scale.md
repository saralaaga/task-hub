# Calendar Time Scale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add discrete Command-wheel vertical zoom for day/week calendar views, plus configurable visible day hours.

**Architecture:** Store calendar time scale and visible hour range in `TaskHubSettings`, pass them through `TaskHubView` into `renderCalendarView`, and replace the fixed `HOUR_HEIGHT` calculations with runtime agenda metrics. Wheel interaction lives in the calendar renderer and reports scale changes through a handler so settings remain the source of truth.

**Tech Stack:** TypeScript, Obsidian Plugin API, native DOM rendering, Jest, scoped CSS.

---

## Files

- Modify `src/types.ts`: add calendar scale/range settings and handler/state fields.
- Modify `src/settings.ts`: defaults, normalization, settings UI.
- Modify `src/i18n.ts`: English/Chinese labels.
- Modify `src/views/TaskHubView.ts`: pass settings and save scale changes.
- Modify `src/views/renderCalendarView.ts`: wheel handling, dynamic metrics, minor grid lines, runtime time math.
- Modify `src/views/renderCalendarView.test.ts`: renderer behavior and time math tests.
- Modify `src/settings.test.ts`: settings defaults and invalid range normalization.
- Modify `src/styles.css`: optional minor grid styling.

## Tasks

### Task 1: Settings Schema

- [ ] Add `CalendarTimeScale = "fit" | "hour" | "half" | "quarter"` to `src/types.ts`.
- [ ] Add `calendarTimeScale`, `calendarDayStartHour`, and `calendarDayEndHour` to `TaskHubSettings`.
- [ ] Add defaults in `DEFAULT_SETTINGS`: `"hour"`, `6`, `22`.
- [ ] Normalize missing/invalid values:
  - invalid scale -> `"hour"`
  - start outside `0..23` -> `6`
  - end outside `1..24` -> `22`
  - end <= start -> `6..22`
- [ ] Add `settings.test.ts` expectations for defaults and invalid ranges.

### Task 2: Settings UI

- [ ] Add i18n keys for visible range settings in English and Chinese.
- [ ] Add two dropdowns in the basic settings grid:
  - start hour `00:00..23:00`
  - end hour `01:00..24:00`
- [ ] On change, save settings and redisplay if normalization changes the paired value.

### Task 3: Calendar State and Wheel Handler

- [ ] Extend `CalendarViewState` with `calendarTimeScale`, `calendarDayStartHour`, `calendarDayEndHour`.
- [ ] Extend `CalendarViewHandlers` with `onTimeScaleChange?: (scale: CalendarTimeScale) => void`.
- [ ] Pass values from `TaskHubView`.
- [ ] Implement `onTimeScaleChange` in `TaskHubView` to update settings, save, and render.
- [ ] Add renderer tests:
  - Command wheel up changes `"hour"` to `"half"`.
  - Command wheel down changes `"hour"` to `"fit"`.
  - normal wheel does nothing.
  - month view command wheel does nothing.

### Task 4: Runtime Agenda Metrics

- [ ] Replace fixed `HOUR_HEIGHT` usage in agenda math with runtime `hourHeight`.
- [ ] Add `calendarTimeScaleMetrics(scale, hourCount, container)` helper:
  - `fit`: computed/clamped `24..56`
  - `hour`: `56`
  - `half`: `84`
  - `quarter`: `112`
- [ ] Pass `hourHeight` through layout, render, creation, drop, drag, resize functions.
- [ ] Update tests that assert top/height values.

### Task 5: Visible Hour Range

- [ ] Use settings range as base start/end hours.
- [ ] Auto-extend for earlier/later timed items.
- [ ] Clamp to `0..24` and keep minimum one hour.
- [ ] Add tests for default `06..22`, custom range, and auto-extension.

### Task 6: Minor Grid Lines

- [ ] Generate grid lines by scale:
  - `fit`: 120 minutes
  - `hour`: 60 minutes
  - `half`: 30 minutes
  - `quarter`: 15 minutes
- [ ] Keep time-axis labels at whole hours.
- [ ] Add CSS for minor lines with softer border.
- [ ] Add tests for line count/classes at each scale.

### Task 7: Verification and Sync

- [ ] Run `npm test -- src/settings.test.ts src/views/renderCalendarView.test.ts --runInBand`.
- [ ] Run `npm test -- --runInBand`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Sync `manifest.json`, `main.js`, and `src/styles.css` to `/Users/carlos/Coding/testValut/.obsidian/plugins/task-hub/`.
- [ ] Use `cmp -s` to confirm synced files match.

## Self-Review

- The plan covers settings, renderer state, wheel interaction, dynamic time math, visible range, grid lines, tests, and sync.
- No placeholders remain.
- Type names match the proposed settings and renderer API.

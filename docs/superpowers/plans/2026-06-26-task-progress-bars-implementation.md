# Task Progress Bars Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an initial subtask progress bar feature to the Tasks view, with a global settings toggle and recursive progress calculation that stays stable when filters hide child tasks.

**Architecture:** Keep recursive progress calculation in a small testable domain module, then pass precomputed progress info into the existing task row and task details renderers. Reuse existing task hierarchy fields (`parentId`, `indent`) and existing settings/i18n patterns instead of introducing a new data model.

**Tech Stack:** TypeScript, Jest, Obsidian Plugin API, native DOM rendering, existing `src/styles.css`

---

### Task 1: Define settings and copy

**Files:**
- Modify: `src/types.ts`
- Modify: `src/settings.ts`
- Modify: `src/i18n.ts`
- Test: `src/settings.test.ts`

- [ ] Add `showSubtaskProgressBars` to `TaskHubSettings`, default it to `true`, and normalize old saved settings to that default.
- [ ] Add settings UI toggle copy and detail copy keys in all supported languages.
- [ ] Add a settings normalization test that proves old saved settings pick up the default and explicit `false` survives normalization.

### Task 2: Add recursive progress calculation

**Files:**
- Create: `src/subtaskProgress.ts`
- Test: `src/subtaskProgress.test.ts`

- [ ] Implement a pure helper that builds `taskId -> progress info` from the full indexed task list.
- [ ] Make leaf children contribute `100` or `0`, and parent tasks contribute the average of direct child progress values.
- [ ] Include summary fields that the detail panel can show without recomputing recursion in the view.
- [ ] Add unit tests for single-level, nested, filtered-parent, and no-child scenarios.

### Task 3: Render progress bars in the Tasks view

**Files:**
- Modify: `src/views/TaskHubView.ts`
- Modify: `src/views/renderTasksView.ts`
- Modify: `src/styles.css`
- Test: `src/views/renderTasksView.test.ts`
- Test: `src/styles.test.ts`

- [ ] Pass the new settings flag into `renderTasksView`.
- [ ] Precompute progress info from `allTasks`, not only visible tasks, so filtering does not change the same task’s underlying progress.
- [ ] Render a compact progress bar and percentage only for tasks that actually have subtasks and only when the setting is enabled.
- [ ] Add a lightweight task-details progress section for tasks with subtasks.
- [ ] Add view tests for visible progress, hidden progress when the setting is off, recursive percentages, and progress stability when hidden children are still part of the full task tree.
- [ ] Add a style test that checks the progress row/bar rules exist.

### Task 4: Verify and sync to test vault

**Files:**
- Modify: `main.js` via build output only

- [ ] Run `npm test -- src/subtaskProgress.test.ts src/settings.test.ts src/views/renderTasksView.test.ts src/styles.test.ts`
- [ ] Run `npm run typecheck`
- [ ] Run `npm run build`
- [ ] Sync `manifest.json`, `main.js`, and `src/styles.css` to `/Users/carlos/Coding/testValut/.obsidian/plugins/task-hub/`
- [ ] Run `cmp -s` checks for all three synced files and report whether real Obsidian manual verification was performed.

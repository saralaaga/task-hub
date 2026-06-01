# Manual Test Vault

Use this checklist to verify Task Hub inside a real Obsidian vault.

中文清单见下方“中文”部分。

## Sample Note

Create `Project A.md` in a test vault:

```md
# Project A

- [ ] Overdue task #work 📅 2026-05-01
- [ ] Today task #work due:: 2026-05-05
- [ ] No date task #misc
- [x] Completed task #done
```

## Load Plugin

1. Run `npm run build`.
2. Copy `manifest.json`, `main.js`, and `src/styles.css` into `.obsidian/plugins/task-hub/`.
3. Rename the copied stylesheet to `styles.css`.
4. Enable the plugin in Obsidian community plugin settings.
5. Run the `Open Task Hub` command or click the ribbon icon.

## Verification Checklist

- Task Hub opens without console errors.
- The dashboard shows indexed task counts.
- Open tasks are shown by default.
- Completed tasks are hidden until the completed-task toggle is enabled or the status filter is set to Completed/All.
- Tasks are grouped into overdue, today, this week, future, and no date buckets.
- Filtering by `#work` shows the two work tasks.
- Text search finds `Today task`.
- Source search finds tasks in `Project A.md`.
- Clicking a task opens `Project A.md` and moves the editor near the task line.
- Clicking a vault task checkbox updates `- [ ]` to `- [x]` in the source note.
- If the source line is manually changed before clicking the checkbox, Task Hub shows a conflict instead of changing the wrong line.
- The Tags view shows `#work`, `#misc`, and `#done` statistics.
- Clicking `#work` in Tags returns to Tasks with the tag filter applied.
- The Calendar view shows dated tasks on day, week, and month views.
- Calendar layer controls can hide and show Vault tasks, Apple Reminders, Apple Calendar, and ICS sources.
- Calendar task checkboxes can complete writable vault tasks.
- Adding a bad ICS URL in settings shows a sync failure state.
- Adding a valid public ICS URL shows events after Sync.

## Dida Checklist

- Create a dedicated Dida/TickTick test account or a `Task Hub Test` list.
- Enable Dida integration, enter the API token, and click Test / sync.
- Enable Dida tasks and confirm synced Dida tasks appear in the task list and calendar layers.
- Set Dida list colors, then confirm task cards use the expected colors.
- With Dida writeback disabled, confirm Dida task checkboxes and detail fields are read-only.
- Enable Dida writeback and confirm a Dida task can be completed, reopened, edited, and moved to another list.
- Enable Dida drag rescheduling, drag a dated Dida task in month/week/day views, and confirm the date or time changes in Dida.
- Enable Dida deletion and confirm deleting a test Dida task removes it from the external list after sync.
- Enable Dida creation, send a vault Markdown task to Dida, and confirm the external task is created before the Markdown line is removed.

## Local Apple Helper Checklist

- Run `npm run build:apple-helper`.
- Run `npm run build`.
- Copy `manifest.json`, `main.js`, `src/styles.css`, and `taskhub-apple-helper` into `.obsidian/plugins/task-hub/`.
- Rename the copied stylesheet to `styles.css`.
- Open Task Hub settings in Obsidian.
- Enable Apple Reminders.
- Click Check status and confirm it does not show AppleScript/JXA timeout errors.
- Click Request access and allow Reminders access in the macOS prompt.
- Click Sync and confirm Apple Reminders tasks appear.
- If Apple Reminders writeback is disabled, external reminder checkboxes should be disabled.
- Enable Apple Reminders writeback and confirm a reminder can be completed from Task Hub.
- Enable Apple Calendar.
- Enable Apple Calendar writeback, drag a test event to another date in month/week/day views, and confirm the event date changes in Apple Calendar while its time and duration stay the same.
- Click Request access and allow Calendar access.
- Click Sync and confirm calendar events appear in day, week, and month views.
- Deny permissions in macOS System Settings and sync again; Task Hub should show permission denied, not parse error or timeout.

## Known Manual Gaps

- Large-vault scan responsiveness should be checked with a real large vault.
- ICS compatibility should be checked with real public calendars that include timezone and folded fields.
- Mobile and narrow-pane layouts need visual review inside Obsidian.
- Obsidian community plugin installation does not currently distribute `taskhub-apple-helper`; Apple helper behavior must be verified separately.
- Dida native tag sync writes Task Hub tags into the API `tags` field; confirm the Dida client shows them in the tag menu. Android alarm-mode behavior still requires real-client verification; Task Hub writes reminder times through the API.

## 中文

用这个清单在真实 Obsidian vault 中验证 Task Hub。

## 示例笔记

在测试 vault 中创建 `Project A.md`：

```md
# Project A

- [ ] Overdue task #work 📅 2026-05-01
- [ ] Today task #work due:: 2026-05-05
- [ ] No date task #misc
- [x] Completed task #done
```

## 加载插件

1. 运行 `npm run build`。
2. 将 `manifest.json`、`main.js` 和 `src/styles.css` 复制到 `.obsidian/plugins/task-hub/`。
3. 将复制过去的样式文件命名为 `styles.css`。
4. 在 Obsidian 第三方插件设置中启用插件。
5. 运行 `Open Task Hub` 命令，或点击左侧 ribbon 图标。

## 验证清单

- Task Hub 打开后没有控制台错误。
- 顶部统计能显示已索引任务数量。
- 默认展示未完成任务。
- 已完成任务在开启“显示已完成”开关，或状态筛选切到 Completed/All 后才展示。
- 任务会按逾期、今天、本周、未来和无日期分组。
- 按 `#work` 筛选后展示两个 work 任务。
- 文本搜索能找到 `Today task`。
- 来源搜索能找到 `Project A.md` 中的任务。
- 点击任务能打开 `Project A.md`，并定位到任务行附近。
- 点击 vault 任务复选框后，源笔记中的 `- [ ]` 会更新为 `- [x]`。
- 如果点击前手动改掉源行，Task Hub 应显示冲突，而不是修改错误行。
- 标签视图能显示 `#work`、`#misc` 和 `#done` 统计。
- 点击标签视图里的 `#work` 会回到任务视图并应用标签筛选。
- 日历视图能在日、周、月视图中显示有日期的任务。
- 图层控件能隐藏和显示 Vault tasks、Apple Reminders、Apple Calendar 和 ICS 源。
- 日历中的任务复选框可以完成可写的 vault 任务。
- 在设置中添加错误 ICS URL 后，应显示同步失败状态。
- 添加有效公共 ICS URL 并同步后，应显示事件。

## 滴答清单验证

- 创建专用滴答 / TickTick 测试账号，或创建 `Task Hub Test` 清单。
- 开启滴答清单集成，填写 API 口令，点击“测试 / 同步”。
- 开启滴答任务，确认同步后的滴答任务出现在任务列表和日历图层中。
- 设置滴答清单颜色，确认任务卡片使用预期颜色。
- 关闭滴答写回时，确认滴答任务复选框和详情字段处于只读状态。
- 开启滴答写回，确认可以完成、重新打开、编辑滴答任务，并移动到另一个清单。
- 开启滴答拖动改期，在月/周/日视图中拖动有日期的滴答任务，确认滴答中的日期或时间变化。
- 开启滴答删除，确认删除测试滴答任务后，同步后外部清单中不再出现该任务。
- 开启滴答创建，把一条 vault Markdown 任务发送到滴答，确认先创建外部任务，再删除 Markdown 源行。

## 本地 Apple Helper 验证

- 运行 `npm run build:apple-helper`。
- 运行 `npm run build`。
- 将 `manifest.json`、`main.js`、`src/styles.css` 和 `taskhub-apple-helper` 复制到 `.obsidian/plugins/task-hub/`。
- 将复制过去的样式文件命名为 `styles.css`。
- 在 Obsidian 中打开 Task Hub 设置。
- 开启 Apple Reminders。
- 点击“检查状态”，确认不再显示 AppleScript/JXA 超时。
- 点击“请求权限”，并在 macOS 弹窗中允许提醒事项访问。
- 点击“同步”，确认 Apple Reminders 任务出现在任务列表。
- 如果没有开启 Apple Reminders 回写，外部提醒事项的复选框应处于禁用状态。
- 开启 Apple Reminders 回写，确认可以从 Task Hub 完成一个提醒事项。
- 开启 Apple Calendar。
- 开启 Apple Calendar 写回，在月/周/日视图中把测试事件拖到另一天，并确认 Apple 日历中的事件日期变化、时间和时长保持不变。
- 点击“请求权限”，允许日历访问。
- 点击“同步”，确认日历事件出现在日、周、月视图中。
- 在 macOS 系统设置中拒绝权限后再次同步，应显示“权限已拒绝”，而不是“解析错误”或“超时”。

## 已知手工验证缺口

- 大型 vault 的扫描响应需要用真实大 vault 验证。
- ICS 兼容性需要用包含时区和折行字段的真实公共日历验证。
- 移动端和窄面板布局需要在 Obsidian 中进一步视觉检查。
- Obsidian 社区插件安装目前不会分发 `taskhub-apple-helper`；Apple helper 行为需要单独验证。
- 滴答原生标签同步会把 Task Hub 标签写入 API 的 `tags` 字段；需确认滴答客户端的标签菜单能显示。Android 闹钟模式仍需要真实客户端验证；Task Hub 通过 API 写入提醒时间。

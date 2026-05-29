# 任务与事件笔记设计

日期：2026-05-29
状态：需求草案，尚未开始实现

## 目标

Task Hub 需要支持给任务和日历事件关联 Markdown 笔记。用户可以在 Task Hub 中查看某个任务或事件的相关笔记，也可以点击打开对应的 Markdown 文件。

关联关系应记录在笔记文件的 YAML frontmatter 中。这样做有三个好处：

- 笔记仍然是普通 Markdown 文件，不被插件锁死。
- 用户可以用 Obsidian 属性、搜索、Dataview 等生态能力继续整理。
- 即使 Task Hub 暂时不可用，关联信息仍可人工恢复。

这个功能必须是可选的。设置中关闭后，Task Hub 不显示笔记菜单、笔记数和笔记容器。

## 调研结论

Obsidian 的属性本质上是 Markdown 文件顶部的 YAML frontmatter，位于 `---` 分隔符之间。属性可以是文本、列表、日期、日期时间等结构化值。Obsidian 也提醒过，属性虽然是纯文本，但嵌套属性在 UI 中支持有限，所以 Task Hub 的 schema 应保持扁平、稳定、容易人工阅读。

Thino 有多种存储方式。基础日记模式通常把内容写进日记文件中的时间戳列表项，例如 `- 22:15 {content}`。Thino Pro 的多来源模式支持多种存储，其中 multi-file 模式会把每条 Thino 作为一个独立 Markdown 文件，并在 YAML frontmatter 中记录元数据。Thino 文档中特别提醒，在非日记模式下，`id` 和 `createdAt` 是重要字段，不应随意修改。

因此，Task Hub 第一版只应承诺支持“生成 Thino multi-file 兼容笔记”。不要声称支持所有 Thino 存储模式，也不要尝试直接编辑 Thino 的日记模式、单文件 callout 模式或 canvas 模式。

参考资料：

- https://www.mintlify.com/obsidianmd/obsidian-help/editing/properties
- https://github.com/Quorafind/Obsidian-Thino
- https://thino.pkmer.net/en/thino/02_thino-advanced/thino-multi-souce/
- https://thino.pkmer.net/thino/02_thino-advanced/thino-settings

## 当前代码接入点

现有实现已经有几个适合扩展的位置：

- `src/types.ts`：定义 `TaskItem`、`CalendarEvent` 和 `TaskHubSettings`。
- `src/settings.ts`：定义默认设置、设置兼容归一化和设置页 UI。
- `src/views/renderTasksView.ts`：渲染任务列表、右键菜单、选中态和任务详情侧栏。
- `src/views/renderCalendarView.ts`：渲染日历项、右键菜单和任务/事件详情浮层。
- `src/views/TaskHubView.ts`：管理选中任务状态，并把 UI 回调连接到插件方法。
- `src/main.ts`：负责 vault 读写、Apple Reminders 发送/回写、Apple Calendar 操作和刷新视图。
- 邻近测试已有 `src/appleReminderMigration.test.ts`、`src/views/renderTasksView.test.ts`、`src/views/renderCalendarView.test.ts` 和 settings 相关测试。

## 第一版范围

### 做什么

- 设置中增加总开关：开启或关闭 Task Hub 笔记功能。
- 设置中增加笔记存储配置：
  - Task Hub 普通笔记默认目录；
  - 默认创建模式：Task Hub 普通笔记或 Thino multi-file 笔记；
  - 可选 Thino 目录；
  - 可选 Thino 兼容 frontmatter 开关。
- 任务列表中，右键任务可以创建/关联笔记。
- 日历视图中，右键任务或事件可以创建/关联笔记。
- 任务列表的详情侧栏显示相关笔记容器。
- 日历详情浮层显示相关笔记容器；如果后续日历也改成侧栏详情，可以复用同一套容器。
- 任务列表卡片右上角显示笔记数；没有笔记时不显示。
- 笔记通过点击打开：
  - 详情区域展示一个紧凑的笔记列表；
  - 点击笔记项打开对应 Markdown 文件；
  - 没有笔记时，不渲染这个容器。
- 通过 YAML frontmatter 建立关系索引：
  - 笔记声明自己关联了哪些 Task Hub item；
  - Task Hub 扫描笔记 frontmatter，计算笔记数和笔记列表；
  - 笔记文件保持普通 Markdown。
- vault 任务发送到 Apple Reminders 时同步维护笔记关联：
  - 相关任务笔记必须更新 YAML，加入新的 Apple Reminder 关联；
  - 原 vault 任务关联保留到历史字段，方便恢复和排查。

### 第一版不做什么

- 不在 Task Hub 内编辑笔记正文。
- 不新增外部日历事件的创建、编辑、删除或移动能力。
- 不写入 ICS 源。
- 不集成 Thino API、Thino 服务端，也不生成 Thino 日记模式/单文件模式/canvas 模式内容。
- 不做批量关联或批量取消关联。
- 不承诺和任意用户重命名过的外部事件做双向同步。
- 不做移动端完整验证，但 DOM 和 CSS 仍要保持窄 pane 友好。
- 不把长笔记正文塞进 YAML frontmatter。

## 用户故事

- 用户可以右键一个任务，为它创建关联笔记。
- 用户可以右键一个事件，为它创建关联笔记。
- 用户选中任务后，可以在右侧详情区域看到相关笔记。
- 有笔记的任务卡片右上角显示笔记数量。
- Thino 用户可以选择创建 Thino multi-file 模式可识别的笔记。
- 用户把 vault 任务发送到 Apple Reminders 后，不会丢失原任务的笔记关联。

## 数据模型

使用扁平 YAML schema，避免 Obsidian 属性 UI 对嵌套结构支持有限带来的问题。

### Task Hub 普通笔记 frontmatter

```yaml
---
taskhub-note: true
taskhub-note-id: "thn_20260529_103012_abcd"
taskhub-related:
  - "task:vault:Projects/Launch.md:42:hash"
taskhub-related-history:
  - "task:vault:Projects/Launch.md:42:hash"
taskhub-created: 2026-05-29T10:30:12
taskhub-updated: 2026-05-29T10:30:12
tags:
  - task-hub-note
---
```

关系字段使用字符串列表，而不是对象数组。这让 YAML 更容易人工阅读，也能避开 Obsidian 属性面板对复杂嵌套结构的限制。

### 关系 key 设计

关系 key 应该稳定、可索引，但不能脆弱到普通编辑就完全失效。

建议格式：

- vault 任务：`task:vault:{filePath}:{line}:{lineHash}`
- Apple Reminder 任务：`task:apple-reminders:{externalId}`
- ICS 事件：`event:{sourceId}:{eventId}:{startDate}`
- Apple Calendar 事件：`event:apple-calendar:{eventId}:{startDate}`

`taskhub-related-history` 用来保存迁移前或发送前的旧 key。Task Hub 匹配时优先使用当前 key；只有当前 key 找不到时，历史 key 才用于展示、恢复或排查。

### Thino multi-file 笔记 frontmatter

启用 Thino 兼容创建时，Task Hub 在配置的 Thino 目录中创建普通 Markdown 文件，并写入 Thino multi-file 模式需要的元数据，同时加上 Task Hub 自己的关联字段。

草案格式：

```yaml
---
id: "20260529103012"
createdAt: 2026-05-29T10:30:12
updatedAt: 2026-05-29T10:30:12
taskhub-note: true
taskhub-note-id: "thn_20260529_103012_abcd"
taskhub-related:
  - "task:vault:Projects/Launch.md:42:hash"
tags:
  - task-hub-note
---
```

边界：Task Hub 只在创建新的 Thino 兼容笔记时设置 `id` 和 `createdAt`。之后更新关联关系时，不应改写已有 Thino 笔记的 `id` 或 `createdAt`。

## 设置项

新增“任务笔记”设置分组：

- `taskNotes.enabled`：默认 `false`。
- `taskNotes.notesFolder`：默认 `Task Hub Notes`。
- `taskNotes.defaultMode`：`task-hub` 或 `thino-multi-file`，默认 `task-hub`。
- `taskNotes.thinoIntegrationEnabled`：默认 `false`。
- `taskNotes.thinoFolder`：默认 `Thino`。
- `taskNotes.openNoteAfterCreate`：默认 `true`。
- `taskNotes.showCountsInTaskList`：默认 `true`。

所有用户可见文案都必须同步补齐英文和中文翻译。

## UI 行为

### 任务列表

- 开启任务笔记后，任务右键菜单增加“添加笔记”或“创建关联笔记”。
- 如果任务有关联笔记，并且设置允许显示数量，在任务行右上角展示紧凑的数量标记。
- 选中任务后，在现有详情信息和操作按钮下方渲染笔记容器。
- 没有关联笔记时，不渲染笔记容器。
- 点击笔记项时，打开对应 Markdown 文件。

### 日历视图

- 开启任务笔记后，日历任务和日历事件的右键菜单增加同样的笔记操作。
- 日历详情浮层中，有笔记时显示关联笔记。
- 只读外部事件也可以有本地笔记，因为写入的是本地笔记文件，不是外部事件源。
- 如果某类事件 identity 不稳定，Task Hub 仍可创建笔记，但应把标题、日期、来源等 fallback 信息保存在历史或正文中，便于人工识别。

## 发送与转换行为

### vault 任务发送到 Apple Reminders

当前行为是：创建 Apple Reminder，记录 `settings.appleReminderLinks[task.id] = reminderId`，然后尝试删除原 vault 任务行。

新增笔记逻辑后，流程应改为：

1. 读取当前 vault 任务，找到关联旧 vault 任务 key 的笔记。
2. 创建 Apple Reminder。
3. 更新相关笔记 YAML：
   - 把 `task:apple-reminders:{reminderId}` 加入 `taskhub-related`；
   - 把旧 vault key 移入或复制到 `taskhub-related-history`；
   - 更新 `taskhub-updated`；
   - 保留所有无关 YAML 字段。
4. 保存 `appleReminderLinks`。
5. 删除原 vault 任务行，保持当前产品行为。
6. 重建笔记和任务索引，刷新视图。

如果 Apple Reminder 已创建，但笔记 YAML 更新失败，Task Hub 不应删除原 vault 任务行。此时应尽量保存 Apple Reminder link，并提示用户笔记转移需要修复。这样可以避免静默制造孤儿笔记。

### Apple Reminder 转 Apple Calendar

第一版可以按同一原则保留笔记：加入新的事件 key，把旧 reminder key 留在历史字段中。这个路径没有 vault 任务发送那么紧急，但最好在同一个 service 里设计，避免以后分叉。

### Apple Calendar 事件转 Reminder

同理：加入新的 reminder key，保留旧 event key。如果原事件随后被删除，历史字段仍能保留用户可理解的迁移轨迹。

## 索引与性能

- 新增一个轻量 note index，不塞进 `TaskIndex`。
- 只扫描 Markdown 文件，并尊重 `ignoredPaths`。
- 优先使用 Obsidian metadata cache 读取 frontmatter；必要时再读取文件内容。
- 像任务索引一样，使用 file path、mtime、size 做缓存判断。
- Task Hub 创建或更新笔记后，立即重建该笔记索引。
- 渲染时从索引读取笔记数，不要每次渲染都全库扫描。

## YAML 更新规则

- 保留已有 frontmatter 字段和正文。
- 不重排无关用户属性。
- 文件没有 frontmatter 时，在文件顶部插入。
- 文件存在损坏或无法解析的 frontmatter 时，失败并提示，不要强行改写。
- `taskhub-related`、`taskhub-related-history`、`tags` 都使用数组。
- 不重复写入相同 relationship key。
- Thino 笔记创建后，绝不改写 `id` 和 `createdAt`。

## 文件命名

Task Hub 普通笔记默认文件名：

```text
Task Hub Notes/YYYY-MM-DD HHmmss - {safe task or event title}.md
```

Thino multi-file 默认文件名：

```text
Thino/YYYYMMDDHHmmss.md
```

需要清理非法路径字符，并限制文件名长度。Thino 文档也提醒要注意非法字符和长路径，Task Hub 应采用同样保守的命名策略。

## 验收标准

- 关闭任务笔记后，不出现笔记菜单、笔记数量和笔记容器。
- 开启任务笔记后，右键 vault 任务可以创建关联 Markdown 笔记。
- 创建出的笔记包含有效 YAML frontmatter。
- `openNoteAfterCreate` 开启时，创建后自动打开笔记。
- 选中有关联笔记的任务时显示笔记容器；选中无笔记任务时隐藏。
- 有笔记的任务行显示正确数量；无笔记任务不显示数量标记。
- 右键事件可以创建本地关联笔记，且不修改外部事件源。
- Thino 模式创建 multi-file 风格 Markdown 笔记，包含 `id`、`createdAt` 和 Task Hub 关联字段。
- 更新 Task Hub 创建的 Thino 笔记时，不改写 `id` 或 `createdAt`。
- vault 任务发送到 Apple Reminders 后，关联笔记 YAML 包含新的 Apple Reminder 关系。
- 如果笔记转移失败，原 vault 任务不被删除。
- 现有任务解析、筛选、日历渲染和 Apple Reminders 发送测试继续通过。

## 测试计划

单元测试：

- vault 任务、Apple Reminder、ICS 事件、Apple Calendar 事件的 relationship key 生成。
- frontmatter 插入和更新。
- 损坏 frontmatter 的冲突处理。
- note index 的数量聚合。
- Thino 笔记创建元数据。
- 发送到 Apple Reminders 时的笔记转移顺序。

视图测试：

- 任务行笔记数量显示/隐藏正确。
- 任务详情笔记容器显示/隐藏正确。
- 任务右键菜单只在开启功能后显示笔记操作。
- 日历右键菜单只在开启功能后显示笔记操作。
- 日历详情中有关联笔记时显示笔记列表。

设置测试：

- 默认设置归一化正确。
- 旧设置加载后，任务笔记默认关闭。
- 所有新增用户可见文案都有英文和中文翻译。

`/Users/carlos/Coding/testValut` 手工测试：

- 开启任务笔记，从 vault 任务创建笔记，检查 YAML 和详情展示。
- 从 Apple Reminder 任务创建笔记，确认没有写外部源。
- 从 Apple Calendar 事件和 ICS 事件创建笔记，确认只生成本地笔记。
- 开启 Thino 模式创建笔记，重载 Obsidian/Thino，确认在配置为 multi-file 模式时可被 Thino 识别。
- 给带笔记的 vault 任务执行发送到 Apple Reminders，确认原任务被移除，笔记指向新的 reminder。

## 风险与缓解

- vault 任务关系 key 依赖行号，源文件编辑后可能漂移。缓解：加入行内容 hash，并保留历史 key；未来可考虑给任务写入隐藏稳定 ID。
- YAML 更新如果靠字符串硬改，可能破坏用户属性。缓解：优先使用 Obsidian metadata，写一个小而清晰的 frontmatter 工具，并用测试锁住行为；遇到损坏 YAML 时失败而不是强改。
- Thino 兼容性可能受版本和 Pro 设置影响。缓解：明确标注只兼容 multi-file 模式，目录可配置，不改写 Thino 拥有的字段。
- 某些 ICS 事件 ID 可能不稳定。缓解：key 中包含 source id 和 start date，并在历史或正文中保留标题/日期等 fallback 信息。
- Apple Reminder 创建和 vault 写入不是事务。缓解：删除源任务前先完成笔记 YAML 转移，并保留可修复的历史关联。

## 获批后的推荐实现计划

1. 增加类型、默认设置、设置归一化和中英文文案。
2. 实现 relationship key 和 frontmatter 工具，并补测试。
3. 实现笔记创建与 note index service，并补测试。
4. 接入任务列表 UI：右键菜单、数量标记、详情笔记容器。
5. 接入日历 UI：右键菜单和详情笔记容器。
6. 接入发送/转换流程中的关联转移逻辑。
7. 补齐 settings、note index、UI 可见性和发送迁移测试。
8. 运行 `npm test`、`npm run typecheck`、`npm run build`，然后同步到测试 vault 做手工验证。

## 编码前仍需确认的决策

- 创建笔记后是否默认自动打开。建议：默认打开。
- “添加笔记”第一版是总是创建新笔记，还是也支持链接已有笔记。建议：第一版只创建新笔记。
- 笔记数量是否统计 history-only 关联。建议：第一版只统计当前关联；历史关联只用于恢复和排查。
- 未来是否支持 Thino 日记模式。建议：本功能不做；它不是“每条笔记一个 YAML frontmatter 文件”，需要另起设计。

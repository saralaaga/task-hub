# 统一笔记模型实施计划

日期：2026-07-11
状态：已落实（2026-07-11）

## 背景

当前仓库里“笔记”实际上分成两套并行能力：

1. `taskNotes`
   - 面向任务/事件关联笔记。
   - 通过 `taskhub-related` / `taskhub-related-history` 维护关系。
   - 在任务详情、日历详情和右键菜单中消费。

2. `datedNotes`
   - 面向笔记页中的按日期笔记流。
   - 通过 `taskhub-type: note` 和 `taskhub-date` 识别。
   - 在 notes 视图中消费。

从产品语义上看，这两者本质上都是“Task Hub 笔记”，只是当前创建入口、索引方式、设置项和渲染场景不同。继续并行演进会导致：

- 设置页重复且难理解。
- 索引逻辑重复。
- 用户无法自然地在“任务关联”和“日期笔记流”之间复用同一份笔记。
- 后续在 notes 页渲染关联任务、搜索全部笔记、排序和过滤时成本变高。

## 目标

以尽量少的代码实现“概念统一、体验统一”，而不是立刻做一次高风险的大重构。

目标状态：

- 对用户来说，Task Hub 里只有一种“笔记”。
- 一条笔记可以同时具备：
  - 日期属性；
  - 任务/事件关联属性；
  - 普通正文与标签。
- notes 页展示统一笔记流，而不是只展示 dated note。
- 任务/日历详情继续能看到关联笔记，但这些笔记同时也可以出现在 notes 页。
- 对旧文件格式和旧设置保持兼容，不要求一次性迁移用户数据。

## 设计原则

1. 先统一读模型，不急着统一底层存储格式。
2. 先统一 notes 页体验，再逐步收口创建与设置逻辑。
3. 优先复用现有 `taskNotes` / `datedNotes` parser、index 和 view helper，避免一次性大删大改。
4. 不新增依赖。
5. 所有新增用户可见文案继续补齐中英双语。

## 统一领域模型

新增统一读模型：`HubNote`

建议字段：

```ts
type HubNote = {
  path: string;
  noteId?: string;
  title: string;
  body: string;
  bodyStartLine: number;
  tags: string[];
  createdAt?: string;
  updatedAt?: string;

  date?: string;

  related: string[];
  history: string[];

  sourceKind: "task-note" | "dated-note" | "hybrid";
};
```

解释：

- `date` 可选：普通关联笔记可以没有日期；日期笔记必须有日期。
- `related` 和 `history` 统一保留：旧 dated note 没有关联关系时就是空数组。
- `sourceKind` 只用于兼容、调试和过渡期逻辑判断，不作为长期用户概念。

## 统一 frontmatter 目标格式

中长期统一写入格式建议如下：

```yaml
---
taskhub-note: true
taskhub-note-id: "note_20260711_103012_abcd"
taskhub-date: 2026-07-11
taskhub-related:
  - "task:vault:Projects/Launch.md:42:hash"
taskhub-related-history:
  - "task:apple-reminders:external-id"
taskhub-created: 2026-07-11T10:30:12.000Z
taskhub-updated: 2026-07-11T10:30:12.000Z
tags:
  - task-hub-note
---
```

兼容策略：

- 旧 `taskNotes` 文件继续读取。
- 旧 `datedNotes` 文件继续读取。
- 新创建笔记在第二阶段再切换到统一写法。

## 检索 / 收集设计

### Phase 1：统一读模型，保持旧索引可用

新增 `src/hubNotes.ts`，负责：

- 定义 `HubNote`。
- 定义统一解析函数：
  - `parseHubNoteFrontmatter(content)`：
    - 识别旧 task note 格式；
    - 识别旧 dated note 格式；
    - 输出统一 `HubNote`。
- 定义统一索引：
  - `HubNoteIndex`

建议索引结构：

- `notesByPath`
- `notePathsByDate`
- `notePathsByRelationKey`

推荐直接扫描 Markdown 文件并调用统一 parser，而不是在第一阶段让 `HubNoteIndex` 依赖 `TaskNoteIndex` 和 `DatedNoteIndex` 的内部状态。这样好处是：

- 读模型统一来源更清楚；
- 未来更容易替换旧索引；
- 不需要先拆现有索引类的内部实现。

### 日期归档策略

notes 页需要日期来排布。统一后会出现“有关联关系，但没有日期”的旧笔记。

建议策略：

1. 若 frontmatter 有 `taskhub-date`，直接使用。
2. 若没有 `taskhub-date`，但有 `createdAt`，则用 `createdAt.slice(0, 10)` 作为展示日期。
3. 若两者都没有，则放到一个特殊分组：
   - `undated`
   - UI 文案可显示为“无日期 / No date”

第一阶段只做展示推导，不强制回写文件。

### 任务关联反查

notes 页如果要展示关联任务摘要，需要把 `related` key 反解回 `TaskItem` 或 `CalendarEvent`。

最低成本实现：

- 先只反解任务：
  - vault task
  - Apple Reminders
  - Dida
- 对事件保留后续扩展位，但第一阶段不强行在 notes 页展示事件卡片。

建议新增 helper：

```ts
resolveHubNoteRelatedTasks(note: HubNote, tasks: TaskItem[]): TaskItem[]
```

先从现有任务列表里按 key 映射匹配，避免新建复杂服务。

## 视图设计

### Notes 页

当前 `renderDatedNotesView` 改成消费统一的 `HubNote[]`，但保留原有整体布局和大部分样式命名，避免大规模重写 DOM。

第一阶段 notes 页行为：

- 展示所有有日期或可推导日期的 `HubNote`。
- 沿用当前左右栏结构与窗口化渲染。
- 每张笔记卡片在正文预览之前，若存在关联任务，则显示一个紧凑的任务摘要区域。

任务摘要建议只展示：

- 完成状态：`[ ]` / `[x]`
- 任务文本
- 任务来源
- 可选日期（due/start）

多任务时：

- 默认只展示 1 条主关联任务；
- 右侧附 `+N`，降低渲染复杂度。

这样能满足“能看出这条笔记关联了什么任务”，但不会把 notes 页变成 task 页。

### 任务详情 / 日历详情

继续保留现有“关联笔记容器”交互，不做 UI 大改。

第一阶段只把数据来源替换为统一读模型：

- `getTaskNotes(task)` 的底层可先桥接到 `HubNoteIndex`；
- 老的 `TaskNote` UI 结构先不全面改名。

这样能最大限度减少 diff。

## 设置页重设计

第一阶段不直接删掉全部旧字段，而是先做“统一展示 + 旧字段兼容”。

建议把 notes 相关设置并到一个大组：

### 1. 基础

- `notes.enabled`
- `notes.folder`
- `notes.openAfterCreate`

### 2. 时间流

- `notes.timelineEnabled`
- `notes.defaultTitleTemplate`
- `notes.includeLinkedNotesInTimeline`

### 3. 关联

- `notes.relationsEnabled`
- `notes.showCountsInTaskList`
- `notes.linkedNoteSubtasksEnabled`
- `notes.renderLinkedTaskPreview`

### 4. Thino / 兼容

- `notes.defaultMode`
- `notes.thinoIntegrationEnabled`
- `notes.addThinoIdToTaskHubNotes`
- `notes.thinoFolder`

第一阶段的低代码做法：

- 设置页先合并展示；
- `TaskHubSettings` 底层先保留 `datedNotes` 与 `taskNotes`；
- 新 UI 写入时桥接到旧字段：
  - `notes.folder` 优先写到统一字段，若暂时不建新字段，可先同步写入 `datedNotes.folder` 与 `taskNotes.notesFolder`；
  - `timelineEnabled` 可桥接 `datedNotes.enabled`；
  - `relationsEnabled` 可桥接 `taskNotes.enabled`。

这样先把用户心智统一，再决定第二阶段是否物理合并配置结构。

## 最少代码实施路线

### Phase 1：统一读模型 + notes 页统一展示

目标：先让功能看起来像“同一套笔记”。

改动范围：

- 新增：`src/hubNotes.ts`
- 修改：`src/main.ts`
- 修改：`src/views/TaskHubView.ts`
- 修改：`src/views/renderDatedNotesView.ts`
- 少量修改：`src/settings.ts`
- 新增/修改：相关测试

任务拆分：

- [x] 新增 `HubNote` 类型与 parser。
- [x] 新增 `HubNoteIndex`，扫描所有 Markdown，统一收集 notes。
- [x] 在 `main.ts` 增加 `getHubNotes()`、`getHubNotesForTask(task)` 之类桥接 API。
- [x] notes 页改为渲染 `HubNote[]`。
- [x] notes 页卡片增加“关联任务摘要”轻量渲染。
- [x] 任务详情/日历详情的数据读取切到统一索引，但尽量复用现有 UI。
- [x] 设置页改成统一 notes 分组，底层先桥接旧字段。

这一阶段不做：

- 不迁移用户旧 frontmatter。
- 不删除 `TaskNoteIndex` / `DatedNoteIndex`。
- 不重写 task note modal / dated note editor。

### Phase 2：统一新建与更新写法

目标：以后新创建的笔记都用统一 schema。

任务拆分：

- [x] 新建统一 `createHubNote(...)`（当前以统一 `HubNote` content/update helper 形式落实）。
- [x] 任务页“创建关联笔记”和 notes 页“创建笔记”都走同一条创建逻辑。
- [x] 允许“创建时同时写入 date + related”。
- [x] 统一笔记编辑保存逻辑，避免 task/dated 各走一套 body update。

### Phase 3：配置与旧实现收口

目标：减少维护面。

任务拆分：

- [x] 评估是否保留 `taskNotes` / `datedNotes` 旧设置字段。
- [x] 评估是否让旧索引类退役，统一到 `HubNoteIndex`。
- [x] 增加兼容迁移测试，验证旧数据加载无回归。

### Phase 3 结论

- 旧设置字段暂时保留：继续使用 `datedNotes` / `taskNotes` 持久化，设置页统一展示并桥接写入，避免用户手动迁移配置。
- 旧索引类暂时保留：`HubNoteIndex` 作为统一读模型主入口，`TaskNoteIndex` / `DatedNoteIndex` 继续承担兼容读取、旧 UI 适配与低风险过渡职责。
- 兼容测试已补齐到 `hubNotes.test.ts`、`settings.test.ts`、`appleReminderMigration.test.ts`、`renderDatedNotesView.test.ts`，并通过全量 `npm test`。

## 兼容性策略

### 文件兼容

- 老 task note：继续可读、可展示、可在任务详情中找到。
- 老 dated note：继续可读、可在 notes 页展示。
- 新旧混合：统一进入 notes 页。

### 设置兼容

- 老配置加载后，不要求用户手动迁移。
- 第一阶段设置页展示可以统一，但保存时桥接旧字段。

### 风险控制

最大风险点：

1. notes 页引入“无日期关联笔记”后，排序和分组可能出现意外。
2. relation key 反解任务时，旧任务可能已经不存在。
3. 设置页概念合并后，如果底层字段仍分裂，容易出现开关不同步。

降低风险的策略：

- 第一阶段把“无日期”单独分组或用 `createdAt` 推导。
- 任务反解失败时，仅隐藏任务摘要，不影响笔记正文渲染。
- 设置页桥接逻辑集中封装，不要把同步逻辑散落到多个 onChange 回调里。

## 测试计划

至少补这些测试：

1. `hubNotes` parser
   - 旧 task note 可解析为 `HubNote`
   - 旧 dated note 可解析为 `HubNote`
   - 同时带 `date + related` 的统一 schema 可解析

2. `HubNoteIndex`
   - 可按日期取 note
   - 可按 relation key 取 note
   - 忽略路径和缓存判断正常

3. notes 页
   - 可渲染纯 dated note
   - 可渲染带任务关联的 note
   - 任务摘要只显示主关联任务
   - 无日期 note 的展示策略正确

4. 设置页
   - 统一 notes 设置会正确桥接旧字段

5. 回归
   - 任务详情中的关联笔记容器仍可正常显示
   - 日历详情中的关联笔记仍可正常显示

## 推荐实施顺序

建议严格按以下顺序推进：

1. 先做 `HubNote` parser 和索引测试。
2. 再接 `main.ts` 的统一读取 API。
3. 再改 notes 页渲染。
4. 然后加关联任务摘要。
5. 最后再碰设置页。

原因：

- notes 页统一展示是最有用户感知的部分；
- 设置页虽然重要，但先动它反而最容易引入桥接混乱；
- 先把读模型稳定住，再改设置更稳。

## 本计划对应的“少代码”结论

如果以“尽量少代码实现”为目标，最优解不是立刻合并全部底层实现，而是：

- 新增一层统一读模型；
- 让 notes 页先消费统一模型；
- 让关联笔记在 notes 页里显示任务摘要；
- 设置页先统一展示，但底层配置先兼容桥接；
- 旧 parser / 旧索引 / 旧创建逻辑先保留。

这样能用最小风险把产品概念统一起来，并为后续真正的底层合并留出余地。

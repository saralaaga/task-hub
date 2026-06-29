# Task Hub 外部任务源日期语义与同步协议

日期：2026-06-29
状态：协议草案，作为后续外部任务源接入、日期映射、shadow metadata、增长控制与同步窗口的统一标准

## 目标

Task Hub 已经同时承载：

- vault Markdown 任务；
- Apple Reminders；
- Dida / TickTick；
- 未来可能新增的其他外部任务源。

这些来源的字段能力并不一致。如果没有统一协议，后续很容易出现：

- 每个来源各自发明一套日期字段语义；
- 日历、热力图、筛选、拖拽排期依赖来源特例；
- `data.json` 逐渐演变成外部任务的全量镜像；
- 新外部源接入后破坏已有排序、稳定身份和视图行为。

本协议定义：

1. Task Hub 内部标准任务日期模型；
2. 外部任务源的接入协议；
3. 本地 shadow metadata 的职责边界；
4. 同步窗口与数据回收策略；
5. 后续新增外部任务源时必须遵守的行为约束。

后续如果修改以下主题，必须先读取本文件：

- 外部任务源接入；
- 外部任务日期映射；
- 外部任务 stableId 命名空间；
- 外部任务同步窗口；
- 外部任务 metadata 持久化与清理；
- 日历/热力图/排期对外部任务日期的消费逻辑。

## 设计原则

### 1. 先统一内部语义，再接外部来源

Task Hub 必须先有自己的标准任务模型，再把外部字段映射进来。

不允许：

- 让 Apple Reminders 的字段语义直接主导内部逻辑；
- 让 Dida / TickTick 的字段命名直接泄漏到视图层；
- 让新增来源通过 UI 代码临时分支接入。

### 2. 本地数据是辅助状态，不是外部数据库镜像

`data.json` 的职责是：

- 保存 Task Hub 运行所必需、但外部来源无法稳定表达的最小辅助信息；
- 保存本地视图/排序/关系状态；
- 在不污染用户源数据的前提下补足语义缺口。

不允许把 `data.json` 设计成：

- 外部任务完整副本仓库；
- 历史同步日志；
- 永久累积、只增不减的任务档案。

### 3. 外部源能力分层必须显式声明

每个来源都必须明确回答四个问题：

1. 它原生可提供哪些日期字段？
2. 哪些字段需要本地 shadow metadata 才能成立？
3. 哪些字段当前无法可靠支持？
4. 它的同步窗口和回收策略是什么？

不能默认假设“外部任务管理软件都差不多”。

### 4. 内部视图逻辑只依赖统一模型

日历、热力图、筛选、排序、拖拽排期、详情视图等内部逻辑，只应依赖统一任务模型，不应依赖 provider 特例。

provider 特例应该被收敛在：

- provider 读取层；
- provider 写回层；
- provider metadata 合并层。

## 内部标准任务日期模型

Task Hub 内部标准模型固定为：

```ts
type TaskItem = {
  startDate?: string;
  scheduledDate?: string;
  completedDate?: string;
  dueDate?: string;
}
```

### 字段语义

#### `startDate`

任务的起点。

要求：

- 表示“这个任务从哪一天开始成立/出现”；
- 一旦成立，应尽量保持不变；
- 不应随着日历拖拽改期而变化；
- 更偏向任务生命周期的起始事实，而不是当前排期。

#### `scheduledDate`

任务的当前排期。

要求：

- 表示“当前计划在哪一天/什么时间执行”；
- 日历拖拽、重排、改期时应主要修改此字段；
- 如果存在时间，则保留到 datetime 精度；
- 这是日历排期的主语义字段。

#### `completedDate`

任务的完成事实。

要求：

- 表示“任务在哪一天完成”；
- 完成任务时写入；
- 取消完成状态时删除；
- 只要求日期即可，不强制保留具体时间；
- 热力图、完成统计应优先消费此字段。

#### `dueDate`

兼容/截止语义字段。

要求：

- 主要承担“deadline / due”兼容语义；
- 不再承担 Task Hub 的主排期语义；
- 新逻辑应尽量避免继续把它当作唯一计划日期字段。

### 统一消费规则

#### 排期视图

日历/排期相关逻辑应优先按以下顺序取日期：

1. `scheduledDate`
2. `startDate`
3. `dueDate`

如果三者都没有，则归入“未排期”。

#### 完成热力图

完成热力图应优先使用：

1. `completedDate`

没有 `completedDate` 的任务，不应参与“完成热力”统计。

#### 完成/取消完成

- 完成：写入 `completedDate`
- 取消完成：删除 `completedDate`

#### 拖拽改期

- 改变的是 `scheduledDate`
- 不应顺手覆盖 `startDate`

## 外部任务源接入协议

### 1. 稳定身份命名空间

所有外部任务都必须映射到统一 stableId 命名空间。

建议格式：

- Apple Reminders：`apple-reminders:{externalId}`
- Dida：`dida:{externalId}`
- TickTick：`dida:{externalId}` 或后续明确拆分 `ticktick:{externalId}`
- 未来 Google Tasks：`google-tasks:{externalId}`

要求：

- 不允许裸存第三方 ID；
- 不允许省略来源前缀；
- 不允许单个来源自己发明与全局协议不兼容的 key 格式。

stableId 的全局约束仍遵循：

- `docs/superpowers/specs/2026-06-26-task-identity-and-manual-order-design.zh-CN.md`

### 2. 外部源接入最小清单

新增外部任务源时，至少要明确：

1. provider 名称；
2. stableId 命名空间；
3. 原生可读字段；
4. 原生可写字段；
5. 日期映射规则；
6. 本地 shadow metadata 需求；
7. 同步窗口策略；
8. metadata 清理策略；
9. 失败降级策略。

### 3. 统一映射目标

所有外部任务源最终都应映射为统一 `TaskItem`。

视图层、筛选层、排序层不应直接消费 provider 原始 record。

## Shadow Metadata 设计

### 定义

shadow metadata 指：

- 不写回外部源；
- 仅由 Task Hub 在本地 `data.json` 保存；
- 用于补足外部源原生表达能力不足的最小辅助信息。

### 可接受用途

shadow metadata 可以用于：

- 补足外部源缺失的 `startDate`；
- 保存外部源迁移后的关联信息；
- 保存 Task Hub 内部需要长期保持但来源不提供的最小语义；
- 保存必要的回收/存活判断字段，例如 `lastSeenAt`。

### 不可接受用途

shadow metadata 不应用于：

- 保存外部任务完整快照；
- 保存任务标题、正文、标签的长期镜像；
- 保存每次同步历史日志；
- 保存所有看过的外部任务全文。

### 建议结构

示意：

```ts
type ExternalTaskShadowMetadata = {
  startDate?: string;
  lastSeenAt?: string;
}

type ExternalTaskShadowMetadataMap = Record<string, ExternalTaskShadowMetadata>;
```

其中 key 应优先使用统一 stableId。

## 来源能力分层

### Dida / TickTick

原生能力较强，目标是直接完整映射：

- `startDate <- source.startDate`
- `scheduledDate <- source.dueDate`
- `completedDate <- source.completedTime`
- `dueDate <- source.dueDate` 仅作兼容/截止语义保留

要求：

- 不要再把 `startDate` 与 `dueDate` 压扁成一个混合字段；
- 不要继续把 `dueDate ?? startDate` 当作唯一日期来源；
- provider 层应尽量保留原生日期语义差异。

### Apple Reminders

原生能力较弱，分层如下：

- `scheduledDate <- reminder.dueDate`
- `completedDate <- helper 暴露的 completionDate`
- `startDate <- 本地 shadow metadata`

补充说明：

- 原生 reminder 一般没有可靠的独立 `startDate` 语义；
- 因此 `startDate` 只能由 Task Hub 本地补足；
- 若 reminder 从 Task Hub 创建或首次明确排期，可据策略建立本地 `startDate`；
- 若将来 helper 能稳定提供更多字段，可再升级映射策略，但仍应遵守本协议。

## 同步窗口策略

### 总原则

外部任务同步与本地 metadata 管理都必须受时间窗口约束，不能无限增长。

### 默认窗口

对外部任务默认使用：

- `lookbackDays = 100`
- `lookaheadDays = 100`

要求：

- 该值应可在设置中配置；
- 默认行为应尽量覆盖近期任务管理场景，同时避免无限扩大读取与缓存范围。

### 窗口判定规则

#### 开放任务

开放任务应优先按以下顺序决定是否落入窗口：

1. `scheduledDate`
2. `startDate`
3. `dueDate`

#### 已完成任务

已完成任务应优先按：

1. `completedDate`

判断是否落入窗口。

原因：

- 完成热力图与完成回顾更关心完成事实；
- 不能只按历史排期日期决定是否保留已完成任务。

#### 无日期任务

无任何日期字段的外部任务：

- 不应直接丢弃；
- 应归入“未排期”；
- 但不应因此无限保留历史无日期垃圾。

建议：

- 当前仍能从成功同步结果中读到的无日期任务保留；
- 长期未再出现的无日期任务 metadata 应清理。

### 同步窗口与 provider 请求边界

如果 provider 原生支持时间范围查询，优先在 provider 层限窗。

如果 provider 不支持：

- 允许先读取 provider 给出的可用结果；
- 再在 Task Hub 本地按统一规则裁剪；
- 但必须仍受 metadata 回收和 UI 展示窗口控制。

## Metadata 回收与增长控制

### 总原则

外部任务 shadow metadata 必须被视为缓存型数据。

要求：

- 可重建数据优先清理；
- 长期无命中数据必须回收；
- 不能因为一次同步失败就误删全部 metadata；
- 不能无限保留外部任务历史痕迹。

### 建议保留字段

每条 metadata 建议只保留：

- `startDate`
- `lastSeenAt`
- 未来确有必要的极少数字段

### 必须执行的清理规则

1. 删除非法 key。
   - key 不是已知 stableId 命名空间格式时直接移除。

2. 删除空对象。
   - metadata 条目为空时直接移除。

3. 删除长期未命中的孤儿条目。
   - 某条 metadata 对应 stableId 在多次成功同步后的 live set 中持续不存在，应清理。

4. 不因单次失败立即删除。
   - 如果本次 provider 同步失败、权限被拒、helper 异常，不应把缺席当成“已删除”。

5. 保存前归一化。
   - 去重；
   - 清理非法字段；
   - 清理空对象；
   - 再写回 `data.json`。

### 推荐回收策略

建议以“成功同步后的 live set + 宽限期”作为判断依据。

示例：

- 某 stableId 本次成功同步仍存在：更新 `lastSeenAt`
- 某 stableId 本次成功同步不存在：标记为未命中，但不立刻删除
- 连续多次成功同步都不存在，且超过保留窗口：删除 metadata

这样可以避免：

- 因一次权限失败误删；
- 因临时同步异常导致本地语义丢失；
- `data.json` 永久膨胀。

## 实现约束

### 1. 视图层不得自行发明 provider 语义

不允许在视图层写出类似：

- “Apple Reminders 用 dueDate”
- “Dida 用 startDate”

这种硬编码应被封装在 provider 映射或统一日期 helper 中。

### 2. provider 缺失字段不得伪造全量镜像

如果 provider 没有字段，就：

- 要么不支持；
- 要么通过 shadow metadata 最小补足；
- 不要为了“看起来完整”而长期缓存大量外部原始数据。

### 3. 新增来源前必须先补文档

新增外部任务源前，必须先补充：

- stableId 命名空间；
- 日期映射规则；
- shadow metadata 需求；
- 同步窗口策略；
- 清理/降级策略。

没有文档协议，不应直接实现来源接入。

## 与现有文档的关系

本协议补充而不替代以下文档：

- `docs/superpowers/specs/2026-06-26-task-identity-and-manual-order-design.zh-CN.md`

职责边界如下：

- `2026-06-26-task-identity-and-manual-order-design.zh-CN.md`
  - 负责 stableId、手动排序、排序/身份数据清理
- 本文档
  - 负责外部任务日期语义、source mapping、shadow metadata、同步窗口与回收策略

后续涉及两者交叉的改动，应同时遵守两份协议。

## 实施顺序建议

后续实现建议按以下顺序推进：

1. 固化内部日期模型消费规则；
2. 修正 Dida / TickTick 映射，拆分 `startDate / scheduledDate / completedDate`；
3. 扩展 Apple helper，暴露 `completedDate`；
4. 引入 Apple Reminders shadow metadata；
5. 引入统一外部任务同步窗口设置，默认前后 100 天；
6. 加入 metadata 清理与保存前压缩；
7. 审计日历、热力图、筛选、拖拽改期对统一日期模型的依赖；
8. 为后续新增 provider 保留统一接入路径。

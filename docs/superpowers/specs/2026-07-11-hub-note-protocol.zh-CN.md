# Task Hub 统一笔记协议

日期：2026-07-11
状态：生效中

## 目的

Task Hub 后续不再把“关联笔记”“日期笔记”“外部导入笔记”“转写笔记”视为互相独立的数据协议，而是统一收敛为一类 `HubNote`。

本协议用于约束：

- YAML frontmatter 的正式字段；
- 新建笔记的统一 ID 规则；
- 统一解析与写入入口；
- 后续新增笔记类型时的扩展方式。

## 正式字段

新的 Task Hub 笔记应使用以下 frontmatter 字段：

```yaml
---
taskhub-note: true
taskhub-note-id: "thn_20260711103012_abcd"
taskhub-kind: "manual"
title: "Morning note"
taskhub-type: note
taskhub-date: 2026-07-11
taskhub-related:
  - "task:vault:Projects/Launch.md:42:hash"
taskhub-related-history:
  - "task:apple-reminders:abc"
taskhub-created: 2026-07-11T10:30:12.000Z
taskhub-updated: 2026-07-11T10:30:12.000Z
tags:
  - task-hub-note
---
```

字段说明：

- `taskhub-note`
  - 必填。
  - 固定为 `true`，表示该文件受 Task Hub 统一笔记协议管理。
- `taskhub-note-id`
  - 必填。
  - 统一唯一 ID。
- `taskhub-kind`
  - 必填。
  - 表示笔记类型，而不是是否有日期、是否有关联关系。
- `title`
  - 推荐写入。
  - 用于视图展示和编辑器标题同步。
- `taskhub-type`
  - 可选。
  - 当前保留 `note`，主要用于旧日期笔记兼容。
- `taskhub-date`
  - 可选。
  - 表示该笔记显式归属到哪一天。
- `taskhub-related`
  - 可选。
  - 当前关联的任务或事件 key 列表。
- `taskhub-related-history`
  - 可选。
  - 曾经关联过、但已迁移的关系 key 列表。
- `taskhub-created`
  - 必填。
  - ISO 时间戳。
- `taskhub-updated`
  - 必填。
  - ISO 时间戳。

## 当前保留的 `taskhub-kind`

当前协议保留以下内建值：

- `manual`
  - 普通手工笔记、日期笔记、笔记页新建笔记。
- `task-related`
  - 由任务或事件出发创建的关联笔记。
- `transcript`
  - 由语音、会议、录音等转写得到的笔记。
- `imported`
  - 来自外部系统导入的笔记。

规则：

- 新增内建 kind 时，必须同步更新本协议文档、统一 writer、统一 parser 和测试。
- 不允许在局部功能里临时发明一套未记录的 kind。

## 统一 ID 规则

新写入的统一笔记 ID 格式为：

```text
thn_<YYYYMMDDHHmmss>_<4位小写字母数字>
```

示例：

```text
thn_20260711103012_abcd
```

约束：

- 新代码只允许通过统一入口生成 ID；
- 不允许在其他模块手写 `note_...`、`thn_...` 拼接逻辑；
- 读取时仍需兼容旧的 `note_*`、旧测试里存在的简化 `thn_1` 等历史值。

## 统一入口

所有新的 Hub Note 读写必须通过 `src/hubNotes.ts`：

- 创建内容：`createHubNoteContent(...)`
- 解析内容：`parseHubNoteFrontmatter(...)`
- 生成 ID：`createHubNoteId(...)`

约束：

- 不要在新功能里手写 YAML frontmatter 字符串；
- 不要在新功能里自己拼 `taskhub-note-id`；
- 不要绕开 `parseHubNoteFrontmatter(...)` 再单独解析 `taskhub-kind`、`taskhub-date`、`taskhub-related`。

`src/taskNotes.ts` 和 `src/datedNotes.ts` 目前仅作为历史兼容模块保留。后续新功能如果涉及统一笔记，默认应基于 `src/hubNotes.ts` 开发。

## 兼容策略

统一 parser 必须继续识别以下历史格式：

- 旧 task note：
  - `taskhub-note: true`
  - `taskhub-related`
- 旧 dated note：
  - `taskhub-type: note`
  - `taskhub-date`
- 未写入 `taskhub-kind` 的历史笔记：
  - 如果存在 `related` / `history`，默认推导为 `task-related`
  - 否则默认推导为 `manual`

兼容读取不等于继续沿用旧写法。新写入内容必须遵守本协议。

## 后续扩展流程

当需要新增一种笔记类型，例如 `transcript`：

1. 在本协议文档中补充字段语义和使用场景。
2. 在 `src/hubNotes.ts` 中让 writer 能写出该 `taskhub-kind`。
3. 在统一 parser 的测试中加入解析案例。
4. 在需要的视图中增加该类型的最小渲染支持。

如果只改了 UI，没有改协议和测试，不算协议落地完成。

## 验收标准

协议生效后，至少满足：

- 新创建的统一笔记一定写出 `taskhub-kind`
- 新创建的统一笔记一定使用统一 ID 生成器
- 统一 parser 能兼容旧格式
- `npm test` 中存在协议级别测试覆盖以上约束

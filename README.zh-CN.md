# Task Hub

[English](README.md)

Task Hub 是一个仅支持 Obsidian 桌面端的任务聚合插件。它会把散落在 vault 各个 Markdown 笔记里的任务集中到任务、日历和标签视图里，让你既保留纯文本笔记的自由，又能有一个统一的任务工作台。

![Task Hub 日历总览](assets/task-hub-calendar-overview.png)

## 兼容性

- **Obsidian：** Task Hub 是仅支持桌面端的插件，`manifest.json` 中声明的 `minAppVersion` 为 `1.5.0`。请使用 Obsidian 桌面端 1.5.0 或更新版本。
- **移动端：** 暂不支持 Obsidian 移动端。
- **本地 Apple 集成：** Apple Reminders 和 Apple Calendar 集成仅支持 macOS，目前支持并验证的范围是 macOS 14 Sonoma 或更新版本。helper 中保留了旧版 EventKit 权限请求路径，但 macOS 13 及更早版本不属于当前测试支持矩阵。
- **其他桌面系统：** vault 任务、标签、日历和公共 ICS 等核心功能面向 Obsidian 桌面端；Apple Reminders 和 Apple Calendar 功能在非 macOS 系统上不可用。

## 功能

- 扫描 vault 中的 Markdown 任务：`- [ ]` 和 `- [x]`。
- 点击任务可打开源笔记，并定位到原任务行附近。
- 支持安全完成 vault 任务：写回前会确认源行仍匹配，避免改错行。
- 提供任务视图、日历视图和标签视图。
- 支持按完成状态、来源、标签、日期分组、文本和自定义且/或条件筛选。
- 支持日期语法：`📅 YYYY-MM-DD` 和 `due:: YYYY-MM-DD`。
- 支持按日、周、月查看有日期的任务和外部日历事件。
- 支持在日历中拖动 vault Markdown 任务卡片改期；开启对应写回后，也支持拖动 Apple Reminders 和 Apple Calendar 事件改到另一天。
- 支持只读公共 ICS 日历源。
- 在本地 helper 可用时，支持 macOS 桌面端读取已通过 iCloud 同步到本机的 Apple Reminders 和 Apple Calendar。
- 开启创建权限后，可通过编辑器右键菜单、命令面板、用户自定义快捷键或 Task Hub 任务详情，把某条 vault Markdown 任务显式发送到 Apple 提醒事项。
- 支持为任务和日历事件创建本地 Markdown 关联笔记；关联关系写入 YAML frontmatter，在任务/事件详情中展示，有笔记的任务行可显示笔记数。
- 可选创建兼容 [Thino](https://github.com/Quorafind/Obsidian-Thino) multi-file 存储的笔记。
- 支持在插件设置中切换英文和中文界面。

## 使用方式

启用 Task Hub 后，可以通过左侧 ribbon 图标或命令面板中的 **Open Task Hub** 打开任务工作台。

任务视图会把 vault 任务和支持的外部任务来源集中显示。左侧栏可按来源或标签筛选；顶部工具栏可切换是否显示已完成任务、打开条件筛选、按文本搜索，或重新扫描 vault。

开启本地 Apple 和 Apple 提醒事项后，单独打开 **从 vault 任务创建 Apple 提醒事项** 设置，即可一条一条地从 vault Markdown 任务创建提醒事项。入口包括任务行上的编辑器右键菜单、命令面板中的 **将当前任务发送到 Apple 提醒事项**、你在 Obsidian 中绑定到该命令的快捷键，以及 Task Hub 任务详情里的操作按钮。

开启滴答清单集成后，Task Hub 可以通过配置的 API 口令读取滴答清单 / TickTick 任务。设置中可分别控制创建、编辑/完成写回、拖动改期、删除、默认清单、默认提醒提前量和每个清单的颜色。从 vault Markdown 任务发送到滴答是显式操作；Task Hub 会先创建外部任务，再删除源 Markdown 任务行。

日历视图会合并有日期的任务、公共 ICS 事件、Apple Calendar 事件，以及可用的有日期 Apple Reminders。你可以在月、周、日布局之间切换。把 vault Markdown 任务卡片拖到另一天，会更新该任务现有的 `📅 YYYY-MM-DD` 或 `due:: YYYY-MM-DD` 日期。开启对应写回后，也可以拖动有日期的 Apple Reminder 卡片和 Apple Calendar 事件卡片来修改日期。

标签视图会按标签聚合索引到的任务，并支持查看某个标签下的具体任务。

## 外部来源支持矩阵

| 能力 | Apple Calendar | Apple Reminders | 滴答清单 / TickTick |
| --- | --- | --- | --- |
| 平台 / 后端 | macOS 桌面端本地 helper | macOS 桌面端本地 helper | HTTPS Open API |
| 读取到 Task Hub | 支持：日历事件 | 支持：提醒事项 | 支持：任务，包括收集箱 |
| 从 Task Hub 创建 | 支持：开启 Apple Calendar 任务发送后可创建日历事件 | 支持：开启提醒事项创建后可创建提醒事项 | 支持：开启滴答创建后可创建任务 |
| 编辑标题 / 备注 | 支持：开启 Apple Calendar 写回后 | 支持：开启提醒事项写回后 | 支持：开启滴答写回后 |
| 完成 / 重新打开 | 不适用于日历事件 | 支持：开启提醒事项写回后 | 支持：开启滴答写回后 |
| 拖动改期 | 支持：开启 Apple Calendar 写回后 | 支持：开启提醒事项写回和拖动开关后 | 支持：开启滴答写回和拖动开关后 |
| 移动清单 / 日历 | 可在可写日历已加载时为编辑事件选择日历 | 支持：开启提醒事项创建/写回相关开关后 | 支持：开启滴答写回后 |
| 删除外部项目 | 不支持 | 不支持 | 支持：开启滴答删除后 |
| 将 vault Markdown 任务发送到外部来源 | 无直接发送；可在日历 UI 中创建日历事件 | 支持：开启创建后显式发送 | 支持：开启创建后显式发送 |
| 标签读取 | 不适用于日历事件 | 支持：通过提醒事项标题中的 hashtag | 支持：滴答原生 `tags` 字段会映射为 Task Hub hashtag |
| 标签写入 | 不适用于日历事件 | 支持：开启标签创建后写入 Apple 兼容的标题 hashtag | 支持：开启原生标签同步后写入滴答原生任务标签 |
| 日期 / 时间写入 | 支持：事件日期和时间 | 支持：提醒事项到期日期/时间（可用时） | 支持：任务日期、时间和提醒 |
| 重复规则 | 读取/写入有限；拖动重复事件时只保存被拖动的单次 occurrence | 可读取展示可用信息，暂未提供完整重复编辑 UI | 同步 payload 中已有重复信息会保留；暂未提供完整重复编辑 UI |

## 任务笔记

任务笔记是可选的本地 Markdown 笔记，可以关联到 Task Hub 中的任务或日历事件。开启任务笔记后，右键任务或日历项，选择 **创建关联笔记** 即可新建笔记。Task Hub 会把关联关系写入笔记的 YAML frontmatter，并在任务或事件详情里用单独的笔记容器展示相关笔记正文。任务列表也可以在有笔记的任务行右上角显示笔记数。

笔记卡片本身只负责展示，不会点击跳转。使用笔记右上角的三点菜单，可以删除笔记、在 Task Hub 弹窗中编辑笔记，或在开启 Thino multi-file 选项时打开为 Thino 笔记。

Task Hub 可以创建普通 Task Hub 笔记，也可以创建兼容 Thino multi-file 的笔记。Thino 选项只支持 [Thino](https://github.com/Quorafind/Obsidian-Thino) multi-file 存储，因为这个模式会把每条 memo 保存成带 YAML frontmatter 的独立 Markdown 文件。Task Hub 不生成也不修改 Thino single-file、Canvas 或日记存储内容。

当 vault Markdown 任务被发送到 Apple Reminders 时，Task Hub 会先更新相关笔记的 frontmatter，再删除原任务行，确保笔记继续关联到新创建的 Apple Reminder。

## iCloud 提醒事项和日历

Task Hub 通过 macOS 本地的 Reminders 和 Calendar 数据库集成 Apple 数据。如果你的 Mac 已登录 iCloud，并开启了提醒事项/日历同步，Task Hub 可以显示原生 Apple 应用中同一批 iCloud 同步下来的提醒事项和日历事件。Task Hub 不会连接 iCloud.com，也不会索要 Apple ID 密码；账号同步和权限授权都由 macOS 本地处理。

Apple Reminders 支持读取提醒标题、清单、完成状态、备注、URL 和提醒日期。开启 Apple Reminders 写回后，Task Hub 可以把提醒事项标记为完成或重新打开，也可以在日历中拖动有日期的提醒事项来修改提醒日期。开启创建权限后，vault Markdown 任务还可以由用户显式发送到 Apple Reminders。

Apple Calendar 支持把本地/iCloud 日历事件读入 Task Hub 日历，包括标题、日历名称、开始/结束时间、全天状态、地点、备注和可用的 URL。开启 Apple Calendar 写回后，Task Hub 可以把日历事件拖动到另一天，并保留事件原来的时间、时长和全天状态。重复事件会按当前拖动的单次 occurrence 保存。

## 当前边界

第一批版本优先保证稳定、轻依赖和可维护：

- vault 内 Markdown 任务可以在 Task Hub 中完成。
- 已有支持日期语法的 vault Markdown 任务可以在日历中拖动改期。
- vault 内 Markdown 任务只有在用户明确触发时才会发送到 Apple 提醒事项；Task Hub 会记录已创建的提醒事项 id，避免重复发送。
- vault 内 Markdown 任务只有在用户明确触发时才会发送到滴答清单；Task Hub 会记录已创建的滴答任务 id，避免重复发送。
- 任务笔记是本地 Markdown 文件。Thino 集成仅限兼容 Thino multi-file 的笔记；Thino single-file、Canvas 和日记存储不在当前支持范围内。
- Apple Reminders 完成状态/日期写回，以及 Apple Calendar 事件日期写回，都是可选能力，需要在设置中单独开启。
- 滴答清单的完成、编辑、拖动改期、创建、删除和原生标签同步都是可选能力，需要在设置中分别开启。滴答 API 口令会保存在 Obsidian 插件数据中；开发测试建议使用测试账号或在测试后轮换口令。
- 公共 ICS 事件只读。
- 暂不支持 Obsidian Tasks 插件完整语法。
- 暂不支持 Markdown 任务的具体开始/结束时间、Google Calendar OAuth、Microsoft Calendar OAuth 和移动端。

## 隐私

Task Hub 会在本地扫描当前 vault 的 Markdown 文件，并把插件设置保存在 vault 的 Obsidian 插件数据中。公共 ICS 只会访问你手动配置的 URL。本地 Apple 集成仅在 macOS 桌面端运行，并会先通过 macOS 权限系统请求提醒事项或日历访问权限。iCloud 提醒事项和日历数据仍由 Apple 本地同步服务管理；Task Hub 不会直接访问 iCloud 服务器。

Task Hub 不会把 vault 任务发送到远程服务。

## 为什么需要这些权限？

Obsidian 插件审核页可能会显示一些能力警告。Task Hub 使用这些能力的范围如下：

- **枚举 vault 文件：** Task Hub 需要扫描 vault 中的 Markdown 文件，查找任务行和日期标记。
- **读取/写入 vault：** Task Hub 读取单个笔记用于索引；只有在你完成、删除、编辑或拖动改期支持的任务时才写回。Markdown 任务写回前会确认原始任务行仍匹配，避免改错行。
- **文件系统访问：** 插件会在 macOS 桌面端检查并安装位于插件目录内的可选 Local Apple helper。
- **执行 shell 命令：** 插件只会启动随插件打包的 `taskhub-apple-helper`，用于可选的 Apple Reminders 和 Apple Calendar 集成。helper 通过 macOS 本地权限读取提醒事项/日历，不会索要 Apple ID。
- **网络请求：** Task Hub 只会请求你手动配置的公共 ICS 日历 URL。

## 安装

当 Task Hub 上架 Obsidian 社区插件市场后，可从 **设置 -> 第三方插件 -> 浏览** 中安装。

从 GitHub Release 手动安装：

1. 从最新 release 下载 `manifest.json`、`main.js` 和 `styles.css`。
2. 在 vault 中创建目录：`.obsidian/plugins/task-hub/`。
3. 把下载的文件复制到该目录。
4. 重启 Obsidian 或重新加载第三方插件，然后启用 **Task Hub**。

本地 Apple Reminders 和 Apple Calendar 支持依赖插件包内的 `taskhub-apple-helper` 二进制文件。GitHub release 附件会保持为 Obsidian 支持的标准文件（`main.js`、`manifest.json` 和 `styles.css`）；helper 通过插件包/源码构建路径分发，不作为额外 release 附件上传。

## 开发

```bash
npm install
npm test
npm run typecheck
npm run build
```

常用命令：

```bash
npm run dev
npm run dev:hot
npm run smoke
npm run check:apple-helper
npm run diagnose:apple
```

在 macOS 上构建可选 Apple helper：

```bash
npm run build:apple-helper
```

## 发布附件

Obsidian 社区插件 release 的 GitHub tag 必须和 `manifest.json` 中的 `version` 完全一致，并上传这些二进制附件：

- `main.js`
- `manifest.json`
- `styles.css`

仓库根目录也保留 Obsidian 初次提交所需的基础文件：

- `README.md`
- `LICENSE`
- `manifest.json`
- `versions.json`

不要在社区插件 GitHub release 中额外上传 `taskhub-apple-helper` 等文件。Obsidian 只会从 release 附件下载 `main.js`、`manifest.json` 和 `styles.css`。

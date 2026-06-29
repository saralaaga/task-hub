# AGENTS.md

本文件是 `/Users/carlos/Coding/ObPlugin` 的协作约定。后续 agent 进入本仓库时，先读这里，再读 `README.md` 和相关源码。

## 项目定位

这是一个 Obsidian 插件项目，插件名是 **Task Hub**。目标是把散落在 vault 各个 Markdown 笔记里的任务集中展示，并提供：

- 任务总览、筛选、标签汇总。
- 点击任务跳转回源笔记对应行。
- 安全地把源笔记里的 `- [ ]` 改成 `- [x]`。
- 按日、周、月查看有日期的任务和外部日历事件。
- 支持中英文界面。
- 支持只读公共 ICS 日历源。
- 支持 macOS 桌面端读取本地 Apple Reminders 和 Apple Calendar，并可在用户显式开启后回写完成 Apple Reminders。

第一版重点是“可用、稳定、轻依赖”。不要为了视觉或架构洁癖引入大型 UI 框架或日历库，除非明确讨论并确认。

## 技术栈

- TypeScript
- Obsidian Plugin API
- esbuild
- Jest
- 原生 DOM 渲染
- 插件样式在 `src/styles.css`

不要提交生成物：

- `main.js` 是构建产物，已在 `.gitignore`。
- `node_modules/` 不提交。

注意：Obsidian 插件实际安装目录需要 `styles.css`，但仓库源码跟踪的是 `src/styles.css`。同步到测试 vault 时，需要把 `src/styles.css` 复制成目标目录里的 `styles.css`。

Obsidian 社区插件 id 是 `task-hub`。测试 vault 的推荐安装目录也使用 `.obsidian/plugins/task-hub/`，避免和 manifest id 不一致。

## 常用命令

安装依赖：

```bash
npm install
```

完整验证：

```bash
npm test
npm run typecheck
npm run build
```

开发 watch build：

```bash
npm run dev
```

当前测试 vault 路径：

```text
/Users/carlos/Coding/testValut
```

同步到测试 vault：

```bash
npm run build
mkdir -p /Users/carlos/Coding/testValut/.obsidian/plugins/task-hub
cp manifest.json main.js /Users/carlos/Coding/testValut/.obsidian/plugins/task-hub/
cp src/styles.css /Users/carlos/Coding/testValut/.obsidian/plugins/task-hub/styles.css
```

写入测试 vault 在当前沙箱里通常需要权限提升。

## 代码结构

核心文件：

- `src/main.ts`：插件生命周期、命令、ribbon、view 注册、设置、扫描和同步入口。
- `src/settings.ts`：插件设置页和 ICS 源配置。
- `src/types.ts`：任务、日历、设置等领域类型。
- `src/i18n.ts`：中英文翻译键。
- `src/parsing/taskParser.ts`：Markdown 任务解析。
- `src/indexing/taskIndex.ts`：vault 任务索引和文件缓存状态。
- `src/indexing/taskActions.ts`：安全完成任务的文本更新逻辑。
- `src/filtering/filters.ts`：任务筛选和日期分组。
- `src/filtering/tagStats.ts`：标签统计。
- `src/calendar/icsClient.ts`：ICS 拉取、解析、错误分类。
- `src/calendar/calendarModel.ts`：任务和事件合并成日历项。
- `src/views/TaskHubView.ts`：主视图状态和 view 切换。
- `src/views/renderShell.ts`：顶部工具条、筛选和主容器。
- `src/views/renderTasksView.ts`：任务列表。
- `src/views/renderTagsView.ts`：标签统计视图。
- `src/views/renderCalendarView.ts`：日历月视图、日/周时间轴视图。
- `src/styles.css`：所有插件样式。

文档：

- `README.md`：用户和开发基本说明。
- `docs/manual-test-vault.md`：Obsidian 手工测试清单。
- `docs/superpowers/specs/2026-05-05-obsidian-task-hub-design.md`：需求和设计背景。
- `docs/superpowers/specs/2026-06-26-task-identity-and-manual-order-design.zh-CN.md`：任务稳定身份、列表手动排序、外部任务源命名空间，以及 `data.json` 的脏数据恢复、失败降级和增长控制的稳定协议文档。后续如果修改 stableId、列表手动排序、任务迁移追踪或接入新的外部任务源，先读这份文档，再动实现。
- `docs/superpowers/specs/2026-06-29-external-task-source-date-and-sync-contract.zh-CN.md`：外部任务源日期语义、source mapping、shadow metadata、同步窗口、metadata 回收与增长控制协议。后续如果修改外部任务日期模型、接入新的外部任务源、调整 Apple Reminders / Dida / TickTick 的日期映射、或修改外部任务同步窗口与本地 metadata 清理，先读这份文档，再动实现。
- `docs/superpowers/plans/2026-05-05-obsidian-task-hub-implementation.md`：第一版实现计划记录。

## 当前能力边界

已实现：

- Markdown 任务语法：`- [ ]`、`- [x]`。
- 日期语法：`📅 YYYY-MM-DD`、`due:: YYYY-MM-DD`、裸写的 `YYYY-MM-DD`。
- 标签解析：Obsidian 风格 `#tag`。
- 任务筛选：状态、日期桶、标签、来源路径、文本搜索。
- 任务跳转：打开源笔记并定位到任务行附近。
- 安全完成：只有确认源行仍匹配时才写回。
- 标签统计和标签 drilldown。
- 日历：月视图、周视图、日视图。
- 周/日视图支持有具体时间的 ICS 事件纵向时间轴。
- vault 任务目前是全天日期项。
- 多个只读公共 ICS 源、颜色、启用/禁用、同步状态和缓存事件。
- 本地 Apple Reminders / Apple Calendar 同步，设置页可开关。
- 本地 Apple Reminders 完成状态回写，设置页可开关；未开启时外部提醒事项复选框必须禁用。
- 本地 Apple Reminders / Apple Calendar 正式同步路径应通过插件安装目录中的 `taskhub-apple-helper` 调用 EventKit；不要把 AppleScript/JXA 作为默认后端。
- Apple Calendar 中 `writable: false` 的日历（例如生日、节假日、订阅/系统日历）必须只读渲染和展示；不要提供改期、编辑、删除或转换为提醒事项等会修改/移除源事件的操作。
- 普通用户不需要 Xcode；开发者构建 helper 时需要 macOS Swift 工具链。
- Obsidian 社区插件官方 Release 附件默认是 `manifest.json`、`main.js`、可选 `styles.css`；当前 `taskhub-apple-helper` 先作为可选本地/开发能力记录，除非设计并验证单独分发路径，否则不要声称插件市场会自动安装 helper。
- English / 中文 UI。

尚未实现，不要声称已经支持：

- Obsidian Tasks 插件完整语法兼容。
- timed task 语法，也就是笔记任务自身的具体开始/结束时间。
- Google Calendar / Microsoft Calendar OAuth。
- 编辑或创建外部日历事件。
- 创建、编辑或删除外部任务；Apple Reminders 目前只支持可选“完成”回写。
- 移动端适配验证。

## 实现约定

- 保持依赖轻量。新增依赖前先确认必要性。
- 纯逻辑优先写在可测试模块里，避免塞进 Obsidian runtime 类。
- UI 渲染继续使用小型 DOM renderer，不要临时引入 React/Vue/Svelte。
- 任务写回必须保守：不能确认源行时，宁可报冲突，也不要改错行。
- vault 扫描要避免阻塞 Obsidian：优先使用 `mtime + size` 缓存判断，只扫描 Markdown 文件。
- 日历外部源默认只读。失败时保留最后一次成功缓存，并展示错误状态。
- 如果改动涉及任务稳定身份、同日期手动排序、Task Hub 内编辑后的任务追踪、或新增外部任务源，必须先阅读 `docs/superpowers/specs/2026-06-26-task-identity-and-manual-order-design.zh-CN.md`，并遵守其中的 stableId 命名空间、继承策略和 `data.json` 清理约定；不要为单个来源临时发明一套独立身份模型。
- 如果改动涉及外部任务日期语义、Apple Reminders / Dida / TickTick 的字段映射、外部任务同步窗口、shadow metadata 持久化或回收策略，必须先阅读 `docs/superpowers/specs/2026-06-29-external-task-source-date-and-sync-contract.zh-CN.md`；不要把 `data.json` 做成外部任务全量镜像，也不要为单个 provider 临时发明一套独立日期模型。
- 新增用户可见文案时同步更新 `src/i18n.ts` 的英文和中文。
- 插件本体必须长期维护英文和中文两个语言版本；新增按钮、设置、状态、错误提示、空状态和可访问标题时，都要同步补齐 `en` 与 `zh`。
- 面向用户的文档默认维护中英双语，尤其是 `README.md`、安装说明、发布说明和手工测试清单。
- 样式必须 scoped 到 `.task-hub-*`，不要污染 Obsidian 全局。
- 日/周/月布局要兼顾窄 pane，不要让文字溢出按钮或卡片。

## 发布约定

- `manifest.json` 的 `id` 必须保持为 `task-hub`，不要包含 `obsidian`。
- `manifest.json` 的 `version`、`versions.json` 和 GitHub Release tag 必须一致，例如 `0.1.0`。
- 社区插件 Release 附件至少上传 `main.js`、`manifest.json`、`styles.css`。
- `README.md` 和 `LICENSE` 必须保留在仓库根目录。
- 发布前必须重新跑 `npm test`、`npm run typecheck`、`npm run build`、`npm run smoke`。
- 正式 release 前还要跑 `npm run release:assets`，确认 `dist/` 中至少有 `main.js`、`manifest.json`、`styles.css`；如果本地 Apple helper 已构建，`dist/taskhub-apple-helper` 只能作为可选本地集成附件，不要把它说成社区插件市场会自动安装。
- 发版时同步更新 `package.json`、`package-lock.json`、`manifest.json`、`versions.json`，再提交、打 tag、推送分支和 tag，最后用 `gh release create <version> dist/main.js dist/manifest.json dist/styles.css ...` 创建 GitHub Release。tag 当前沿用无 `v` 前缀格式，例如 `0.1.13`。
- Release 创建后用 `gh release view <version> --json url,tagName,name,assets` 验证附件状态、文件名和 tag；不要只凭命令退出码就宣称完成。
- 如果 Apple helper 要进入普通用户分发路径，先单独设计签名、权限、Release 附件和安装说明；不要在未验证前把它写成社区插件自动安装能力。

### 近期发版踩坑记录

- 本仓库有时会在 detached HEAD 上完成 release 修复，而且 `main` 可能被另一个 worktree 占用。发版前先跑 `git status --short --branch`、`git log -1 --oneline --decorate`、`git worktree list`。如果当前提交是远端 `main` 的快进后继，但无法 `git switch main`，可以用 `git push origin HEAD:main` 推送；不要用 `git reset --hard` 去移动被其他 worktree 占用的 `main`。
- tag 创建可能因为 `.git/refs/tags/*.lock` 沙箱权限失败；需要时用提升权限执行 `git tag <version> HEAD`。创建 tag 后再推送 `git push origin <version>`，最后确认 `git log -1 --decorate` 同时显示 `tag: <version>` 和 `origin/main`。
- `gh release create` 如果输出 `error connecting to api.github.com`，不要立刻假定 release 没创建成功。先用提升权限跑 `gh release view <version> --json url,tagName,name,assets,isDraft,isPrerelease`；之前出现过普通 `gh release create` 报网络错误但 release/附件实际已创建或部分创建的情况。
- GitHub Release 必须验证三个附件恰好可用：`main.js`、`manifest.json`、`styles.css`，并且 `state` 为 `uploaded`、`tagName` 等于版本号。最终回复里要给 release URL、commit hash、tag、验证命令结果。
- 0.3.5/0.3.6 的教训：不要只靠“构建通过”就发布 Obsidian UI 交互改动。凡是弹窗、workspace leaf、MarkdownView、设置页、Thino/Task Hub 关联笔记这类 runtime 行为，发布前必须同步到 `/Users/carlos/Coding/testValut/.obsidian/plugins/task-hub/`，用 `cmp -s` 确认三件套一致，并在真实 Obsidian 中手工验证关键路径；如果因为 Computer Use 权限或其他限制无法手工验证，最终说明必须明确写“未完成真实 Obsidian 手工验证”。

## 测试约定

改动后按风险选择验证：

- 解析、筛选、日历模型、ICS：必须加或更新 Jest 测试。
- UI 文案和布局：至少跑 `npm run typecheck`、`npm run build`，必要时同步到测试 vault 手工看。
- 任务写回逻辑：必须跑相关测试，重点看冲突保护。
- 设置项 schema 变化：确认 `DEFAULT_SETTINGS`、`TaskHubSettings`、设置页和旧数据兼容。

标准验证命令：

```bash
npm test
npm run typecheck
npm run build
```

如果同步到测试 vault，建议用 `cmp -s` 确认：

```bash
cmp -s main.js /Users/carlos/Coding/testValut/.obsidian/plugins/task-hub/main.js
cmp -s manifest.json /Users/carlos/Coding/testValut/.obsidian/plugins/task-hub/manifest.json
cmp -s src/styles.css /Users/carlos/Coding/testValut/.obsidian/plugins/task-hub/styles.css
```

## Obsidian 特别注意

- `workspace.getLeaf("tab")` 用于在主编辑区新标签页打开 Task Hub。
- 已打开 Task Hub 时应 reveal 现有 leaf，避免重复打开多个 Task Hub。
- 命令面板里的命令名称在插件加载时注册；语言切换后可能需要重载插件才会更新命令名称。
- Obsidian runtime 行为不能只靠单元测试确认，重要 UI/工作区行为要在真实 vault 里验证。

## Git 和远端

当前远端 PR 是：

```text
https://github.com/saralaaga/task-hub/pull/1
```

本机 git 全局代理可能配置为 `127.0.0.1:7897`。如果代理未启动，或当前沙箱不允许 `git` 进程连接本机代理端口，push / ls-remote 可能卡住或失败，并出现 `Failed to connect to 127.0.0.1 port 7897`。有时可用的推送方式是临时清空代理：

```bash
git -c http.proxy= -c https.proxy= push
```

但如果 `nc -vz 127.0.0.1 7897` 成功而直连 GitHub 超时，清空 proxy 反而会失败；这时要使用全局代理并提升权限：

```bash
git push origin HEAD:main
git push origin <version>
```

如果出现 `Error in the HTTP2 framing layer`，可先重试一次：

```bash
git -c http.version=HTTP/1.1 push origin HEAD:main
```

排查 GitHub 网络问题时先区分 git 和 GitHub CLI：

```bash
git config --global --get-regexp '^(http|https)\..*proxy$|^http\.proxy$|^https\.proxy$'
git ls-remote --tags origin <version>
git -c http.proxy= -c https.proxy= ls-remote --tags origin <version>
gh api rate_limit
gh release view <version> --json url,tagName,name,assets
```

`git` 会读取 git 全局代理配置；`gh` 通常不读取 git 的 `http.proxy` / `https.proxy`，更受 shell 环境里的 `HTTP_PROXY` / `HTTPS_PROXY` / `ALL_PROXY` 和当前网络权限影响。若 `gh api rate_limit` 能成功，而普通 `git ls-remote` 失败且临时清空代理后成功，根因就是 git 全局代理指向了未启动的本地代理服务，而不是 GitHub CLI 或 GitHub Release 本身坏了。

如果需要进一步确认，分别测试三层：

```bash
nc -vz 127.0.0.1 7897
curl -I --proxy http://127.0.0.1:7897 https://github.com
GIT_CURL_VERBOSE=1 git ls-remote --tags origin <version>
```

如果 `nc` 和 `curl --proxy` 成功，但普通 `git` 报 `Immediate connect fail for 127.0.0.1: Operation not permitted`，说明 VPN/proxy 本身是好的，问题在当前执行环境的沙箱权限；用提升权限执行 git，或用 `git -c http.proxy= -c https.proxy= ...` 直连绕过本机代理即可。若提升权限后 `git` 通过 7897 成功，则可确认不是 GitHub CLI 或 VPN 的问题。

如果直连 GitHub 也超时，不要反复无限等待。记录本地 commit hash、验证结果和 `[ahead N]` 状态，让后续在网络恢复后补推。

提交信息遵循项目已有 Lore 风格：第一行写“为什么改”，正文说明约束和取舍，尾部记录 `Constraint:`、`Rejected:`、`Confidence:`、`Scope-risk:`、`Tested:`、`Not-tested:` 等信息。

## 给后续 agent 的提醒

- 用户偏好中文说明和可验证结果。
- 不要把未验证的 Obsidian 手工行为说成已经验证。
- 远端推送失败时继续诊断网络，但不要把本地已完成和已推送混为一谈。
- 维护 Apple Reminders / Apple Calendar 本地集成时，保持 macOS-only 降级和只读边界；不要在未设计写入流程前完成或修改系统提醒事项。
- 当前 Apple Reminders 只允许在用户开启回写开关后写入完成状态；任何更多写入能力都需要先更新设计、测试和中英文文档。

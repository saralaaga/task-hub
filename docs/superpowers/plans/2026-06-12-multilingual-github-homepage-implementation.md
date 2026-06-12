# Multilingual GitHub Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the GitHub README into a product-style homepage and add complete user-facing README pages in English, Simplified Chinese, Japanese, Korean, French, and Spanish.

**Architecture:** Use `README.md` as the canonical GitHub landing page and keep localized pages at the repository root with matching language switchers. Localized pages cover user-facing content fully while linking to English for volatile development and release details.

**Tech Stack:** Markdown, existing screenshot assets, existing repository metadata.

---

### Task 1: Rewrite English GitHub Homepage

**Files:**
- Modify: `README.md`

- [x] **Step 1: Replace the existing README with product-homepage structure**

Use these sections in order:

```markdown
# Task Hub

[English](README.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Français](README.fr.md) | [Español](README.es.md)

Task Hub is a desktop-only Obsidian plugin that brings Markdown tasks, Apple Reminders, Apple Calendar events, public ICS calendars, and Dida/TickTick tasks into one focused workspace.

![Task Hub calendar overview](assets/task-hub-calendar-overview.png)

## Why Task Hub?
## Highlights
## Supported Sources
## Compatibility
## Installation
## Everyday Use
## Privacy and Permissions
## Current Limits
## Development
## Release Assets
```

- [x] **Step 2: Preserve accurate boundaries**

Make sure the English README says:

- Desktop-only Obsidian plugin.
- `manifest.json` currently declares `minAppVersion` `1.7.2`.
- Apple Reminders and Apple Calendar are macOS-only.
- Public ICS is read-only.
- Apple and Dida/TickTick writeback features are optional.
- Mobile, full Obsidian Tasks grammar, Google Calendar OAuth, and Microsoft Calendar OAuth are not supported.

- [x] **Step 3: Keep maintainer details concise but available**

Retain development commands:

```bash
npm install
npm test
npm run typecheck
npm run build
```

Retain release asset requirements:

```text
main.js
manifest.json
styles.css
```

### Task 2: Rewrite Simplified Chinese User Page

**Files:**
- Modify: `README.zh-CN.md`

- [x] **Step 1: Mirror the user-facing structure**

Use these sections:

```markdown
# Task Hub

[English](README.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Français](README.fr.md) | [Español](README.es.md)

## 为什么需要 Task Hub？
## 功能亮点
## 支持的来源
## 兼容性
## 安装
## 日常使用
## 隐私和权限
## 当前边界
## 开发
```

- [x] **Step 2: Keep localized wording user-focused**

Mention development documentation briefly and link readers to `README.md`; do not duplicate the full release workflow.

### Task 3: Add Japanese, Korean, French, and Spanish User Pages

**Files:**
- Create: `README.ja.md`
- Create: `README.ko.md`
- Create: `README.fr.md`
- Create: `README.es.md`

- [x] **Step 1: Add each localized page**

Each page must include:

- The same language switcher.
- The same screenshot path: `assets/task-hub-calendar-overview.png`.
- User-facing sections equivalent to English through current limits.
- A short development note linking back to `README.md`.

- [x] **Step 2: Use conservative localized claims**

For every language, include the same boundaries:

- Desktop-only.
- macOS-only Apple integration.
- Read-only ICS.
- Optional writeback controls.
- No mobile support.
- No full Obsidian Tasks grammar.
- No Google/Microsoft Calendar OAuth.

### Task 4: Documentation Sanity Check

**Files:**
- Verify: `README.md`
- Verify: `README.zh-CN.md`
- Verify: `README.ja.md`
- Verify: `README.ko.md`
- Verify: `README.fr.md`
- Verify: `README.es.md`
- Verify: `manifest.json`

- [x] **Step 1: Confirm required files exist**

Run:

```bash
for file in README.md README.zh-CN.md README.ja.md README.ko.md README.fr.md README.es.md; do test -f "$file" || exit 1; done
```

Expected: exits with status 0.

- [x] **Step 2: Confirm every language switcher target exists**

Run:

```bash
for target in README.md README.zh-CN.md README.ja.md README.ko.md README.fr.md README.es.md; do test -f "$target" || exit 1; done
```

Expected: exits with status 0.

- [x] **Step 3: Check minimum app version wording**

Run:

```bash
grep -n "1.7.2" README.md README.zh-CN.md README.ja.md README.ko.md README.fr.md README.es.md
```

Expected: each README contains `1.7.2`.

- [x] **Step 4: Check unsupported-feature wording**

Run:

```bash
grep -n "Google" README.md README.zh-CN.md README.ja.md README.ko.md README.fr.md README.es.md
grep -n "Microsoft" README.md README.zh-CN.md README.ja.md README.ko.md README.fr.md README.es.md
```

Expected: each README mentions Google and Microsoft calendar OAuth as unsupported.

- [x] **Step 5: Review git diff**

Run:

```bash
git diff -- README.md README.zh-CN.md README.ja.md README.ko.md README.fr.md README.es.md docs/superpowers/specs/2026-06-12-multilingual-github-homepage-design.md docs/superpowers/plans/2026-06-12-multilingual-github-homepage-implementation.md
```

Expected: documentation-only diff, no runtime code changes.

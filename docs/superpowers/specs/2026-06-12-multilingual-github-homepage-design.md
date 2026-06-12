# Multilingual GitHub Homepage Design

## Goal

Make Task Hub's GitHub repository page feel like a polished product homepage for ordinary Obsidian users, while adding complete user-facing introductions in English, Simplified Chinese, Japanese, Korean, French, and Spanish.

## Approved Direction

The approved direction is the product-homepage approach:

- `README.md` remains the default GitHub landing page and leads with the product promise, language links, screenshot, installation, and user-facing capabilities.
- `README.zh-CN.md`, `README.ja.md`, `README.ko.md`, `README.fr.md`, and `README.es.md` become complete localized user introduction pages.
- Development and release-engineering details stay concise in localized pages and point back to the English README to avoid six copies of volatile maintainer documentation.

## Primary Audience

The primary reader is an ordinary Obsidian desktop user evaluating whether Task Hub fits their workflow. The first screen should answer:

- What problem does Task Hub solve?
- What does it look like?
- Which platforms and external sources are supported?
- How do I install it?
- What data does it read or write?

Developer, reviewer, and release-maintainer information remains available, but it should not dominate the first screen.

## Language Set

Initial language set:

- English: `README.md`
- Simplified Chinese: `README.zh-CN.md`
- Japanese: `README.ja.md`
- Korean: `README.ko.md`
- French: `README.fr.md`
- Spanish: `README.es.md`

Each page should include a language switcher at the top. The language switcher should use stable relative links so it works on GitHub and in local Markdown preview.

## Information Architecture

### Default GitHub Homepage

`README.md` should use this structure:

1. Title and language switcher.
2. One-sentence product promise.
3. Main screenshot.
4. Short value proposition for Obsidian users.
5. Core highlights.
6. Supported sources and writeback boundaries.
7. Compatibility.
8. Installation.
9. Usage overview.
10. Privacy and permissions.
11. Current limits.
12. Development and release assets.

### Localized User Pages

Localized pages should use the same user-facing structure through the current limits section. They should include a short development note that links back to `README.md`, but should not duplicate full release engineering instructions.

## Content Rules

- Keep claims conservative and match the current implementation.
- State that Task Hub is desktop-only.
- State that Apple Reminders and Apple Calendar integration is macOS-only and mediated through the local helper.
- Do not imply that Obsidian mobile is supported.
- Do not imply full Obsidian Tasks plugin grammar support.
- Do not imply Google Calendar or Microsoft Calendar OAuth support.
- Explain that public ICS calendars are read-only.
- Explain that writeback features are optional and must be enabled.
- Explain that Task Hub does not ask for an Apple ID password and does not talk directly to iCloud servers.
- Keep Dida/TickTick wording as an optional Open API integration.

## Maintenance Model

English is the canonical maintainer page for development and release details. Localized pages are complete enough for users but intentionally lighter for contributor/release details.

When future user-visible capabilities change, update all six language pages together. When only build, test, or release workflow changes, update English first and only adjust localized pages if user-facing installation behavior changes.

## Verification

Because this is documentation-only work:

- Run a link/path sanity check for all README files.
- Check that all language files exist and contain the same language switcher targets.
- Check that `manifest.json` version and minimum app version wording are not contradicted.
- Run `npm run typecheck` and `npm run build` only if code or package metadata changes. For README-only changes, they are optional and not required to prove behavior.

## Out of Scope

- No plugin runtime behavior changes.
- No new screenshots.
- No GitHub Pages site.
- No additional language beyond English, Simplified Chinese, Japanese, Korean, French, and Spanish in this pass.
- No generated release assets.

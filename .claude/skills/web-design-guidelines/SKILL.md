---
name: web-design-guidelines
description: Review UI code for Web Interface Guidelines compliance. Use when asked to "review my UI", "check accessibility", "audit design", "review UX", "check my site against best practices", or review frontend code quality. Supports file path or glob pattern as argument.
---

# Web Interface Guidelines Review

Review UI files against Vercel Web Interface Guidelines. Rules are in `references/web-design-rules.md`.

## Workflow

1. Read `references/web-design-rules.md` to load all rules
2. Read the target files (argument = file path or glob pattern; if none provided, ask user)
3. Check each file against applicable rule categories
4. Output findings in the format below

## Selecting Applicable Rules

Not all rules apply to every file. Match by file content:

- **`.tsx`/`.jsx` components**: Accessibility, Focus States, Forms (if form elements present), Content Handling, Hover States, Hydration Safety, Anti-patterns
- **Layout/page files**: Safe Areas & Layout, Navigation & State, Performance, Images
- **CSS/style files**: Animation, Dark Mode & Theming, Typography
- **Modal/drawer/sheet components**: Touch & Interaction, Focus States
- **i18n or date/number rendering**: Locale & i18n

Skip categories with zero applicable rules for the file.

## Output Format

Group by file. Use `file:line` format (VS Code clickable). Terse findings.

```text
## src/Button.tsx

src/Button.tsx:42 - icon button missing aria-label
src/Button.tsx:18 - input lacks label
src/Button.tsx:55 - animation missing prefers-reduced-motion
src/Button.tsx:67 - transition: all → list properties

## src/Modal.tsx

src/Modal.tsx:12 - missing overscroll-behavior: contain
src/Modal.tsx:34 - "..." → "…"

## src/Card.tsx

✓ pass
```

State issue + location. Skip explanation unless fix non-obvious. No preamble.

## Updating Rules

Rules source: `https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md`

Only fetch and update `references/web-design-rules.md` when user explicitly asks to "update rules" or "sync latest guidelines".

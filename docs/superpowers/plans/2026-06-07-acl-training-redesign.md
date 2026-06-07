# ACL Training Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a responsive ACL training app that is mobile-first for live training and desktop-enhanced for plan management, import/export, and statistics.

**Architecture:** Keep the existing static HTML/CSS/native ESM app. Add focused pure services for statistics and session summaries, then upgrade page modules and responsive CSS without migrating frameworks.

**Tech Stack:** Native browser ES modules, static HTML/CSS, localStorage, Node.js built-in test runner for pure module regression tests, local static server for browser QA.

---

## Execution Slices

1. Add statistics and session-summary tests, then implement `services/stats.js`, `runtime.sessionLogs`, and training session summary logging.
2. Upgrade the mobile training surface with a clearer session header, end-session action, next-action summary, and readable timer controls.
3. Simplify plan management by removing visible emoji/icon pickers and random art controls while preserving add/delete/rename/reorder.
4. Add a statistics dashboard above the calendar using derived stats from `services/stats.js`.
5. Improve import/export controls with clearer labels and import preview counts.
6. Clean visible Chinese app chrome copy where touched.
7. Run Node tests and rendered browser QA at mobile and desktop widths.

## Target Files

- `services/stats.js`: pure derived statistics from plans and runtime.
- `test/*.test.mjs`: Node built-in regression tests for pure behavior.
- `core/state.js` and `services/schema-v7.js`: backward-compatible `sessionLogs` runtime field.
- `pages/training.js`: session summary, mobile session header, training actions.
- `pages/calendar-page.js`: stats dashboard plus calendar.
- `pages/library.js`, `pages/detail.js`, `app.js`: remove decorative icon/art management flows.
- `components/import-dialog.js`, `pages/settings.js`: import/export improvements.
- `index.html`, `style.css`: app shell labels and responsive visual system.

## Verification Commands

Run after each implemented slice:

```bash
node --test test/*.test.mjs
```

Run before final handoff:

```bash
node --test test/*.test.mjs
git status --short
```

Rendered QA should use the Browser plugin first with:

- Desktop flow: app loads -> plan library renders -> open plan -> manage plan -> view statistics/import-export.
- Mobile flow: app loads -> open plan -> start training -> complete set -> timer controls -> end session -> statistics update.

## Self-Review

- Spec coverage: mobile training, desktop management, stats, import/export, removed icon features, compatibility, and QA are represented.
- Placeholder scan: no TBD/TODO content.
- Type consistency: uses `sessionLogs`, `buildTrainingStats`, and `buildSessionSummary` consistently.

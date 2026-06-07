# ACL Training Redesign Design

Date: 2026-06-07

## Goal

Turn the current ACL training planner into a full-featured responsive training app:

- Mobile first for active training sessions, timing, progress, and session flow.
- Desktop enhanced for plan management, import/export, and longer-form editing.
- Keep the current static frontend architecture unless a specific feature needs a larger change.
- Remove low-value decorative controls, especially custom emoji/icon selection and random art generation.

## Current Context

The project is a static frontend app built with native HTML, CSS, and JavaScript ES modules. It has these existing boundaries:

- `index.html`: app shell and global overlays.
- `app.js`: navigation and delegated event handling.
- `pages/`: library, detail, training, calendar, settings views.
- `services/`: plans, timer, calendar, drag sorting, AI enrichment, schema.
- `core/`: shared state and storage.
- `utils/`: plan and runtime helpers.
- `data/`: default catalog and plan JSON files.

The app already supports local plan storage, default plan catalogs, editable plan details, training session progress, rest/timed exercise timers, calendar logs, import/export, remote sync, theme switching, and AI-assisted exercise detail enrichment.

## Product Direction

The app should feel like one product with two optimized modes:

- On phones, it should be a focused training companion. It should minimize management chrome and put the next action, timer, progress, and session feedback at the center.
- On desktop, it should be a plan-management workbench. It should make it fast to create, edit, review, import, export, and organize training plans.

The same data model should power both modes. The UI should adapt through responsive layout and view composition rather than separate apps.

## Mobile Experience

Mobile should prioritize the live training workflow:

- Home/library shows the most relevant plans and recent progress without decorative noise.
- Plan detail remains available for lightweight edits, but it should not feel like a dense admin screen.
- Training screen becomes the strongest surface:
  - Sticky session header with plan name, elapsed time, completion count, and progress.
  - Clear current module and exercise hierarchy.
  - Stable bottom action zone for complete set, start timer, pause, skip rest, and end training.
  - Rest and timed exercise timer should be legible, reachable, and resilient to backgrounding.
  - Completing timed exercises should mark the next incomplete set and update progress immediately.
  - Ending a session should show a short summary with duration, completed sets/exercises, and plan completion.

Mobile should avoid:

- Emoji/icon picker flows.
- Random art generation.
- Decorative cards that reduce scan speed.
- Desktop-only management controls in the primary training path.

## Desktop Experience

Desktop should expand into a management workbench:

- A wide layout with persistent navigation and a plan-management area.
- Left column: plan groups and plans, with add/delete/reorder where useful.
- Main column: selected plan detail, module list, and exercise editor.
- Right column or side panel: plan summary, statistics, import/export, and data tools.

Plan editing should be faster on desktop:

- Add a plan, module, or exercise without navigating through several small mobile dialogs.
- Edit exercise fields in a table-like or compact form layout:
  - name
  - type
  - sets
  - reps or duration
  - rest duration
  - notes/tips
- Preserve module reorder and plan/group organization, but remove icon selection and random artwork controls.

Import/export should be easy to find and safer:

- Export selected plan.
- Export all plans.
- Import with preview.
- Merge, replace, or append strategy.
- Show counts and warnings before applying imported data.

## Statistics

Statistics should support short-term and long-term progression:

- Recent 7-day and 30-day activity.
- Training days and streak-style continuity.
- Completed plans, modules, exercises, and sets.
- Total training duration where session timing is available.
- Plan completion rate.
- Progressive growth metrics:
  - week-over-week completed set count
  - week-over-week completed exercise count
  - recent training volume trend
  - per-plan completion trend

The existing `calendarLogs` data should continue to work. New session-level summary data may be added to `runtime` if needed, but it must remain backward compatible with existing saved data.

## Architecture

Keep the current static ESM architecture:

- Do not migrate to React/Vite for this redesign.
- Add focused services/helpers instead of growing `app.js`.
- Add a statistics service, likely `services/stats.js`.
- Keep rendering in page modules, but split large reusable UI fragments if needed.
- Keep localStorage-compatible data structures and schema v7 compatibility.

Expected module changes:

- `pages/library.js`: simplify visual management, remove emoji/random art features, support desktop workbench entry points.
- `pages/detail.js`: simplify icon editing, improve plan/module/exercise editing, add desktop-friendly dense editor states.
- `pages/training.js`: improve session header, action flow, timer integration, and session summary.
- `pages/calendar-page.js`: upgrade from calendar-only to statistics plus calendar.
- `pages/settings.js` and import dialog: make import/export clearer for desktop plan management.
- `services/timer.js`: keep timestamp-based timer reliability and improve UI state integration where needed.
- `services/stats.js`: derive training metrics from runtime progress, calendar logs, and session summaries.
- `style.css`: refactor visual system and responsive layout while preserving existing class compatibility.

## Data Flow

- Plans remain stored in `state.catalog` and flattened into `state.plans`.
- Runtime progress remains in `state.runtime.progress`.
- Calendar logs remain in `state.runtime.calendarLogs`.
- Training sessions should use `state.runtime.trainingSessionStartAt` during active sessions.
- If session summaries are added, they should live under a backward-compatible field such as `state.runtime.sessionLogs`.

Derived statistics should not mutate state. They should be calculated from current state by the stats service.

## Removed Features

Remove or hide these from the primary UX:

- Plan emoji picker.
- Module emoji picker.
- Random group art generation.
- Decorative cover image controls.

Default icons or small type/color indicators may remain as static visual cues if they help scanning.

## Error Handling

- Invalid imported data should show a preview error before applying changes.
- Missing or deleted current plans should route the user back to plan selection with a clear message.
- Timer completion should avoid duplicate notifications and duplicate progress writes.
- Statistics should tolerate missing old runtime fields and empty logs.
- Desktop management actions that delete groups, plans, modules, or exercises should confirm before destructive changes.

## Accessibility And Responsiveness

- Buttons and controls must have stable hit targets on mobile.
- Text should not overflow buttons, cards, or table cells.
- Desktop layout should work at common laptop widths and collapse cleanly to mobile.
- Keyboard-friendly editing should be preserved or improved for desktop.
- Motion should be restrained and respect reduced-motion preferences.

## Testing And Verification

Implementation verification should include:

- Static build or syntax check appropriate for the repo.
- Browser verification of the local app.
- Mobile-width verification of the training workflow.
- Desktop-width verification of plan management, import/export, and statistics.
- Manual flow checks:
  - add/edit plan content
  - start training
  - complete counted sets
  - run timed exercise
  - pause/skip/cancel timer
  - view calendar/statistics
  - export data
  - preview import data

## Non-Goals

- No backend service.
- No account system.
- No migration to React/Vite.
- No full replacement of the existing schema.
- No decorative redesign that reduces training usability.

# Tab Labels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local Firefox extension (Manifest V3) that labels tabs from the tab right-click menu, shown as a favicon bubble, a title prefix, or both.

**Architecture:** An event-page background script owns the context menu and per-tab state (`sessions` tab values). A content script applies the title prefix and favicon bubble. A pure-logic module `lib/labels.js` is shared by all three entry points and is the only unit-tested piece. Spec: `docs/superpowers/specs/2026-11-05-tab-labels-design.md`.

**Tech Stack:** Plain JavaScript, WebExtensions APIs (`menus`, `sessions`, `storage`, `tabs`, `runtime`). No build step, no dependencies. Tests run with macOS's built-in JavaScript engine (`osascript -l JavaScript`) because Node is not installed.

## Global Constraints

- Manifest V3, Firefox event page (`background.scripts`), `strict_min_version` 140.0 or higher (user has Firefox 159).
- Permissions: `menus`, `tabs`, `storage`, `sessions`; `host_permissions`: `<all_urls>`.
- No network requests except fetching the page's own favicon. No data leaves Firefox.
- Display modes exactly: `favicon`, `title`, `both` (default `both`).
- Default labels: Waiting (hourglass), Paused (pause), To do (pencil).
- Title format: `<emoji> <name> · <original title>`.
- British English in all user-visible text. No em dashes anywhere.
- Background keeps no state in memory (event page can be unloaded).
- No commits are made unless the user asks (the folder is not a git repository).

## File Structure

```
manifest.json
background.js          menu, per-tab label state, messaging, favicon fetch
content.js             title prefix and favicon bubble in the page
lib/labels.js          pure logic, loaded by background, content and options
options/options.html   settings page markup
options/options.js     settings page behaviour
options/options.css    settings page styles
icons/icon.svg         extension icon
test/run.js            JXA test runner and tiny assert harness
test/labels.test.js    unit tests for lib/labels.js
test/manifest.test.js  checks manifest references real files
```

---

### Task 1: Pure logic module (`lib/labels.js`) with tests

**Files:**
- Create: `lib/labels.js`, `test/run.js`, `test/labels.test.js`

**Interfaces:**
- Produces global `TabLabels` (browser) / `module.exports` (if available) with:
  - `DISPLAY_MODES: string[]`
  - `defaultSettings(): {labels: Label[], displayMode: string}`
  - `validateLabel({name, emoji, colour}): {ok: true, label: {name, emoji, colour}} | {ok: false, error: string}`
  - `normaliseSettings(raw: any): {labels: Label[], displayMode: string}`
  - `makeId(name: string, existingIds: string[]): string`
  - `findLabel(labels: Label[], id: string): Label | null`
  - `prefix(label): string`, `buildTitle(title, label): string`, `isPrefixed(title, label): boolean`, `stripPrefix(title, label): string`
  - `showsTitle(mode): boolean`, `showsFavicon(mode): boolean`
  - `Label = {id: string, name: string, emoji: string, colour: string}` (colour is `#rrggbb`)

- [ ] **Step 1: Write the test runner and failing tests**

`test/run.js` reads `lib/labels.js` and every `test/*.test.js`, evaluates them with `test(name, fn)`, `assertEqual`, `assertTrue` available, prints results and throws on any failure (non-zero exit). Tests cover: defaults contain Waiting, Paused, To do; `validateLabel` accepts a valid label and trims; rejects empty name, name over 30 chars, non-emoji text, bad colour; `normaliseSettings` falls back to defaults for non-objects, keeps an empty label list, drops invalid labels and duplicate ids, repairs a bad display mode; `makeId` slugs and de-duplicates; prefix/build/isPrefixed/strip round trip; `showsTitle`/`showsFavicon` per mode.

- [ ] **Step 2: Run to verify failure**

Run: `osascript -l JavaScript test/run.js`
Expected: FAIL (`TabLabels` undefined).

- [ ] **Step 3: Implement `lib/labels.js`** to satisfy the interface above.

- [ ] **Step 4: Run to verify pass**

Run: `osascript -l JavaScript test/run.js`
Expected: all tests pass, exit code 0.

### Task 2: Manifest, icon and background script

**Files:**
- Create: `manifest.json`, `icons/icon.svg`, `background.js`, `test/manifest.test.js`

**Interfaces:**
- Consumes: `TabLabels` from Task 1.
- Produces runtime messages handled by the background:
  - `{type: "getState"}` returns `{label: Label | null, displayMode: string}` for the sender's tab.
  - `{type: "renderIcon", url: string, label: Label}` returns `string | null` (a PNG data URL of the icon with the bubble drawn on it).
- Sends to content scripts: `{type: "refresh"}`.

- [ ] **Step 1: Write `test/manifest.test.js`** asserting `manifest_version` is 3, every file referenced in `background.scripts`, `content_scripts[].js`, `options_ui.page` and `icons` exists, and required permissions are present. Run it and watch it fail (no manifest).
- [ ] **Step 2: Write manifest, icon and background.** Background behaviour:
  - Top-level listeners only. A serialised `rebuildMenu()` runs at load and on `storage.onChanged` (`removeAll`, then a parent "Label tab" item with one child per label and a "Remove label" child, contexts `["tab"]`).
  - `menus.onClicked`: store with `sessions.setTabValue(tab.id, "labelId", id)` or `removeTabValue`, then `tabs.sendMessage(tab.id, {type: "refresh"})`, ignoring errors on restricted pages.
  - `storage.onChanged` for `labels` or `displayMode`: send `refresh` to all tabs.
  - `getState`: read settings from storage, normalise, read the tab's `labelId`, return label (or null) and mode.
  - `renderIcon`: validate the label, `fetch` the icon (reject non-image or over 1 MB), draw it with the bubble on a canvas, return a PNG data URL; grey disc fallback if the fetch fails.
- [ ] **Step 3: Run tests** (`osascript -l JavaScript test/run.js`), expect pass.

### Task 3: Content script

**Files:**
- Create: `content.js`

**Interfaces:**
- Consumes: `TabLabels`; background messages from Task 2.

- [ ] **Step 1: Implement** with these behaviours:
  - On load and on `{type: "refresh"}`, request state and apply.
  - Title: if the mode shows titles and a label exists, set `document.title` to `buildTitle(stripPrefix(current, appliedLabel), label)`. A `MutationObserver` on `document.head` (childList, subtree, characterData) re-applies the prefix when the page rewrites its title, guarded by `isPrefixed`. On clear, strip the prefix.
  - Favicon: find the icon URL (`link[rel~="icon"]`, else `/favicon.ico`), ask the background to render the icon with the bubble (data URL), remove existing icon links (remembered), append `<link rel="icon" id="tab-labels-icon">`. A version counter discards stale async results. On clear, remove ours and restore the originals. If the page adds a new icon link while active, re-apply.
- [ ] **Step 2: Syntax check** with `osascript -l JavaScript -e` parsing the file (`new Function(source)`), expect no error.

### Task 4: Settings page

**Files:**
- Create: `options/options.html`, `options/options.js`, `options/options.css`

- [ ] **Step 1: Implement:** display mode radios save immediately; label rows (emoji, name, colour picker, up, down, delete); Add label; Save labels (validates every row with `validateLabel`, shows the first error inline, saves nothing on error; new rows get ids from `makeId`); Reset to defaults. DOM built with `createElement` and `textContent`, never `innerHTML`.
- [ ] **Step 2: Syntax check** the script as in Task 3.

### Task 5: Verification and install notes

- [ ] **Step 1:** Run all tests; expect pass.
- [ ] **Step 2:** Check no em dashes in the project: `grep -rn $'\xe2\x80\x94' .` (the byte sequence for an em dash), expect no output.
- [ ] **Step 3:** Write `README.md` with temporary and permanent install steps and the manual test checklist from the spec.
- [ ] **Step 4:** Report honestly which parts were machine-tested (logic, manifest, syntax) and which need a manual run in Firefox (menu, favicon, title, restart persistence).

## Self-review against spec

- Right-click submenu, remove, default labels: Tasks 1 and 2.
- Display modes and immediate application: Tasks 2 (storage refresh), 3.
- Persistence across restart: Task 2 (`sessions` tab values; content script asks on every load).
- Settings page, reset, validation: Tasks 1 and 4.
- Restricted pages, error handling: Task 2 (ignored send errors), Task 3.
- Install and manual testing: Task 5.

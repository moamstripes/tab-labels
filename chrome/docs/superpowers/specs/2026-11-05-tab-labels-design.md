# Tab Labels: design

Date: 05-11-2026
Status: approved by user in conversation (Manifest V3 chosen on 05-11-2026); implemented

## Purpose

A local-only Firefox extension that lets the user tag a tab with a label from the tab right-click menu. A label has an emoji, a colour and an optional name. Defaults: Waiting (hourglass), Paused (pause), To do (pencil). The user can add, edit and delete labels.

## Behaviour

- Right-clicking a tab shows a **Label tab** submenu listing all labels (emoji and name) and a **Remove label** item.
- One label per tab. Choosing a label replaces any existing one.
- A label stays on the tab across navigation within that tab, and survives a Firefox restart and session restore. It is removed by "Remove label" or by closing the tab.
- **Display mode** (settings page, applies immediately, no restart):
  - `favicon`: the site's icon with a small coloured dot in the top-left corner. No emoji on the icon.
  - `title`: the page title is prefixed with the emoji and name, for example `⏳ Waiting · Inbox`. A label with no name gives `⏳ · Inbox`.
  - `both` (default).
- Default labels are editable and deletable. A "Reset to defaults" action restores them.
- Custom labels are created only on the settings page (emoji and colour required, name optional). Context menus cannot take typed input.
- Everything is local. The extension makes no network requests of its own, and no data leaves Firefox.

## Architecture

Plain JavaScript, Manifest V3 (Firefox event page background, non-persistent), no build step, no runtime dependencies.

```
tab-labels/
  manifest.json
  background.js       menu building, per-tab label state, messaging
  content.js          title prefix and favicon dot inside pages
  lib/labels.js       pure functions: defaults, validation, title prefixing, label lookup
  options/options.html, options.js, options.css
  icons/              extension icon
  test/               node --test unit tests for lib/labels.js
  docs/superpowers/specs/
```

### Components

- **background.js**: an event page that Firefox may unload when idle, so it keeps no state in memory: listeners are registered at top level, the menu is rebuilt (serialised) each time the page loads and whenever labels change, and labels are read from storage on each event. It builds the `tab` context menu (`menus` API) from stored labels and rebuilds it when storage changes. On a menu click it stores the chosen label id with `sessions.setTabValue(tabId, "labelId", id)` and notifies the tab's content script. On startup it re-reads every tab's value so labels reappear after a restart. It answers `getMyLabel` requests from content scripts and fetches favicons (see below).
- **content.js**: on load asks the background for this tab's label and display mode, then applies it. Listens for update messages and for storage changes to the display mode. Handles title prefixing and the favicon dot. Removes both cleanly when the label is removed.
- **lib/labels.js**: no browser API calls, so it is unit-testable in Node.
- **options page**: label list editor (name, emoji, colour, reorder, delete), display mode radio buttons, reset to defaults.

### Data

- `storage.local`: `labels` (array of `{id, name, emoji, colour}`) and `displayMode` (`favicon` | `title` | `both`).
- Per tab: `sessions` tab value `labelId`.
- If a tab references a deleted label id, it is treated as unlabelled.

### Title label

Prefix is `<emoji> <name> · `. The original title is remembered. A `MutationObserver` on `<title>` re-applies the prefix when the page changes its title, guarded so the extension's own change does not retrigger it.

### Favicon dot

The content script finds the page's icon URL (`link rel~=icon`, falling back to `/favicon.ico`) and asks the background to render the icon with the dot. The background fetches the icon, draws it on a 32x32 canvas with a coloured dot in the top-left corner, and returns a data URL. Rendering in the background avoids tainted canvases from cross-origin icons and avoids the page's Content Security Policy. The content script sets a replacement `link rel="icon"` with the result and keeps the page's own icon links aside. If the fetch fails, the dot is drawn on a neutral grey circle. On removal the original links are restored.

### Permissions

`permissions`: `menus`, `tabs`, `storage`, `sessions`. `host_permissions`: `<all_urls>` (content script injection and favicon fetch). In Firefox V3 the user can revoke site access, in which case labels cannot display until it is granted again. Behaviour for a temporarily loaded add-on is to be verified during the build and noted in the install steps.

## Known limits

- Firefox blocks content scripts on `about:` pages, the built-in PDF viewer and addons.mozilla.org. On those tabs the label is stored but cannot be displayed.
- Pinned tabs show only the favicon, so only the coloured dot is visible there.
- The favicon shows only the label colour. The emoji and name appear only in the title prefix and the right-click menu.
- The extension cannot draw in the tab strip itself, which is browser UI. A `userChrome.css` approach was rejected as fragile across Firefox updates.

## Error handling

- Storage read failure: fall back to default labels and `both`.
- Content script unreachable (restricted page): background ignores the send error.
- Invalid label input on the settings page (no emoji, name over 30 characters, bad colour): rejected with an inline message, nothing saved.

## Testing

- Unit tests (`node --test`) for `lib/labels.js`: defaults, validation, prefix building and stripping, missing-label handling.
- Manual checklist in a Firefox profile: apply, replace and remove a label; each display mode; pinned tab; navigation within a labelled tab; page that changes its own title; restart and session restore; custom label add, edit, delete; restricted page.

## Installation

- Temporary: `about:debugging#/runtime/this-firefox`, "Load Temporary Add-on", select `manifest.json`. Lasts until Firefox restarts.
- Permanent: sign as an unlisted add-on on addons.mozilla.org (free, not published) and install the resulting `.xpi`, or use Firefox Developer Edition or Nightly with `xpinstall.signatures.required` set to `false`.

## Version 1.1.0 changes (supersedes anything above that conflicts)

- **Three display toggles** replace the single display mode: favicon bubble, title label (the name) and emoji (the emoji, shown separately from the name). They are independent, so the title can be `⏳ Waiting · Inbox`, `Waiting · Inbox`, `⏳ · Inbox` or untouched. Stored as `showFavicon`, `showTitle`, `showEmoji` (default all on). The old `displayMode` is read once to migrate: `favicon` gives dot only, `title` gives emoji and name without the dot, anything else gives all three.
- **Container rules.** Settings page lists Firefox containers (`contextualIdentities`), each with a label dropdown. Stored as `containerRules` (`{cookieStoreId: labelId}`). New tabs opened in a container get its label (`tabs.onCreated`). Choosing a label for a container also labels unlabelled tabs already open in it; only containers whose rule changed are touched. Added permissions: `contextualIdentities`, and `cookies` because Firefox only reports `tab.cookieStoreId` with it.
- **No favicon dot in containers.** A tab whose `cookieStoreId` is a container never gets the dot, whatever the favicon toggle says, because containers already colour their tabs. Title label and emoji still apply. Decided in the background's `getState` via `displayForTab`.
- **Removal is remembered.** "Remove label" stores an empty string for the tab instead of deleting the value, so container rules and session restore do not label it again. Deleting a label drops any container rule that used it.
- **Settings page redesign.** Card layout, light and dark theme, up and down arrows removed.
- **Import and export.** Export writes `tab-labels.json` with emoji, name and colour of the saved labels only. Import accepts that file (or a bare array), validates each label, adds new ones as unsaved rows, skips duplicates and invalid entries, reads at most 100 labels from a file of at most 256 KB.

## Chrome port (this copy)

This folder is the Chrome port of the Firefox extension, with the same name, settings page, logic and display options. Everything above that mentions Firefox-only APIs is superseded by the following.

- **Background:** MV3 service worker (`importScripts("lib/labels.js")`), no state in memory. Chrome-style messaging (`sendResponse` and `return true`), `chrome.*` APIs, canvas drawing with `OffscreenCanvas` and `createImageBitmap` because a service worker has no DOM.
- **Menu:** Chrome has no tab context menu. The **Label tab** submenu uses `contextMenus` with contexts `page` and `action` (the toolbar icon's right-click menu). It applies to the tab the menu was opened in. Clicking the toolbar icon opens the settings.
- **Per-tab labels:** `storage.session`, keyed by tab id. Kept while Chrome is open, lost when it quits. Cleared when a tab closes, and moved when Chrome replaces a tab (`tabs.onReplaced`).
- **Removed:** container rules, the no-dot-in-containers rule, the `sessions`, `cookies` and `contextualIdentities` permissions, and the migration from the old single display mode.
- **Permissions:** `contextMenus`, `storage`, and host permission `<all_urls>`. Minimum Chrome 110.
- **Icons:** Chrome needs PNG icons, generated from the same shapes as `icons/icon.svg` (16, 32, 48 and 128 pixels). The SVG is still used in the settings page.
- **Known gaps:** the SVG favicon case falls back to a grey disc; a page whose security policy blocks the replacement icon keeps its own icon; labels are lost when Chrome quits.

## Emoji picker and Enter key (added later; same in both browsers)

- **Emoji picker.** Clicking a label's emoji box on the settings page opens a picker under it (`options/emoji-picker.js`, data and search in `lib/emoji.js`): 222 emoji in sections, a search box, and a hint for the computer's own emoji menu. A web page cannot open the system menu, so this is the nearest equivalent. An emoji inserted into the picker's search box by the system menu is picked at once, so that menu works too. Escape closes it and returns to the emoji box; Enter in the search box picks the first match when something has been typed. Every emoji in the list must pass `validateLabel` (a unit test enforces this).
- **Enter in the label list.** Enter in a name box moves to the next label's name, or after the last label adds a new one with the picker open (`enterAction` in `lib/labels.js`). A blank last label does not add another. Enter in the emoji box jumps to the same label's name. Enter that confirms an input method composition is ignored.

## Settings shortcut and refresh button (same in both browsers)

- **Settings in the menu.** The **Label tab** submenu ends with a separator and **Tab Labels settings**, which calls `openOptionsPage()`. The click handler is a named function, `handleMenuClick(info, tab)`, so it can be called directly in tests.
- **Refresh labels on all tabs.** A button on the settings page sends `{type: "refreshAllTabs"}` to the background. `refreshEverywhere()` messages every tab with `refresh`; a tab whose content script answers is counted as refreshed. A tab that does not answer (open before the extension was installed or updated) gets `lib/labels.js` and `content.js` injected with `scripting.executeScript`, which needs the `scripting` permission. Tabs that cannot be injected (browser pages, tabs not loaded) are counted as skipped. The content script now replies to `refresh`, which is how the two cases are told apart. The message shown is built by `refreshSummary` in `lib/labels.js`. The automatic refresh when a setting changes still only messages tabs and never injects.

## Doubled labels and extension updates (1.3.1, same in both browsers)

**Cause.** A label could appear twice in a tab title. Three things produced it: (1) a site that builds its new title from the current one, such as `"(3) " + document.title`, leaves our prefix in the middle, and the old code only looked at the start of the title; (2) changing a label on such a page left the old prefix in the middle while the new one went on the front; (3) when the extension was updated, the old content script died but its changes stayed in the page, and the new script (which Firefox injects into open tabs on update) added a second prefix on top. In 1.2.0 to 1.3.0 this showed as `⏳ Waiting · ⏳ Waiting · Inbox` immediately after the update, and the refresh button did not clear it.

**Fix.**
- State the extension leaves in a page is recorded in the page: the applied prefix in `data-tab-labels-prefix` on `<html>`, and the page's own icon links are hidden by changing their `rel` (original kept in `data-tab-labels-rel`) instead of being held only in the script's memory. A newer copy of the script finds and cleans these up.
- `TabLabels.allPrefixes(labels)` lists every prefix any label can produce; the background sends it with the tab's state. `TabLabels.normaliseTitle(title, prefix, known)` removes every occurrence of every known prefix, anywhere in the title, and puts exactly one `prefix` at the front. It runs when a label is applied and whenever the page rewrites its title.
- The refresh button now sends `reset`: each tab removes everything the extension put there, then re-applies the stored state. Tabs without the content script get it injected (its first refresh does the same cleaning).
- A live-copy guard (`window.__tabLabelsInstance`) lets a new copy start when the previous copy is dead (`runtime.id` gone). A dead copy disconnects its own observer.
- The title watcher stops after more than 8 rewrites within a second, so two copies undoing each other cannot loop. The next refresh starts it again.
- Restoring or hiding an icon link also re-inserts the link, because browsers do not reliably notice a changed `rel`.

**Browser differences.** Firefox kills the old script on update, so only leftovers remain and the new code removes them. Chrome leaves the old script running in open tabs, cut off from the extension, and its observer keeps re-adding its old prefix; only a reload of the tab removes it (needed once, when updating from a version before 1.3.1). Chrome also clears `storage.session`, so per-tab labels are lost on update.

**Settings page icon.** `icons/label.svg` (the 🏷️ emoji) is the favicon of the settings page.

## Settings page layout, icons and the space theme (1.4.0, same in both browsers)

- **Layout.** A two-column grid: the main column holds Labels first and, in Firefox, Containers below it; a sidebar on the left holds the three display switches, their explanations and the Refresh button, and below that the "Take me to space" card. The sidebar is sticky only when the window is at least 760 pixels tall and 821 wide (a sticky element taller than the window would hide its lower part); below 821 pixels wide the grid becomes one column with the sidebar first and not sticky.
- **Icon buttons.** Import, export and reset are 34 pixel icon buttons (inline SVG, `currentColor`) in the Labels card header, each with a `title` and an `aria-label`. Their ids and behaviour are unchanged. Reset still asks for confirmation.
- **Take me to space.** A switch (`#space-toggle`) saved as `spaceTheme` in `storage.local` (default false, only `true` turns it on). It sets `data-space` on `<html>`; `options.css` overrides the colour variables under `:root[data-space]` (light colours, purple accent, so dark mode does not make it unreadable) and sets `options/space.svg` as the page background. The value is also kept in `localStorage` so the page does not flash its plain look before storage answers. The toggle text is "Take me to space" followed by decorative symbols marked `aria-hidden`.
- **Website.** `docs/index.html` has the same toggle, done in CSS only (`:root:has(#space:checked)`), hidden where `:has` is unsupported. `docs/assets/space.svg` is the same picture.

## Header buttons: space button and light/dark button (1.5.0, same in both browsers)

- **Space is a button, not a switch.** `#space-button` sits at the top right of the settings page, under `#mode-button`. It holds two texts, `.when-plain` ("Take me to space" plus decoration) and `.when-space` ("Land back (︶︹︺)"); `:root[data-space]` shows the second and hides the first. No description. Pressing it sets or clears `data-space` and saves `spaceTheme`; the decoration is `aria-hidden`.
- **Light/dark button.** `#mode-button` shows the mode you would switch to (moon in light, sun in dark). The choice is saved as `colorMode` (`light` or `dark`; absent or anything else means follow the system) and applied as `data-theme` on `<html>`. The dark colours are defined twice: for the system (`prefers-color-scheme: dark` and not `data-theme="light"`) and for `data-theme="dark"`. A cached copy in `localStorage` avoids a flash on load. While in space the button is disabled, because the space colours are fixed.
- **Website.** The same two controls in CSS only. The light/dark checkbox means "the opposite of what the computer asks for" (`:root:has(#mode:checked)` inside `prefers-color-scheme` media queries), so the page still has no scripts.

## Space theme removed (after 1.5.1, same in both browsers)

The "Take me to space" button, its `spaceTheme` setting, the `data-space` styles, `options/space.svg` and the website's matching button and screenshot were all removed. Everything about the space theme in the two sections above is history. A `spaceTheme` value left in `storage.local` by an older version is ignored (it is no longer in `SETTINGS_KEYS`). The light/dark button stays and is never disabled now.

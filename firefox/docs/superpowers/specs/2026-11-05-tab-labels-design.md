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

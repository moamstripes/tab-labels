# Tab Labels: working notes

A browser extension that tags tabs with coloured labels (emoji, optional name, colour), shown as a dot on the tab icon and/or an emoji and name in front of the tab title. It exists twice, once per browser, in one repository. Public GitHub repo `moamstripes/tab-labels` (MIT licence; it was private until 06-11-2026, so release downloads and the website are public now). Overview and release steps are in `README.md`; each browser folder has its own README with install steps and a manual test checklist.

## Rules for every change

- **Always change both `firefox/` and `chrome/`** when asked for an update. Say plainly if something cannot exist in Chrome.
- Nothing is committed or pushed unless asked, with one standing exception: when a version is updated, follow the `release-tab-labels` skill (`.claude/skills/release-tab-labels/SKILL.md`). It pushes to GitHub and creates a release with a zip for each browser.
- Commits use the repo-local git identity: name `moamstripes` and the GitHub noreply email. Never use the global git identity or the work email, and keep the user's full name out of files and commit messages.
- British English in all user-facing text and docs. No em dashes. Do not invent facts; if something is untested, say so.
- Everything stays local to the browser. No network use except fetching the page's own icon.

## Layout

```
firefox/   Manifest V3, event page (background.scripts), tab right-click menu, containers
chrome/    Manifest V3, service worker, page and toolbar-icon menus, no containers
scripts/   build.sh (zip a browser's runtime files), bump-version.sh
docs/      one-page website for the Firefox extension (GitHub Pages, served from main /docs); screenshots in docs/assets
.github/workflows/   ci.yml (tests on push and PRs), release.yml (tag -> GitHub release)
```

Inside each browser folder: `manifest.json`, `background.js`, `content.js` (title prefix and favicon dot in the page), `lib/` (`labels.js` pure logic, `emoji.js` picker data and search), `options/` (settings page, `emoji-picker.js`), `icons/`, `test/`, `docs/superpowers/` (spec and plan).

## Where the two versions differ on purpose

- Chrome has no tab context menu (menu is on the page and toolbar icon), no containers, and no per-tab storage that survives quitting the browser (labels live in `storage.session`).
- Firefox keeps per-tab labels with `sessions.setTabValue`, supports container rules, and never shows the favicon dot in a container tab.
- Chrome needs PNG icons (generated from the SVG shapes), a service worker (no DOM, so icons are drawn with `OffscreenCanvas`), and replies to messages with `sendResponse` plus `return true`.
- `lib/labels.js` is a separate copy per browser. The Chrome copy has the container logic removed. Shared behaviour changes must be made in both.
- `options/emoji-picker.js` and `lib/emoji.js` are identical in both folders. Edit one, then copy it to the other (`cmp` to check).
- `options/options.js` is the same apart from `browser.` versus `chrome.` and the Firefox-only containers section.

## Commands

```
cd firefox && osascript -l JavaScript test/run.js    # unit tests (also in chrome/)
bash scripts/build.sh firefox                        # or chrome; writes dist/*.zip
bash scripts/bump-version.sh firefox 1.2.0           # edits manifest.json only
```

Node is not installed. The unit tests run on the JavaScript engine built into macOS (`osascript -l JavaScript`); `test/run.js` is a small harness, tests are `test/*.test.js`. Write the failing test first. Add a test for anything pure that goes into `lib/`.

## Testing in a real browser

Unit tests cannot cover the browser APIs. Use throwaway profiles and delete them afterwards:

- **Firefox:** start headless with a temporary profile, `--marionette`, and `MOZ_REMOTE_ALLOW_SYSTEM_ACCESS=1`. Install with the `Addon:Install` Marionette command (`temporary: true`). The settings page (`moz-extension://<uuid>/options/options.html`) runs with extension privileges, so a script run there can call `browser.*` to create containers, set storage and read `tabs.get(...).title` and `favIconUrl`.
- **Chrome:** start headless with `--remote-debugging-port` and `--enable-unsafe-extension-debugging`, then call `Extensions.loadUnpacked` over the debugging websocket (branded Chrome ignores `--load-extension`). Pick the extension's own service worker by its extension id; Chrome ships built-in extensions that also have a `background.js`. Python has no websocket library here, so the test scripts carry a small client.
- Firefox returns every tab icon as a `data:` URL, so to check the dot, compare against an unlabelled tab showing the same page.
- The right-click menu items cannot be clicked headlessly. Say so rather than claiming they were tested.

## Releasing

Push a tag `firefox-v<version>` or `chrome-v<version>` whose number equals that folder's `manifest.json` version. `release.yml` checks it, runs the tests, builds the zip and creates the GitHub release. For Firefox it signs a private (unlisted) add-on only if the repo variable `AMO_SIGN_UNLISTED` is `true` and the secrets `AMO_JWT_ISSUER` and `AMO_JWT_SECRET` exist; it is off, because Firefox versions are uploaded by hand to the public listing and Mozilla rejects a version number it has already signed. Each Firefox version needs a new number. The Firefox add-on's developer page is https://addons.mozilla.org/en-US/developers/addon/fdb422307dd04e4c91e8/. Chrome Web Store publishing is not set up.

The current version is in each `manifest.json`; published versions are on the repository's Releases page. The whole flow (commit, version bump, push, tags, checking the releases) is in the `release-tab-labels` skill. The workflow can also be run by hand for an existing tag (`gh workflow run release.yml -f tag=firefox-vX.Y.Z`) to sign it and attach the files to that release.

## Gotchas

- Settings page layout: a left rail attached to the window edge (`aside.rail`: three `.rail-toggle` rows, an icon next to a `.switch` with `data-key`, and the `#refresh-tabs` icon button), with the hover notes in `data-tip` (shown by CSS `::after`, also on keyboard focus). The main column holds Labels and, in Firefox, Containers side by side (`.panels`); `.list` scrolls inside its card (`max-height: calc(100vh - 225px)`) so the page fits one screen, and below 821px wide the rail becomes a bar and the cards stack. Import/export/reset are icon buttons in the Labels card header (ids `import`, `export`, `reset` are used by the script and the tests). Keep texts short; explanations go in the hover notes.
- Top right of the settings page: `#mode-button` (sun/moon, setting `colorMode`, applied as `data-theme` on `<html>`). The website has the same button in CSS only (no scripts). The earlier "Take me to space" theme was removed on purpose; do not bring it back unasked.
- `firefox/listing.md` is a ready-to-paste draft of the addons.mozilla.org listing (not part of the package). Keep it in step with the website text.

- Tabs that were open before the extension was installed or updated may have no content script. The settings page button "Refresh labels on all tabs" sends `reset` to each tab (remove everything the extension put there, then re-apply) and injects the script, with the `scripting` permission, where there is none. A content script must answer `refresh` and `reset`, otherwise the button cannot tell a tab that has it from one that does not.
- Never keep page state only in the content script's memory: after an update the old script is dead but its changes stay. The applied title prefix and the hidden icon links are recorded in the page (`data-tab-labels-*` attributes). Titles are always normalised with `TabLabels.normaliseTitle` (one prefix, at the front, whatever else is in the title).
- Updates: Firefox kills the old content script, Chrome leaves it running in open tabs (cut off, but its observer still runs) and also clears `storage.session`. See the "Doubled labels" section of the spec. To test an update, install an older release from git (`git archive firefox-vX.Y.Z firefox`) and then the new code over it in a throwaway profile.

- Group tabs by container (Firefox only): `groupContainers` (a switch per container, `{ cookieStoreId: true }`, off by default; the old global `groupByContainer` from 1.6.0 is ignored), planner `TabLabels.planContainerGroups` (pure, tested), runner `syncGroups` in `background.js`. It must never touch pinned tabs, tabs already in a group, or groups the user made (ownership is `storage.session` `ownedGroups` or a title equal to the label). See the last section of the spec.
- Firefox MV3 host permissions can be revoked by the user; labels then cannot show.
- Labels cannot be shown on `about:`/`chrome://` pages, the PDF viewer or the add-on stores. The label is still stored.
- A label's name is optional but its emoji is required (`validateLabel`). The title prefix is `emoji name · title`; with the name off it is `emoji · title`.
- Removing a label in Firefox stores an empty string for the tab instead of deleting the value, so container rules and session restore do not re-label it.
- The picker's emoji list must all pass `validateLabel`; a unit test checks this when emoji are added.

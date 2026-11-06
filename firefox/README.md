# Tab Labels

A local Firefox extension (Manifest V3). Right-click a tab, choose **Label tab**, and pick a label such as ⏳ Waiting, ⏸️ Paused or ✏️ To do. The label shows as a coloured dot in the top-left corner of the tab icon, as a name and/or emoji in front of the tab title. Each of the three is its own toggle. A container can also give every new tab opened in it a label automatically. Everything stays in your browser: nothing is sent anywhere.

## Install

### Quick try (temporary)

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...** and choose `manifest.json` in this folder.
3. Reload any tabs that were already open, so the extension can reach them.

Firefox removes a temporary add-on when it restarts. Load it again after a restart.

### Permanent

Firefox only keeps unsigned add-ons in Developer Edition or Nightly. For normal Firefox, sign it once as an unlisted (private, not published) add-on:

1. Zip the contents of this folder (not the folder itself): `manifest.json`, `background.js`, `content.js`, `lib/`, `options/`, `icons/`.
2. Sign in at <https://addons.mozilla.org/developers/> and choose **Submit a New Add-on**, then **On your own** (unlisted).
3. Upload the zip. Mozilla signs it automatically within minutes.
4. Download the signed `.xpi` and open it in Firefox (File, Open File, or drag it onto the window).

If you change the code later, raise `version` in `manifest.json` before signing again.

## Use

- Right-click a tab, then **Label tab**, then a label. **Remove label** clears it.
- Add, edit and delete labels in the add-on settings: `about:addons`, Tab Labels, Preferences. The same page has the three display toggles (favicon bubble, title label, emoji), the container rules, and **Import from file** / **Export to file** for labels.
- Export saves your labels (emoji, name, colour) to `tab-labels.json`. Import adds the labels in a file to your list without replacing anything, skips ones you already have, and lets you check them before you press **Save labels**. Container rules and tab labels are not exported, because they belong to one Firefox profile.
- Tabs inside a container never show the favicon dot, because containers already colour their tabs. The title label and emoji still apply there.
- Containers: in the settings, pick a label per container. New tabs opened in that container get it, and so do open tabs in that container that have no label when you pick it. A tab you label or unlabel yourself is left alone. Needs Firefox containers (for example the Multi-Account Containers add-on).
- Pinned tabs show only the favicon, so the coloured dot is what you see there. A label's name is optional; without one the title reads like `⏳ · Inbox`.
- Labels cannot be shown on `about:` pages, the built-in PDF viewer or addons.mozilla.org (Firefox blocks extensions there). The label is still saved on the tab.
- Labels stay on a tab across navigation and Firefox restarts. They are removed when the tab is closed.

## Tests

From this folder: `osascript -l JavaScript test/run.js`

This uses the JavaScript engine built into macOS, so Node is not needed. It covers the label logic (including import and export) and checks the manifest. The menu, favicon and title behaviour need a manual check in Firefox:

- [ ] Apply a label, replace it with another, remove it.
- [ ] Each of the three toggles (favicon bubble, title label, emoji) applies immediately to open tabs, alone and in combination.
- [ ] A labelled tab in a container shows no dot on its icon; a labelled tab outside a container does.
- [ ] Container rule: open a new tab in the container and it gets the label; unlabel it and it stays unlabelled after a restart.
- [ ] Export, then import the file on a profile with default labels: only new labels are added, and nothing is kept until you press Save labels.
- [ ] Pinned tab shows the coloured dot in the top-left corner of the icon.
- [ ] A label with an empty name works in the menu, title and settings page.
- [ ] Label survives navigating to another page in the same tab.
- [ ] A page that changes its own title keeps the prefix.
- [ ] Label survives restarting Firefox with session restore on.
- [ ] Add, edit, delete and reset labels on the settings page; the right-click menu updates.
- [ ] On an `about:` page the menu works and nothing breaks.

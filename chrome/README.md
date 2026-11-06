# Tab Labels (Chrome)

A local Chrome extension (Manifest V3), ported from the Firefox version of the same name. Right-click a page (or the extension's toolbar icon), choose **Label tab**, and pick a label such as ⏳ Waiting, ⏸️ Paused or ✏️ To do. The label shows as a coloured dot in the top-left corner of the tab icon, as a name and/or emoji in front of the tab title. Each of the three is its own toggle. Everything stays in your browser: nothing is sent anywhere.

## Differences from the Firefox version

Chrome does not offer some things Firefox does, so three features work differently:

- **No tab right-click menu.** Chrome does not let extensions add items to the tab strip's menu. The **Label tab** menu is on the right-click menu of the page and of the extension's toolbar icon, and applies to the current tab.
- **No containers.** Container rules and the "no dot in containers" rule do not exist here, because Chrome has no containers.
- **Labels do not survive quitting Chrome.** Chrome has no per-tab storage that outlives the browser, so a tab's label is kept while Chrome is open (through page loads, navigation and the extension restarting) and is lost when Chrome quits. Your label list, toggles and settings are kept permanently.

## Install

1. Open `chrome://extensions`.
2. Switch on **Developer mode** (top right).
3. Click **Load unpacked** and choose this folder (the one containing `manifest.json`).
4. Pin the extension from the puzzle-piece menu if you want its icon on the toolbar.
5. Reload any tabs that were already open, so the extension can reach them.

Chrome keeps an unpacked extension across restarts as long as this folder stays where it is. After you change the code, click the reload arrow on the extension's card in `chrome://extensions`.

## Use

- Right-click a page, then **Label tab**, then a label. **Remove label** clears it. The same menu is on the right-click menu of the toolbar icon.
- Click the toolbar icon to open the settings.
- In the settings you can add, edit and delete labels, switch the three display options (favicon bubble, title label, emoji), and use **Import from file** / **Export to file** for labels.
- Export saves your labels (emoji, name, colour) to `tab-labels.json`. Import adds the labels in a file to your list without replacing anything, skips ones you already have, and lets you check them before you press **Save labels**.
- A label's name is optional; without one the title reads like `⏳ · Inbox`.
- Labels cannot be shown on `chrome://` pages, the Chrome Web Store or the built-in PDF viewer, because Chrome blocks extensions there. The label is still saved.
- Some sites with strict security settings may block the replacement tab icon. The title label still works there.
- The tab icon dot is drawn on the site's icon. If a site's icon is an SVG file, the dot is drawn on a grey disc instead.

## Tests

From this folder: `osascript -l JavaScript test/run.js`

This uses the JavaScript engine built into macOS, so Node is not needed. It covers the label logic (including import and export) and checks the manifest. The menus, tab title and tab icon need a manual check in Chrome:

- [ ] Right-click a page, **Label tab**, pick a label: the tab title gets the prefix and the tab icon gets a dot.
- [ ] The same menu appears on the toolbar icon's right-click menu and labels the current tab.
- [ ] Each of the three toggles (favicon bubble, title label, emoji) applies immediately to open tabs, alone and in combination.
- [ ] Label survives reloading and navigating inside the same tab.
- [ ] A page that changes its own title keeps the prefix.
- [ ] A label with an empty name works in the menu, title and settings page.
- [ ] Add, edit, delete and reset labels on the settings page; the right-click menu updates.
- [ ] Export, then import the file after resetting to defaults: only new labels are added, and nothing is kept until you press Save labels.
- [ ] On a `chrome://` page nothing breaks.

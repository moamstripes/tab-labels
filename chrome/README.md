# Tab Labels (Chrome)

A local Chrome extension (Manifest V3), ported from the Firefox version of the same name. Right-click a page (or the extension's toolbar icon), choose **Label tab**, and pick a label such as ⏳ Waiting, ⏸️ Paused or ✏️ To do. The label shows as a coloured dot in the top-left corner of the tab icon, as a name and/or emoji in front of the tab title. Each of the three is its own toggle. Everything stays in your browser: nothing is sent anywhere.

## Differences from the Firefox version

Chrome does not offer some things Firefox does, so three features work differently:

- **No tab right-click menu.** Chrome does not let extensions add items to the tab strip's menu. The **Label tab** menu is on the right-click menu of the page and of the extension's toolbar icon, and applies to the current tab.
- **No containers.** Container rules and the "no dot in containers" rule do not exist here, because Chrome has no containers.
- **Labels do not survive quitting Chrome, or updating the extension.** Chrome has no per-tab storage that outlives the browser, so a tab's label is kept while Chrome is open (through page loads, navigation and the service worker restarting) and is lost when Chrome quits or when the extension is updated or reloaded. Your label list, toggles and settings are kept permanently.
- **After updating from a version before 1.3.1, reload the tabs that had labels, once.** Chrome leaves the old copy of the extension's code running in open tabs, and it keeps putting its old label back. From 1.3.1 on, a copy that an update has cut off stops itself, so this does not repeat. The title watcher also gives up, instead of looping, if something keeps undoing its changes.

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
- In the settings you can add, edit and delete labels, switch the three display options (favicon bubble, title label, emoji), and import or export labels.
- **Settings page layout:** a narrow strip attached to the left edge holds the display switches, each an icon next to a switch (favicon bubble, title label, emoji), and a Refresh icon at the bottom. Hover over one (or tab to it) for a note on what it does. The Labels card is compact: a long list scrolls inside the card so the page itself stays on one screen. In a narrow window the strip becomes a bar above the card. Import, export and reset are the three small icons at the top right of the Labels card (hover for their names).
- **Top right of the settings page:** a sun/moon button switches between light and dark mode. It follows your computer until you choose, and then remembers your choice.
- The **Label tab** submenu ends with **Tab Labels settings**, which opens the settings page.
- **Refresh labels on all tabs** (settings page, under the display toggles) does a full reset: in every open tab it removes what the extension put there (the title prefix and the icon dot, including any prefix an older version left behind) and then puts the labels back from the stored state. That clears a label shown twice. Tabs that were already open when the extension was installed or updated have no label code running in them, so it adds that code to them first, which is why the extension has the `scripting` permission. Browser pages and tabs that have not loaded yet cannot be reached; the page says how many.
- Click a label's emoji box on the settings page to open an emoji picker. Search by word, click one, and it is filled in. Browsers do not let a page open the computer's own emoji menu, so the picker has its own list; the system menu (on a Mac, Control + Command + Space) works inside the picker's search box, and anything pasted into the emoji box works too. Enter in the search box picks the first match.
- In the label list, Enter in a name box moves to the next label, and after the last label it adds a new one with the picker open. Enter in the emoji box jumps to the same label's name. A blank last label is not duplicated.
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
- [ ] Update the extension (reload it in the browser) while a tab is labelled: the tab never shows the label twice.
- [ ] Open some tabs, install or reload the extension, label a tab, then press **Refresh labels on all tabs**: the old tab shows its label and the page reports how many tabs it refreshed.
- [ ] **Tab Labels settings** at the bottom of the **Label tab** submenu opens the settings page.
- [ ] Settings page: switches (icon plus switch) and Refresh in a strip on the left edge, each with a hover note; the Labels card; add enough labels to overflow and the list scrolls inside its card while the page does not; narrow the window and the strip folds into a bar above the card.
- [ ] Press the sun/moon button: the page switches between light and dark and remembers it.
- [ ] Click a label's emoji box: the picker opens under it. Search for a word, click an emoji, and it fills the box.
- [ ] Enter in a name box moves to the next label; Enter in the last label adds a new one; Enter in a blank last label does nothing.
- [ ] Export, then import the file after resetting to defaults: only new labels are added, and nothing is kept until you press Save labels.
- [ ] On a `chrome://` page nothing breaks.

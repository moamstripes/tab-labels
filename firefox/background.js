"use strict";

// Event page: keeps no state in memory. Listeners are registered at the top level,
// labels are read from storage on every event, and each tab's label lives in
// sessions tab values so it survives restarts.

const PARENT_ID = "tab-labels-parent";
const SEPARATOR_ID = "tab-labels-separator";
const REMOVE_ID = "tab-labels-remove";
const SETTINGS_SEPARATOR_ID = "tab-labels-settings-separator";
const SETTINGS_ID = "tab-labels-settings";
const ITEM_PREFIX = "tab-labels-item:";
const TAB_KEY = "labelId";
// Stored when a label is removed on purpose. The tab then has a value, so container
// rules (and session restore) leave it alone instead of labelling it again.
const NO_LABEL = "";
const MAX_ICON_BYTES = 1024 * 1024;
const ICON_SIZE = 32;

async function loadSettings() {
  try {
    return TabLabels.normaliseSettings(await browser.storage.local.get(TabLabels.SETTINGS_KEYS));
  } catch (e) {
    return TabLabels.defaultSettings();
  }
}

// Menu

let menuQueue = Promise.resolve();

function rebuildMenu() {
  menuQueue = menuQueue.then(buildMenu).catch((e) => console.error("Tab Labels: menu rebuild failed", e));
  return menuQueue;
}

async function buildMenu() {
  const { labels } = await loadSettings();
  await browser.menus.removeAll();
  const contexts = ["tab"];
  browser.menus.create({ id: PARENT_ID, title: "Label tab", contexts });
  for (const l of labels) {
    browser.menus.create({ id: ITEM_PREFIX + l.id, parentId: PARENT_ID, title: TabLabels.menuTitle(l), contexts });
  }
  if (labels.length) browser.menus.create({ id: SEPARATOR_ID, parentId: PARENT_ID, type: "separator", contexts });
  browser.menus.create({ id: REMOVE_ID, parentId: PARENT_ID, title: "Remove label", contexts });
  browser.menus.create({ id: SETTINGS_SEPARATOR_ID, parentId: PARENT_ID, type: "separator", contexts });
  browser.menus.create({ id: SETTINGS_ID, parentId: PARENT_ID, title: "Tab Labels settings", contexts });
}

function notifyTab(tabId) {
  browser.tabs.sendMessage(tabId, { type: "refresh" }).catch(() => {
    // Restricted pages (about:, PDF viewer, addons.mozilla.org) have no content script.
  });
}

async function refreshAllTabs() {
  for (const tab of await browser.tabs.query({})) notifyTab(tab.id);
}

async function handleMenuClick(info, tab) {
  if (typeof info.menuItemId !== "string") return;
  const id = info.menuItemId;
  if (id === SETTINGS_ID) {
    await browser.runtime.openOptionsPage();
    return;
  }
  if (!tab) return;
  if (id === REMOVE_ID) {
    await browser.sessions.setTabValue(tab.id, TAB_KEY, NO_LABEL);
  } else if (id.startsWith(ITEM_PREFIX)) {
    await browser.sessions.setTabValue(tab.id, TAB_KEY, id.slice(ITEM_PREFIX.length));
  } else {
    return;
  }
  notifyTab(tab.id);
}

browser.menus.onClicked.addListener(handleMenuClick);

const DISPLAY_KEYS = ["labels", "showFavicon", "showTitle", "showEmoji", "displayMode"];

// For the settings page button: in every tab remove what the extension put there and put it
// back, adding the label code first to tabs that were open before the extension was installed
// or updated (they have none yet).
async function refreshEverywhere() {
  const result = { refreshed: 0, injected: 0, skipped: 0 };
  for (const tab of await browser.tabs.query({})) {
    try {
      await browser.tabs.sendMessage(tab.id, { type: "reset" });
      result.refreshed++;
    } catch (e) {
      try {
        await browser.scripting.executeScript({ target: { tabId: tab.id }, files: ["lib/labels.js", "content.js"] });
        result.injected++;
      } catch (e2) {
        result.skipped++; // browser pages, or a tab that has not loaded
      }
    }
  }
  return result;
}

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.labels) rebuildMenu();
  if (DISPLAY_KEYS.some((key) => changes[key])) refreshAllTabs();
  if (changes.containerRules) applyChangedRules(changes.containerRules).catch(logError);
  if (changes.groupByContainer && changes.groupByContainer.newValue === true) syncGroups();
  if (changes.labels) syncGroups({ regroup: false });
});

rebuildMenu();

// Container rules: a container can give every new tab opened in it a label.

function logError(e) {
  console.error("Tab Labels:", e);
}

async function autoAssign(tab, settings) {
  const labelId = TabLabels.ruleLabelId(settings.containerRules, tab.cookieStoreId);
  if (!labelId || !TabLabels.findLabel(settings.labels, labelId)) return;
  // Any stored value, including NO_LABEL, means the tab was already dealt with.
  if ((await browser.sessions.getTabValue(tab.id, TAB_KEY)) !== undefined) return;
  await browser.sessions.setTabValue(tab.id, TAB_KEY, labelId);
  notifyTab(tab.id);
}

browser.tabs.onCreated.addListener((tab) => {
  loadSettings()
    .then((settings) => autoAssign(tab, settings))
    .then(() => syncGroups({ containers: [tab.cookieStoreId] }))
    .catch(logError);
});

// When a rule is added or changed, label the unlabelled tabs already open in that
// container. Containers whose rule did not change are left alone.
async function applyChangedRules(change) {
  const before = TabLabels.normaliseSettings({ containerRules: change.oldValue }).containerRules;
  const settings = await loadSettings();
  const changed = Object.keys(settings.containerRules).filter((id) => settings.containerRules[id] !== before[id]);
  if (!changed.length) return;
  for (const tab of await browser.tabs.query({})) {
    if (changed.includes(tab.cookieStoreId)) await autoAssign(tab, settings);
  }
  await syncGroups({ containers: changed });
}

// Tab groups: with "Group tabs by container" on, the tabs of a container that has a label sit in a
// tab group named after that label, one group per window. Only groups this extension made (their ids
// are kept in storage.session) or ones named like the label are ever joined or renamed. Pinned tabs
// and tabs the user has already put in a group are left alone. Turning the setting off leaves
// existing groups as they are.

const OWNED_GROUPS_KEY = "ownedGroups";

let groupQueue = Promise.resolve();

function syncGroups(options) {
  groupQueue = groupQueue.then(() => runGroupSync(options)).catch(logError);
  return groupQueue;
}

async function runGroupSync(options) {
  const settings = await loadSettings();
  if (!settings.groupByContainer) return;
  const tabs = await browser.tabs.query({});
  const groups = await browser.tabGroups.query({});
  const titles = {};
  for (const g of groups) titles[g.id] = g.title;
  const stored = await browser.storage.session.get(OWNED_GROUPS_KEY);
  const owned = new Set(Array.isArray(stored[OWNED_GROUPS_KEY]) ? stored[OWNED_GROUPS_KEY] : []);
  for (const id of owned) if (!(id in titles)) owned.delete(id); // forget groups that are gone
  const plan = TabLabels.planContainerGroups(tabs, titles, settings, Object.assign({}, options, { ownedGroups: [...owned] }));
  for (const step of plan) {
    try {
      let groupId = step.groupId;
      if (step.tabIds.length) {
        groupId =
          groupId === null
            ? await browser.tabs.group({ tabIds: step.tabIds, createProperties: { windowId: step.windowId } })
            : await browser.tabs.group({ tabIds: step.tabIds, groupId });
      }
      if (step.groupId === null) owned.add(groupId);
      if (step.groupId === null || step.retitle) await browser.tabGroups.update(groupId, { title: step.title });
    } catch (e) {
      logError(e); // one container failing must not stop the others
    }
  }
  await browser.storage.session.set({ [OWNED_GROUPS_KEY]: [...owned] });
}

// Content script requests

async function getState(sender) {
  const { labels, display } = await loadSettings();
  const tabId = sender.tab && sender.tab.id;
  // allPrefixes lets the page recognise (and remove) any prefix this extension, or an
  // older version of it, may have left on the title.
  const allPrefixes = TabLabels.allPrefixes(labels);
  if (tabId === undefined) return { label: null, display, allPrefixes };
  const labelId = await browser.sessions.getTabValue(tabId, TAB_KEY);
  return {
    label: TabLabels.findLabel(labels, labelId),
    display: TabLabels.displayForTab(display, sender.tab.cookieStoreId),
    allPrefixes,
  };
}

function readAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function fetchIconData(url) {
  if (typeof url !== "string") return null;
  if (url.startsWith("data:image/")) return url.length <= MAX_ICON_BYTES * 2 ? url : null;
  if (!/^https?:/i.test(url)) return null;
  const response = await fetch(url, { credentials: "omit" });
  if (!response.ok) return null;
  const blob = await response.blob();
  if (!blob.type.startsWith("image/") || blob.size > MAX_ICON_BYTES) return null;
  return readAsDataUrl(blob);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image failed to load"));
    img.src = src;
  });
}

// Draws the site icon with a coloured dot in the top-left corner.
// Falls back to a grey disc if the icon cannot be fetched or decoded.
async function renderIcon(url, colour) {
  if (!TabLabels.isColour(colour)) return null;

  const canvas = document.createElement("canvas");
  canvas.width = ICON_SIZE;
  canvas.height = ICON_SIZE;
  const ctx = canvas.getContext("2d");

  let img = null;
  try {
    const data = await fetchIconData(url);
    if (data) img = await loadImage(data);
  } catch (e) {
    img = null;
  }

  if (img) {
    ctx.drawImage(img, 0, 0, ICON_SIZE, ICON_SIZE);
  } else {
    ctx.fillStyle = "#9aa0a6";
    ctx.beginPath();
    ctx.arc(16, 16, 13, 0, 2 * Math.PI);
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(10, 10, 9, 0, 2 * Math.PI);
  ctx.fillStyle = colour;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();

  return canvas.toDataURL("image/png");
}

browser.runtime.onMessage.addListener((message, sender) => {
  if (!message) return undefined;
  if (message.type === "getState") return getState(sender);
  if (message.type === "renderIcon") return renderIcon(message.url, message.colour);
  if (message.type === "refreshAllTabs") return refreshEverywhere();
  return undefined;
});

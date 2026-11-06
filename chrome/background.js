"use strict";

// Service worker: Chrome stops it when idle, so it keeps no state in memory.
// Listeners are registered at the top level, labels are read from storage on every
// event, and each tab's label lives in storage.session (kept while Chrome is open).
importScripts("lib/labels.js");

const PARENT_ID = "tab-labels-parent";
const SEPARATOR_ID = "tab-labels-separator";
const REMOVE_ID = "tab-labels-remove";
const ITEM_PREFIX = "tab-labels-item:";
const TAB_KEY_PREFIX = "tab:";
const MAX_ICON_BYTES = 1024 * 1024;
const ICON_SIZE = 32;

function logError(e) {
  console.error("Tab Labels:", e);
}

async function loadSettings() {
  try {
    return TabLabels.normaliseSettings(await chrome.storage.local.get(TabLabels.SETTINGS_KEYS));
  } catch (e) {
    return TabLabels.defaultSettings();
  }
}

// Per-tab labels. Chrome has no per-tab storage that survives a restart, so this is
// keyed by tab id in storage.session: it lasts until Chrome is closed.

function tabKey(tabId) {
  return TAB_KEY_PREFIX + tabId;
}

async function getTabLabelId(tabId) {
  const key = tabKey(tabId);
  return (await chrome.storage.session.get(key))[key];
}

async function setTabLabelId(tabId, labelId) {
  if (labelId) await chrome.storage.session.set({ [tabKey(tabId)]: labelId });
  else await chrome.storage.session.remove(tabKey(tabId));
}

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove(tabKey(tabId)).catch(logError);
});

// Chrome sometimes swaps a tab for another one (for example after prerendering).
chrome.tabs.onReplaced.addListener(async (addedTabId, removedTabId) => {
  try {
    const labelId = await getTabLabelId(removedTabId);
    await chrome.storage.session.remove(tabKey(removedTabId));
    if (labelId) {
      await setTabLabelId(addedTabId, labelId);
      notifyTab(addedTabId);
    }
  } catch (e) {
    logError(e);
  }
});

// Menu. Chrome has no tab context menu, so the label menu is on the page
// right-click menu and on the toolbar icon's right-click menu.

let menuQueue = Promise.resolve();

function rebuildMenu() {
  menuQueue = menuQueue.then(buildMenu).catch((e) => console.error("Tab Labels: menu rebuild failed", e));
  return menuQueue;
}

async function buildMenu() {
  const { labels } = await loadSettings();
  await chrome.contextMenus.removeAll();
  const contexts = ["page", "action"];
  chrome.contextMenus.create({ id: PARENT_ID, title: "Label tab", contexts });
  for (const l of labels) {
    chrome.contextMenus.create({ id: ITEM_PREFIX + l.id, parentId: PARENT_ID, title: TabLabels.menuTitle(l), contexts });
  }
  if (labels.length) chrome.contextMenus.create({ id: SEPARATOR_ID, parentId: PARENT_ID, type: "separator", contexts });
  chrome.contextMenus.create({ id: REMOVE_ID, parentId: PARENT_ID, title: "Remove label", contexts });
}

function notifyTab(tabId) {
  chrome.tabs.sendMessage(tabId, { type: "refresh" }).catch(() => {
    // Pages without a content script (chrome:// pages, the Web Store, the PDF viewer).
  });
}

async function refreshAllTabs() {
  for (const tab of await chrome.tabs.query({})) notifyTab(tab.id);
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || tab.id === undefined || typeof info.menuItemId !== "string") return;
  const id = info.menuItemId;
  try {
    if (id === REMOVE_ID) await setTabLabelId(tab.id, null);
    else if (id.startsWith(ITEM_PREFIX)) await setTabLabelId(tab.id, id.slice(ITEM_PREFIX.length));
    else return;
    notifyTab(tab.id);
  } catch (e) {
    logError(e);
  }
});

// Clicking the toolbar icon opens the settings.
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

chrome.runtime.onInstalled.addListener(rebuildMenu);
chrome.runtime.onStartup.addListener(rebuildMenu);

const DISPLAY_KEYS = ["labels", "showFavicon", "showTitle", "showEmoji"];

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.labels) rebuildMenu();
  if (DISPLAY_KEYS.some((key) => changes[key])) refreshAllTabs().catch(logError);
});

// Content script requests

async function getState(sender) {
  const { labels, display } = await loadSettings();
  const tabId = sender.tab && sender.tab.id;
  if (tabId === undefined) return { label: null, display };
  return { label: TabLabels.findLabel(labels, await getTabLabelId(tabId)), display };
}

async function fetchIconBlob(url) {
  if (typeof url !== "string") return null;
  if (url.startsWith("data:image/")) {
    if (url.length > MAX_ICON_BYTES * 2) return null;
  } else if (!/^https?:/i.test(url)) {
    return null;
  }
  const response = await fetch(url, { credentials: "omit" });
  if (!response.ok) return null;
  const blob = await response.blob();
  if (!blob.type.startsWith("image/") || blob.size > MAX_ICON_BYTES) return null;
  return blob;
}

async function blobToDataUrl(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return "data:" + (blob.type || "image/png") + ";base64," + btoa(binary);
}

// Draws the site icon with a coloured dot in the top-left corner.
// Falls back to a grey disc if the icon cannot be fetched or decoded (for example SVG).
async function renderIcon(url, colour) {
  if (!TabLabels.isColour(colour)) return null;

  const canvas = new OffscreenCanvas(ICON_SIZE, ICON_SIZE);
  const ctx = canvas.getContext("2d");

  let bitmap = null;
  try {
    const blob = await fetchIconBlob(url);
    if (blob) bitmap = await createImageBitmap(blob);
  } catch (e) {
    bitmap = null;
  }

  if (bitmap) {
    ctx.drawImage(bitmap, 0, 0, ICON_SIZE, ICON_SIZE);
    bitmap.close();
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

  return blobToDataUrl(await canvas.convertToBlob({ type: "image/png" }));
}

// Chrome does not accept a promise as the reply, so answer with sendResponse and
// return true to keep the channel open.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  let reply = null;
  if (message && message.type === "getState") reply = getState(sender);
  else if (message && message.type === "renderIcon") reply = renderIcon(message.url, message.colour);
  if (!reply) return false;
  reply.then(sendResponse, (e) => {
    logError(e);
    sendResponse(null);
  });
  return true;
});

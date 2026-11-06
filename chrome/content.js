"use strict";

(function () {
  if (window.__tabLabelsLoaded) return;
  window.__tabLabelsLoaded = true;

  const ICON_ID = "tab-labels-icon";
  const REAPPLY_DELAY_MS = 200;

  let current = { label: null, display: { favicon: true, title: true, emoji: true } };
  let appliedPrefix = ""; // the prefix currently on the title, "" if none
  let removedIcons = []; // the page's own icon links, taken out while our icon is shown
  let faviconVersion = 0; // discards results of superseded async renders
  let faviconWanted = false;
  let reapplyTimer = null;
  const renderCache = new Map();

  function head() {
    return document.head || document.documentElement;
  }

  // Title

  function applyTitle() {
    const want = current.label ? TabLabels.titlePrefix(current.label, current.display) : "";
    const title = TabLabels.stripPrefix(document.title, appliedPrefix);
    appliedPrefix = want;
    const next = TabLabels.buildTitle(title, want);
    if (document.title !== next) document.title = next;
  }

  // Favicon

  function iconLinks() {
    return Array.from(document.querySelectorAll('link[rel~="icon" i]')).filter((l) => l.id !== ICON_ID);
  }

  function findIconUrl() {
    const link = iconLinks().concat(removedIcons).find((l) => l.href);
    if (link) return link.href;
    return /^https?:/.test(location.origin) ? location.origin + "/favicon.ico" : null;
  }

  function clearFavicon() {
    const ours = document.getElementById(ICON_ID);
    if (ours) ours.remove();
    for (const l of removedIcons) head().appendChild(l);
    removedIcons = [];
  }

  function installFavicon(href) {
    for (const l of iconLinks()) {
      l.remove();
      removedIcons.push(l);
    }
    let ours = document.getElementById(ICON_ID);
    if (!ours) {
      ours = document.createElement("link");
      ours.id = ICON_ID;
      ours.rel = "icon";
      head().appendChild(ours);
    }
    ours.href = href;
  }

  async function renderIcon(url, colour) {
    const key = url + "|" + colour;
    if (renderCache.has(key)) return renderCache.get(key);
    let dataUrl = null;
    try {
      dataUrl = await chrome.runtime.sendMessage({ type: "renderIcon", url, colour });
    } catch (e) {
      dataUrl = null;
    }
    if (dataUrl) renderCache.set(key, dataUrl);
    return dataUrl;
  }

  async function applyFavicon() {
    const version = ++faviconVersion;
    const want = current.label && current.display.favicon ? current.label : null;
    faviconWanted = !!want;
    if (!want) {
      clearFavicon();
      return;
    }
    const dataUrl = await renderIcon(findIconUrl(), want.colour);
    if (version !== faviconVersion || !dataUrl) return;
    installFavicon(dataUrl);
  }

  function scheduleFavicon() {
    clearTimeout(reapplyTimer);
    reapplyTimer = setTimeout(applyFavicon, REAPPLY_DELAY_MS);
  }

  // Page changes

  function isForeignIconLink(node) {
    return node.nodeType === 1 && node.tagName === "LINK" && node.id !== ICON_ID && /(^|\s)icon(\s|$)/i.test(node.rel);
  }

  function onHeadChange(mutations) {
    if (appliedPrefix && !TabLabels.isPrefixed(document.title, appliedPrefix)) {
      document.title = TabLabels.buildTitle(document.title, appliedPrefix);
    }
    if (faviconWanted && mutations.some((m) => Array.from(m.addedNodes).some(isForeignIconLink))) {
      scheduleFavicon();
    }
  }

  new MutationObserver(onHeadChange).observe(head(), { childList: true, subtree: true, characterData: true });

  // State from the background

  async function refresh() {
    let state;
    try {
      state = await chrome.runtime.sendMessage({ type: "getState" });
    } catch (e) {
      return;
    }
    if (!state) return;
    current = state;
    applyTitle();
    applyFavicon();
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message && message.type === "refresh") refresh();
  });

  refresh();
})();

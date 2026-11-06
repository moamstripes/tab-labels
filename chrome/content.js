"use strict";

(function () {
  // Only one live copy per page. A copy left behind by an older version of the extension is
  // dead (cut off from the extension) and does not count.
  const previous = window.__tabLabelsInstance;
  if (previous && previous.alive()) return;
  window.__tabLabelsInstance = { alive };

  const ICON_ID = "tab-labels-icon";
  // What the extension leaves in a page is recorded in the page itself, not only in this
  // script's memory. When the extension is updated the old script dies but its changes stay;
  // a newer copy of the script (or the refresh button) can then find and clean them up.
  const PREFIX_ATTR = "data-tab-labels-prefix"; // on <html>: the prefix currently on the title
  const HIDDEN_REL = "x-tab-labels-hidden"; // rel given to the page's own icon links while ours is shown
  const SAVED_REL_ATTR = "data-tab-labels-rel"; // on those links: their original rel
  const REAPPLY_DELAY_MS = 200;

  let current = { label: null, display: { favicon: true, title: true, emoji: true }, allPrefixes: [] };
  let faviconVersion = 0; // discards results of superseded async renders
  let faviconWanted = false;
  let reapplyTimer = null;
  let observer = null;
  const recentRewrites = [];
  const renderCache = new Map();
  const MAX_REWRITES = 8; // within REWRITE_WINDOW_MS; more than that means something is fighting us
  const REWRITE_WINDOW_MS = 1000;

  function head() {
    return document.head || document.documentElement;
  }

  // False once the extension has been updated, disabled or removed: this copy of the script is
  // then cut off from it and must stop touching the page.
  function alive() {
    try {
      return !!(chrome.runtime && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  }

  // Title

  function appliedPrefix() {
    return document.documentElement.getAttribute(PREFIX_ATTR) || "";
  }

  function setAppliedPrefix(prefix) {
    if (prefix) document.documentElement.setAttribute(PREFIX_ATTR, prefix);
    else document.documentElement.removeAttribute(PREFIX_ATTR);
  }

  // Every prefix that could be on the title: the one applied now, and every prefix any label
  // can produce (this covers leftovers from an older version of the extension).
  function knownPrefixes() {
    return current.allPrefixes.concat(appliedPrefix());
  }

  function applyTitle() {
    const want = current.label ? TabLabels.titlePrefix(current.label, current.display) : "";
    const next = TabLabels.normaliseTitle(document.title, want, knownPrefixes());
    setAppliedPrefix(want);
    if (document.title !== next) document.title = next;
  }

  // Favicon

  function iconLinks() {
    return Array.from(document.querySelectorAll('link[rel~="icon" i]')).filter((l) => l.id !== ICON_ID);
  }

  function savedIconLinks() {
    return Array.from(document.querySelectorAll("link[" + SAVED_REL_ATTR + "]"));
  }

  function findIconUrl() {
    const link = iconLinks().concat(savedIconLinks()).find((l) => l.href);
    if (link) return link.href;
    return /^https?:/.test(location.origin) ? location.origin + "/favicon.ico" : null;
  }

  function clearFavicon() {
    const ours = document.getElementById(ICON_ID);
    if (ours) ours.remove();
    for (const l of savedIconLinks()) {
      l.setAttribute("rel", l.getAttribute(SAVED_REL_ATTR));
      l.removeAttribute(SAVED_REL_ATTR);
      head().appendChild(l); // browsers notice a link being inserted, but not always a changed rel
    }
  }

  function installFavicon(href) {
    for (const l of iconLinks()) {
      l.setAttribute(SAVED_REL_ATTR, l.getAttribute("rel"));
      l.setAttribute("rel", HIDDEN_REL);
      head().appendChild(l);
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

  // True if rewriting the title is still reasonable. If something (such as a copy of this script
  // left behind by an older version) keeps changing the title back, stop instead of looping.
  function rewriteAllowed() {
    const now = Date.now();
    while (recentRewrites.length && now - recentRewrites[0] > REWRITE_WINDOW_MS) recentRewrites.shift();
    if (recentRewrites.length >= MAX_REWRITES) return false;
    recentRewrites.push(now);
    return true;
  }

  function startWatching() {
    observer.observe(head(), { childList: true, subtree: true, characterData: true });
  }

  function onHeadChange(mutations) {
    if (!alive()) {
      observer.disconnect();
      clearTimeout(reapplyTimer);
      return;
    }
    // Keep exactly one prefix, at the front, even if the page rewrote the title around ours.
    const prefix = appliedPrefix();
    if (prefix) {
      const next = TabLabels.normaliseTitle(document.title, prefix, knownPrefixes());
      if (document.title !== next) {
        if (!rewriteAllowed()) {
          observer.disconnect();
          return;
        }
        document.title = next;
      }
    }
    if (faviconWanted && mutations.some((m) => Array.from(m.addedNodes).some(isForeignIconLink))) {
      scheduleFavicon();
    }
  }

  observer = new MutationObserver(onHeadChange);
  startWatching();

  // State from the background

  async function refresh() {
    let state;
    try {
      state = await chrome.runtime.sendMessage({ type: "getState" });
    } catch (e) {
      return;
    }
    if (!state) return;
    current = Object.assign({ allPrefixes: [] }, state);
    recentRewrites.length = 0;
    startWatching();
    applyTitle();
    applyFavicon();
  }

  // Takes off everything this extension put on the page, then puts it back from the current state.
  async function reset() {
    const plain = TabLabels.stripAllPrefixes(document.title, knownPrefixes());
    setAppliedPrefix("");
    if (document.title !== plain) document.title = plain;
    faviconVersion++;
    faviconWanted = false;
    clearTimeout(reapplyTimer);
    clearFavicon();
    await refresh();
  }

  // Replying lets the background tell a tab that has this script from one that does not.
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const task = message && message.type === "refresh" ? refresh : message && message.type === "reset" ? reset : null;
    if (!task) return false;
    task().then(() => sendResponse({ ok: true }));
    return true;
  });

  refresh();
})();

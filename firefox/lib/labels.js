// Pure label logic shared by the background script, content script and settings page.
// No browser APIs are used here so it can be unit tested.
(function (root) {
  "use strict";

  const NAME_MAX = 30;
  const EMOJI_MAX = 12;
  const COLOUR_RE = /^#[0-9a-f]{6}$/i;
  const EMOJI_RE = /\p{Extended_Pictographic}/u;
  const NOT_EMOJI_RE = /[\p{L}\p{N}\s]/u;
  const CONTAINER_ID_RE = /^firefox-container-\d+$/;

  // Every key the extension keeps in storage.local. displayMode is the pre-1.1
  // setting, read only so existing installs keep their choice.
  const SETTINGS_KEYS = ["labels", "showFavicon", "showTitle", "showEmoji", "containerRules", "displayMode"];

  const DEFAULT_LABELS = [
    { id: "waiting", name: "Waiting", emoji: "⏳", colour: "#d98e04" },
    { id: "paused", name: "Paused", emoji: "⏸️", colour: "#4a7fd4" },
    { id: "todo", name: "To do", emoji: "✏️", colour: "#2f9e6b" },
  ];

  function defaultSettings() {
    return {
      labels: DEFAULT_LABELS.map((l) => Object.assign({}, l)),
      display: { favicon: true, title: true, emoji: true },
      containerRules: {},
    };
  }

  function validateLabel(input) {
    const name = String((input && input.name) || "").trim();
    const emoji = String((input && input.emoji) || "").trim();
    const colour = String((input && input.colour) || "").trim().toLowerCase();

    if (name.length > NAME_MAX) return { ok: false, error: "Name must be " + NAME_MAX + " characters or fewer." };
    if (!emoji || emoji.length > EMOJI_MAX || !EMOJI_RE.test(emoji) || NOT_EMOJI_RE.test(emoji)) {
      return { ok: false, error: "Enter a single emoji." };
    }
    if (!COLOUR_RE.test(colour)) return { ok: false, error: "Colour must look like #rrggbb." };

    return { ok: true, label: { name, emoji, colour } };
  }

  function isColour(value) {
    return typeof value === "string" && COLOUR_RE.test(value);
  }

  function normaliseLabels(rawLabels) {
    const seen = new Set();
    const labels = [];
    for (const item of rawLabels) {
      if (!item || typeof item.id !== "string" || !item.id || seen.has(item.id)) continue;
      const v = validateLabel(item);
      if (!v.ok) continue;
      seen.add(item.id);
      labels.push(Object.assign({ id: item.id }, v.label));
    }
    return labels;
  }

  // The old single displayMode maps onto the three toggles. Before 1.1 the title
  // always carried the emoji, so "title" and "both" keep the emoji on.
  function legacyDisplay(mode) {
    if (mode === "favicon") return { favicon: true, title: false, emoji: false };
    if (mode === "title") return { favicon: false, title: true, emoji: true };
    return { favicon: true, title: true, emoji: true };
  }

  function normaliseDisplay(raw) {
    const display = legacyDisplay(raw.displayMode);
    if (typeof raw.showFavicon === "boolean") display.favicon = raw.showFavicon;
    if (typeof raw.showTitle === "boolean") display.title = raw.showTitle;
    if (typeof raw.showEmoji === "boolean") display.emoji = raw.showEmoji;
    return display;
  }

  function normaliseRules(rawRules) {
    const rules = {};
    if (!rawRules || typeof rawRules !== "object" || Array.isArray(rawRules)) return rules;
    for (const key of Object.keys(rawRules)) {
      const value = rawRules[key];
      if (CONTAINER_ID_RE.test(key) && typeof value === "string" && value) rules[key] = value;
    }
    return rules;
  }

  function normaliseSettings(raw) {
    const out = defaultSettings();
    if (!raw || typeof raw !== "object") return out;
    if (Array.isArray(raw.labels)) out.labels = normaliseLabels(raw.labels);
    out.display = normaliseDisplay(raw);
    out.containerRules = normaliseRules(raw.containerRules);
    return out;
  }

  // Containers already colour their tabs, so a tab inside one never gets the favicon dot.
  // The title label and emoji are unaffected.
  function displayForTab(display, cookieStoreId) {
    if (typeof cookieStoreId === "string" && CONTAINER_ID_RE.test(cookieStoreId)) {
      return Object.assign({}, display, { favicon: false });
    }
    return display;
  }

  // The label id a container assigns to new tabs, or null.
  function ruleLabelId(rules, cookieStoreId) {
    if (!rules || typeof cookieStoreId !== "string") return null;
    return Object.prototype.hasOwnProperty.call(rules, cookieStoreId) ? rules[cookieStoreId] : null;
  }

  function makeId(name, existingIds) {
    const base =
      String(name || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "label";
    const taken = new Set(existingIds || []);
    if (!taken.has(base)) return base;
    let n = 2;
    while (taken.has(base + "-" + n)) n++;
    return base + "-" + n;
  }

  function findLabel(labels, id) {
    if (!Array.isArray(labels) || !id) return null;
    return labels.find((l) => l.id === id) || null;
  }

  // What goes in front of the page title: the emoji and/or the name, depending on
  // the toggles. Empty when neither applies, in which case the title is untouched.
  function titlePrefix(label, display) {
    const parts = [];
    if (display.emoji && label.emoji) parts.push(label.emoji);
    if (display.title && label.name) parts.push(label.name);
    return parts.length ? parts.join(" ") + " · " : "";
  }

  function buildTitle(title, prefix) {
    return prefix + title;
  }

  function isPrefixed(title, prefix) {
    return prefix !== "" && String(title).startsWith(prefix);
  }

  function stripPrefix(title, prefix) {
    return isPrefixed(title, prefix) ? String(title).slice(prefix.length) : title;
  }

  function menuTitle(label) {
    return label.emoji + (label.name ? " " + label.name : "");
  }

  // Import and export. A file holds only the labels (emoji, name, colour). Ids,
  // container rules and per-tab labels belong to one Firefox profile, so they are not shared.

  const EXPORT_FORMAT = "tab-labels";
  const IMPORT_MAX_LABELS = 100;

  function exportLabels(labels) {
    return JSON.stringify(
      {
        format: EXPORT_FORMAT,
        version: 1,
        labels: labels.map((l) => ({ name: l.name, emoji: l.emoji, colour: l.colour })),
      },
      null,
      2
    );
  }

  function parseLabelsImport(text) {
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return { ok: false, error: "That file is not valid JSON." };
    }
    const list = Array.isArray(data) ? data : data && data.format === EXPORT_FORMAT ? data.labels : null;
    if (!Array.isArray(list)) return { ok: false, error: "That file is not a Tab Labels export." };

    const labels = [];
    let skipped = Math.max(0, list.length - IMPORT_MAX_LABELS);
    for (const item of list.slice(0, IMPORT_MAX_LABELS)) {
      const v = validateLabel(item);
      if (v.ok) labels.push(v.label);
      else skipped++;
    }
    if (!labels.length) return { ok: false, error: "No valid labels found in that file." };
    return { ok: true, labels, skipped };
  }

  function sameLabelKey(l) {
    return [String(l.name || "").trim(), String(l.emoji || "").trim(), String(l.colour || "").trim().toLowerCase()].join("|");
  }

  // Imported labels that are not already in the list (or earlier in the import).
  function mergeImported(existing, imported) {
    const seen = new Set(existing.map(sameLabelKey));
    const added = [];
    let duplicates = 0;
    for (const l of imported) {
      const key = sameLabelKey(l);
      if (seen.has(key)) {
        duplicates++;
      } else {
        seen.add(key);
        added.push(l);
      }
    }
    return { added, duplicates };
  }

  const api = {
    SETTINGS_KEYS,
    defaultSettings,
    validateLabel,
    isColour,
    normaliseSettings,
    ruleLabelId,
    displayForTab,
    makeId,
    findLabel,
    titlePrefix,
    buildTitle,
    isPrefixed,
    stripPrefix,
    menuTitle,
    exportLabels,
    parseLabelsImport,
    mergeImported,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.TabLabels = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

// Pure label logic shared by the background script, content script and settings page.
// No browser APIs are used here so it can be unit tested.
(function (root) {
  "use strict";

  const NAME_MAX = 30;
  const EMOJI_MAX = 12;
  const COLOUR_RE = /^#[0-9a-f]{6}$/i;
  const EMOJI_RE = /\p{Extended_Pictographic}/u;
  const NOT_EMOJI_RE = /[\p{L}\p{N}\s]/u;

  // Every key the extension keeps in storage.local.
  const SETTINGS_KEYS = ["labels", "showFavicon", "showTitle", "showEmoji", "colorMode"];

  const DEFAULT_LABELS = [
    { id: "waiting", name: "Waiting", emoji: "⏳", colour: "#d98e04" },
    { id: "paused", name: "Paused", emoji: "⏸️", colour: "#4a7fd4" },
    { id: "todo", name: "To do", emoji: "✏️", colour: "#2f9e6b" },
  ];

  function defaultSettings() {
    return {
      labels: DEFAULT_LABELS.map((l) => Object.assign({}, l)),
      display: { favicon: true, title: true, emoji: true },
      colorMode: "system",
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

  function normaliseDisplay(raw) {
    const display = { favicon: true, title: true, emoji: true };
    if (typeof raw.showFavicon === "boolean") display.favicon = raw.showFavicon;
    if (typeof raw.showTitle === "boolean") display.title = raw.showTitle;
    if (typeof raw.showEmoji === "boolean") display.emoji = raw.showEmoji;
    return display;
  }

  function normaliseSettings(raw) {
    const out = defaultSettings();
    if (!raw || typeof raw !== "object") return out;
    if (Array.isArray(raw.labels)) out.labels = normaliseLabels(raw.labels);
    out.display = normaliseDisplay(raw);
    out.colorMode = raw.colorMode === "light" || raw.colorMode === "dark" ? raw.colorMode : "system";
    return out;
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

  // Every prefix any label could put in front of a title: emoji and name, name only,
  // emoji only. Used to recognise (and remove) prefixes left on a title.
  function allPrefixes(labels) {
    const variants = [
      { emoji: true, title: true },
      { emoji: false, title: true },
      { emoji: true, title: false },
    ];
    const found = new Set();
    for (const label of labels || []) {
      for (const v of variants) {
        const p = titlePrefix(label, v);
        if (p) found.add(p);
      }
    }
    return Array.from(found);
  }

  // Removes every occurrence of each prefix, anywhere in the title (longest first).
  function stripAllPrefixes(title, prefixes) {
    let out = String(title);
    const list = (prefixes || []).filter((p) => typeof p === "string" && p !== "");
    list.sort((a, b) => b.length - a.length);
    for (const p of list) out = out.split(p).join("");
    return out;
  }

  // The title with exactly one prefix, at the front, whatever the page or an older copy
  // of the extension did to it. An empty prefix gives the plain title.
  function normaliseTitle(title, prefix, knownPrefixes) {
    return (prefix || "") + stripAllPrefixes(title, (knownPrefixes || []).concat(prefix || ""));
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

  // What Enter in label number `index` of the settings list should do: move to the
  // next label ("next"), add a new one ("add"), or nothing ("stay"). A blank last label
  // does not add another, so blank labels cannot pile up.
  function enterAction(rows, index) {
    if (index < rows.length - 1) return "next";
    const row = rows[index];
    if (!row) return "stay";
    return String(row.emoji || "").trim() || String(row.name || "").trim() ? "add" : "stay";
  }

  // The message shown after "Refresh all tabs": how many tabs were refreshed (including
  // ones the label code had to be added to) and how many could not be reached.
  function refreshSummary(result) {
    const r = result || {};
    const done = (r.refreshed || 0) + (r.injected || 0);
    const skipped = r.skipped || 0;
    const tabs = (n) => n + (n === 1 ? " tab" : " tabs");
    const unreachable = skipped
      ? skipped + " could not be reached (browser pages, or tabs that have not loaded yet)."
      : "";
    if (done === 0 && skipped === 0) return "There are no open tabs to refresh.";
    if (done === 0) return "No tabs could be refreshed. " + unreachable;
    return "Refreshed " + tabs(done) + "." + (unreachable ? " " + unreachable : "");
  }

  function menuTitle(label) {
    return label.emoji + (label.name ? " " + label.name : "");
  }

  // Import and export. A file holds only the labels (emoji, name, colour). Ids and
  // per-tab labels belong to one browser session, so they are not shared.

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
    makeId,
    findLabel,
    titlePrefix,
    allPrefixes,
    stripAllPrefixes,
    normaliseTitle,
    buildTitle,
    isPrefixed,
    stripPrefix,
    enterAction,
    refreshSummary,
    menuTitle,
    exportLabels,
    parseLabelsImport,
    mergeImported,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.TabLabels = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

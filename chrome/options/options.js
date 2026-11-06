"use strict";

const rowsEl = document.getElementById("rows");
const rowsEmptyEl = document.getElementById("rows-empty");
const statusEl = document.getElementById("status");
const importFileEl = document.getElementById("import-file");
const spaceButton = document.getElementById("space-button");
const modeButton = document.getElementById("mode-button");

const TOGGLES = { showFavicon: "favicon", showTitle: "title", showEmoji: "emoji" };
const IMPORT_MAX_BYTES = 256 * 1024;
const STATUS_MS = 4000;
const SPACE_CACHE_KEY = "tab-labels-space";
// Switches the user has already flipped. The page's first read of storage can arrive late; it must not undo a click.
const flipped = new Set();

// Show the space theme straight away from a remembered value, before storage has answered,
// so the page does not flash its plain look first. Storage stays the source of truth.
try {
  if (localStorage.getItem(SPACE_CACHE_KEY) === "1") document.documentElement.setAttribute("data-space", "");
} catch (e) {
  // no local storage in this context: the page simply starts plain
}

function applySpace(on) {
  document.documentElement.toggleAttribute("data-space", on);
  try {
    localStorage.setItem(SPACE_CACHE_KEY, on ? "1" : "0");
  } catch (e) {
    // see above
  }
  updateModeButton();
}

// Light or dark: follows the system until a choice is made with the sun/moon button here.
const MODE_CACHE_KEY = "tab-labels-mode";
try {
  const cached = localStorage.getItem(MODE_CACHE_KEY);
  if (cached === "light" || cached === "dark") document.documentElement.setAttribute("data-theme", cached);
} catch (e) {
  // see above
}

function effectiveMode() {
  const chosen = document.documentElement.getAttribute("data-theme");
  if (chosen) return chosen;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// The button shows the mode you would switch to. In space the colours are fixed, so it rests.
function updateModeButton() {
  const dark = effectiveMode() === "dark";
  const inSpace = document.documentElement.hasAttribute("data-space");
  const label = inSpace ? "The colour mode does not apply in space. Land back to change it." : dark ? "Switch to light mode" : "Switch to dark mode";
  modeButton.dataset.mode = dark ? "dark" : "light";
  modeButton.title = label;
  modeButton.setAttribute("aria-label", label);
  modeButton.disabled = inSpace;
}

function applyMode(mode) {
  if (mode === "light" || mode === "dark") document.documentElement.setAttribute("data-theme", mode);
  else document.documentElement.removeAttribute("data-theme");
  try {
    localStorage.setItem(MODE_CACHE_KEY, mode);
  } catch (e) {
    // see above
  }
  updateModeButton();
}

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", updateModeButton);
updateModeButton();

let rows = []; // { id: string | null, name, emoji, colour }
let statusTimer = null;

function setStatus(text, isError) {
  clearTimeout(statusTimer);
  statusEl.textContent = text;
  statusEl.className = isError ? "error" : "";
  // Errors stay until the next action; confirmations fade away.
  if (text && !isError) statusTimer = setTimeout(() => (statusEl.textContent = ""), STATUS_MS);
}

function plural(n, word, pluralWord) {
  return n + " " + (n === 1 ? word : pluralWord || word + "s");
}

async function readSettings() {
  return TabLabels.normaliseSettings(await chrome.storage.local.get(TabLabels.SETTINGS_KEYS));
}

// Labels

function makeInput(type, className, value, ariaLabel, onInput, placeholder) {
  const input = document.createElement("input");
  if (placeholder) input.placeholder = placeholder;
  input.type = type;
  input.className = className;
  input.value = value;
  input.setAttribute("aria-label", ariaLabel);
  input.addEventListener("input", () => onInput(input.value));
  return input;
}

function makeDeleteButton(onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "btn danger";
  b.textContent = "Delete";
  b.title = "Delete label";
  b.addEventListener("click", onClick);
  return b;
}

function render() {
  EmojiPicker.close();
  rowsEl.textContent = "";
  rowsEmptyEl.hidden = rows.length > 0;
  rows.forEach((row, i) => {
    const li = document.createElement("li");
    const emojiInput = makeInput("text", "emoji", row.emoji, "Emoji", (v) => (row.emoji = v), "🙂");
    EmojiPicker.attach(emojiInput, (emoji) => {
      row.emoji = emoji;
      emojiInput.value = emoji;
    });
    const nameInput = makeInput("text", "name", row.name, "Name (optional)", (v) => (row.name = v), "Name (optional)");
    onEnter(emojiInput, () => {
      EmojiPicker.close();
      nameInput.focus();
    });
    onEnter(nameInput, () => {
      const action = TabLabels.enterAction(rows, i);
      if (action === "next") rowsEl.children[i + 1].querySelector(".name").focus();
      else if (action === "add") addRow();
    });
    li.append(
      makeInput("color", "swatch", row.colour, "Colour", (v) => (row.colour = v)),
      emojiInput,
      nameInput,
      makeDeleteButton(() => remove(i))
    );
    rowsEl.appendChild(li);
  });
}

function remove(i) {
  rows.splice(i, 1);
  render();
}

function addRow() {
  rows.push({ id: null, name: "", emoji: "", colour: "#6a5acd" });
  render();
  setStatus("", false);
  rowsEl.lastElementChild.querySelector(".emoji").focus(); // opens the emoji picker
}

// Enter in a label's name box: on to the next label, or a new one after the last.
function onEnter(input, action) {
  input.addEventListener("keydown", (event) => {
    // Enter that confirms an input method composition must not jump to another field.
    if (event.key !== "Enter" || event.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    action();
  });
}

async function save() {
  const labels = [];
  const ids = rows.filter((r) => r.id).map((r) => r.id);
  for (let i = 0; i < rows.length; i++) {
    const result = TabLabels.validateLabel(rows[i]);
    if (!result.ok) {
      setStatus("Label " + (i + 1) + ": " + result.error, true);
      return;
    }
    let id = rows[i].id;
    if (!id) {
      id = TabLabels.makeId(result.label.name, ids);
      ids.push(id);
    }
    labels.push(Object.assign({ id }, result.label));
  }
  await chrome.storage.local.set({ labels });
  rows = labels.map((l) => Object.assign({}, l));
  render();
  setStatus("Labels saved.", false);
}

// Import and export

async function exportFile() {
  const { labels } = await readSettings();
  if (!labels.length) {
    setStatus("There are no saved labels to export.", true);
    return;
  }
  const blob = new Blob([TabLabels.exportLabels(labels)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "tab-labels.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus("Exported " + plural(labels.length, "label") + " (saved labels only).", false);
}

async function importFile(file) {
  if (file.size > IMPORT_MAX_BYTES) {
    setStatus("That file is too large to be a label export.", true);
    return;
  }
  const parsed = TabLabels.parseLabelsImport(await file.text());
  if (!parsed.ok) {
    setStatus(parsed.error, true);
    return;
  }
  const { added, duplicates } = TabLabels.mergeImported(rows, parsed.labels);
  if (!added.length) {
    setStatus("Nothing new: every label in the file is already in your list.", false);
    return;
  }
  for (const l of added) rows.push(Object.assign({ id: null }, l));
  render();
  const notes = [];
  if (duplicates) notes.push(plural(duplicates, "duplicate") + " skipped");
  if (parsed.skipped) notes.push(plural(parsed.skipped, "invalid entry", "invalid entries") + " skipped");
  setStatus(
    "Added " + plural(added.length, "label") + (notes.length ? " (" + notes.join(", ") + ")" : "") +
      ". Press Save labels to keep them.",
    false
  );
}

// Start-up and wiring

async function load() {
  const settings = await readSettings();
  rows = settings.labels.map((l) => Object.assign({}, l));
  for (const input of document.querySelectorAll("input[data-key]")) {
    if (!flipped.has(input.dataset.key)) input.checked = settings.display[TOGGLES[input.dataset.key]];
  }
  if (!flipped.has("spaceTheme")) applySpace(settings.spaceTheme);
  if (!flipped.has("colorMode")) applyMode(settings.colorMode);
  render();
}

document.getElementById("add").addEventListener("click", addRow);

const refreshButton = document.getElementById("refresh-tabs");
refreshButton.addEventListener("click", async () => {
  refreshButton.disabled = true;
  try {
    const result = await chrome.runtime.sendMessage({ type: "refreshAllTabs" });
    setStatus(TabLabels.refreshSummary(result), false);
  } catch (e) {
    setStatus("Could not refresh the tabs. Try again.", true);
  } finally {
    refreshButton.disabled = false;
  }
});

document.getElementById("save").addEventListener("click", save);

document.getElementById("export").addEventListener("click", exportFile);

document.getElementById("import").addEventListener("click", () => importFileEl.click());

importFileEl.addEventListener("change", async () => {
  const file = importFileEl.files[0];
  importFileEl.value = ""; // so choosing the same file again still fires change
  if (file) await importFile(file);
});

document.getElementById("reset").addEventListener("click", async () => {
  if (!window.confirm("Replace all labels with the default labels?")) return;
  await chrome.storage.local.set({ labels: TabLabels.defaultSettings().labels });
  await load();
  setStatus("Labels reset to defaults.", false);
});

for (const input of document.querySelectorAll("input[data-key]")) {
  input.addEventListener("change", async () => {
    flipped.add(input.dataset.key);
    await chrome.storage.local.set({ [input.dataset.key]: input.checked });
    setStatus("Saved.", false);
  });
}

load();

spaceButton.addEventListener("click", async () => {
  flipped.add("spaceTheme");
  const on = !document.documentElement.hasAttribute("data-space"); // decided at the moment of the click
  applySpace(on);
  await chrome.storage.local.set({ spaceTheme: on });
  setStatus(on ? "Welcome to space." : "Back on Earth.", false);
});

modeButton.addEventListener("click", async () => {
  flipped.add("colorMode");
  const next = effectiveMode() === "dark" ? "light" : "dark";
  applyMode(next);
  await chrome.storage.local.set({ colorMode: next });
  setStatus(next === "dark" ? "Dark mode." : "Light mode.", false);
});

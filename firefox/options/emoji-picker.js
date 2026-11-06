"use strict";

// A small emoji picker for the settings page. It opens under an emoji box, can be
// searched, and also accepts an emoji chosen with the computer's own emoji menu: if
// one is inserted into the search box it is picked straight away. Browsers do not let
// a web page open the system emoji menu itself, which is why this exists.
const EmojiPicker = (function () {
  const KEYWORDS = new Map();
  for (const group of TabLabelsEmoji.GROUPS) {
    for (const [emoji, keywords] of group.items) KEYWORDS.set(emoji, keywords);
  }

  const popover = document.createElement("div");
  popover.id = "emoji-picker";
  popover.hidden = true;
  popover.tabIndex = -1; // so a click on an empty spot keeps focus inside the picker
  popover.setAttribute("role", "dialog");
  popover.setAttribute("aria-label", "Choose an emoji");

  const searchEl = document.createElement("input");
  searchEl.type = "search";
  searchEl.autocomplete = "off";
  searchEl.placeholder = "Search, or use your system emoji menu";
  searchEl.setAttribute("aria-label", "Search emoji");

  const resultsEl = document.createElement("div");
  resultsEl.className = "emoji-results";

  const hintEl = document.createElement("p");
  hintEl.className = "emoji-hint";
  hintEl.textContent = systemShortcutHint();

  popover.append(searchEl, resultsEl, hintEl);
  document.body.appendChild(popover);

  let current = null; // { input, onPick } while open
  let skipNextOpen = false;

  function systemShortcutHint() {
    const ua = navigator.userAgent;
    if (/Mac/.test(ua)) return "Your Mac's own emoji menu works here too: press Control + Command + Space.";
    if (/Windows/.test(ua)) return "Your system's own emoji menu works here too: press the Windows key + full stop.";
    return "Your system's own emoji menu also works in the search box.";
  }

  function makeOption(emoji) {
    const label = (KEYWORDS.get(emoji) || "").split(" ").slice(0, 2).join(" ");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "emoji-option";
    button.textContent = emoji;
    button.dataset.emoji = emoji;
    button.title = label;
    button.setAttribute("aria-label", label || emoji);
    return button;
  }

  function makeGrid(emojis) {
    const grid = document.createElement("div");
    grid.className = "emoji-grid";
    for (const emoji of emojis) grid.appendChild(makeOption(emoji));
    return grid;
  }

  function render(query) {
    resultsEl.textContent = "";
    const found = TabLabelsEmoji.search(query);
    if (found === null) {
      for (const group of TabLabelsEmoji.GROUPS) {
        const heading = document.createElement("h3");
        heading.textContent = group.name;
        resultsEl.append(heading, makeGrid(group.items.map((item) => item[0])));
      }
    } else if (!found.length) {
      const empty = document.createElement("p");
      empty.className = "emoji-empty";
      empty.textContent = "No emoji match that. Try another word.";
      resultsEl.appendChild(empty);
    } else {
      resultsEl.appendChild(makeGrid(found));
    }
  }

  function position(input) {
    const rect = input.getBoundingClientRect();
    const width = popover.offsetWidth;
    const maxLeft = window.scrollX + document.documentElement.clientWidth - width - 8;
    popover.style.top = window.scrollY + rect.bottom + 6 + "px";
    popover.style.left = Math.max(8, Math.min(window.scrollX + rect.left, maxLeft)) + "px";
  }

  function open(input, onPick) {
    if (current && current.input === input) return;
    current = { input, onPick };
    searchEl.value = "";
    render("");
    popover.hidden = false;
    resultsEl.scrollTop = 0;
    position(input);
    searchEl.focus();
  }

  function close() {
    popover.hidden = true;
    current = null;
  }

  // Puts focus back in the emoji box without that reopening the picker.
  function returnFocus(input) {
    if (document.activeElement === input) return;
    skipNextOpen = true;
    input.focus();
    skipNextOpen = false;
  }

  function pick(emoji) {
    const target = current;
    if (!target) return;
    close();
    target.onPick(emoji);
    returnFocus(target.input);
  }

  resultsEl.addEventListener("click", (event) => {
    const option = event.target.closest(".emoji-option");
    if (option) pick(option.dataset.emoji);
  });

  // An emoji arriving in the search box (from the system emoji menu) is picked at once.
  searchEl.addEventListener("input", () => {
    const value = searchEl.value.trim();
    if (value && TabLabels.validateLabel({ emoji: value, colour: "#000000" }).ok) {
      pick(value);
      return;
    }
    render(value);
  });

  searchEl.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    const first = searchEl.value.trim() && resultsEl.querySelector(".emoji-option");
    if (first) pick(first.dataset.emoji);
  });

  popover.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !current) return;
    event.preventDefault();
    const { input } = current;
    close();
    returnFocus(input);
  });

  popover.addEventListener("focusout", (event) => {
    const next = event.relatedTarget;
    if (!current || popover.contains(next) || next === current.input) return;
    close();
  });

  document.addEventListener("mousedown", (event) => {
    if (!current || popover.contains(event.target) || event.target === current.input) return;
    close();
  });

  function attach(input, onPick) {
    input.autocomplete = "off";
    const show = () => {
      if (!skipNextOpen) open(input, onPick);
    };
    input.addEventListener("focus", show);
    input.addEventListener("click", show);
  }

  return { attach, close };
})();

const valid = { name: "Review", emoji: "👀", colour: "#AA00FF" };
const waiting = { id: "waiting", name: "Waiting", emoji: "⏳", colour: "#d98e04" };
const ALL = { favicon: true, title: true, emoji: true };

test("defaults contain Waiting, Paused and To do with every display option on", () => {
  const s = TabLabels.defaultSettings();
  assertEqual(s.labels.map((l) => l.name), ["Waiting", "Paused", "To do"]);
  assertEqual(s.labels.map((l) => l.emoji), ["⏳", "⏸️", "✏️"]);
  assertEqual(s.display, ALL);
  assertEqual(s.containerRules, {});
});

test("defaultSettings returns a fresh copy each time", () => {
  const a = TabLabels.defaultSettings();
  a.labels[0].name = "Changed";
  a.display.favicon = false;
  assertEqual(TabLabels.defaultSettings().labels[0].name, "Waiting");
  assertEqual(TabLabels.defaultSettings().display.favicon, true);
});

test("validateLabel accepts a valid label, trims and lower-cases the colour", () => {
  const r = TabLabels.validateLabel({ name: "  Review ", emoji: " 👀 ", colour: "#AA00FF" });
  assertTrue(r.ok);
  assertEqual(r.label, { name: "Review", emoji: "👀", colour: "#aa00ff" });
});

test("validateLabel accepts an empty name", () => {
  const r = TabLabels.validateLabel({ ...valid, name: "   " });
  assertTrue(r.ok);
  assertEqual(r.label.name, "");
  assertTrue(TabLabels.validateLabel({ emoji: "👀", colour: "#aa00ff" }).ok);
});

test("validateLabel rejects a name over 30 characters", () => {
  assertTrue(!TabLabels.validateLabel({ ...valid, name: "x".repeat(31) }).ok);
  assertTrue(TabLabels.validateLabel({ ...valid, name: "x".repeat(30) }).ok);
});

test("validateLabel rejects a missing or non-emoji emoji", () => {
  assertTrue(!TabLabels.validateLabel({ ...valid, emoji: "" }).ok);
  assertTrue(!TabLabels.validateLabel({ ...valid, emoji: "abc" }).ok);
  assertTrue(!TabLabels.validateLabel({ ...valid, emoji: "👀 look" }).ok);
});

test("validateLabel accepts emoji with variation selectors", () => {
  assertTrue(TabLabels.validateLabel({ ...valid, emoji: "⏸️" }).ok);
  assertTrue(TabLabels.validateLabel({ ...valid, emoji: "✏️" }).ok);
});

test("validateLabel rejects a bad colour", () => {
  assertTrue(!TabLabels.validateLabel({ ...valid, colour: "red" }).ok);
  assertTrue(!TabLabels.validateLabel({ ...valid, colour: "#12345" }).ok);
});

test("validateLabel handles null input without throwing", () => {
  assertTrue(!TabLabels.validateLabel(null).ok);
  assertTrue(!TabLabels.validateLabel(undefined).ok);
});

test("normaliseSettings falls back to defaults for non-objects", () => {
  assertEqual(TabLabels.normaliseSettings(null), TabLabels.defaultSettings());
  assertEqual(TabLabels.normaliseSettings("x"), TabLabels.defaultSettings());
  assertEqual(TabLabels.normaliseSettings({}), TabLabels.defaultSettings());
});

test("normaliseSettings keeps an intentionally empty label list", () => {
  assertEqual(TabLabels.normaliseSettings({ labels: [] }).labels, []);
});

test("normaliseSettings drops invalid labels and duplicate ids", () => {
  const s = TabLabels.normaliseSettings({
    labels: [
      { id: "a", name: "A", emoji: "👀", colour: "#000000" },
      { id: "a", name: "Dup", emoji: "👀", colour: "#000000" },
      { id: "b", name: "B", emoji: "", colour: "#000000" },
      { name: "NoId", emoji: "👀", colour: "#000000" },
      "junk",
    ],
  });
  assertEqual(s.labels.map((l) => l.id), ["a"]);
});

test("normaliseSettings reads the three display toggles independently", () => {
  const s = TabLabels.normaliseSettings({ showFavicon: false, showTitle: true, showEmoji: false });
  assertEqual(s.display, { favicon: false, title: true, emoji: false });
});

test("normaliseSettings ignores non-boolean display values", () => {
  const s = TabLabels.normaliseSettings({ showFavicon: "no", showTitle: 0, showEmoji: null });
  assertEqual(s.display, ALL);
});

test("normaliseSettings migrates the old displayMode setting", () => {
  assertEqual(TabLabels.normaliseSettings({ displayMode: "favicon" }).display, { favicon: true, title: false, emoji: false });
  assertEqual(TabLabels.normaliseSettings({ displayMode: "title" }).display, { favicon: false, title: true, emoji: true });
  assertEqual(TabLabels.normaliseSettings({ displayMode: "both" }).display, ALL);
  assertEqual(TabLabels.normaliseSettings({ displayMode: "huge" }).display, ALL);
});

test("normaliseSettings prefers the new toggles over the old displayMode", () => {
  const s = TabLabels.normaliseSettings({ displayMode: "title", showFavicon: true, showTitle: false, showEmoji: false });
  assertEqual(s.display, { favicon: true, title: false, emoji: false });
});

test("normaliseSettings keeps valid container rules and drops the rest", () => {
  const s = TabLabels.normaliseSettings({
    containerRules: {
      "firefox-container-1": "waiting",
      "firefox-container-22": "paused",
      "firefox-default": "waiting",
      "firefox-container-x": "waiting",
      "firefox-container-3": "",
      "firefox-container-4": 7,
      "__proto__": "waiting",
    },
  });
  assertEqual(s.containerRules, { "firefox-container-1": "waiting", "firefox-container-22": "paused" });
});

test("normaliseSettings tolerates a non-object containerRules", () => {
  assertEqual(TabLabels.normaliseSettings({ containerRules: "x" }).containerRules, {});
  assertEqual(TabLabels.normaliseSettings({ containerRules: ["a"] }).containerRules, {});
});

test("ruleLabelId looks up own keys only", () => {
  const rules = { "firefox-container-1": "waiting" };
  assertEqual(TabLabels.ruleLabelId(rules, "firefox-container-1"), "waiting");
  assertEqual(TabLabels.ruleLabelId(rules, "firefox-container-2"), null);
  assertEqual(TabLabels.ruleLabelId(rules, "toString"), null);
  assertEqual(TabLabels.ruleLabelId(rules, undefined), null);
});

test("makeId slugs the name", () => {
  assertEqual(TabLabels.makeId("Needs Review!", []), "needs-review");
});

test("makeId falls back to label for names with no letters or digits", () => {
  assertEqual(TabLabels.makeId("???", []), "label");
  assertEqual(TabLabels.makeId("", []), "label");
});

test("makeId avoids existing ids", () => {
  assertEqual(TabLabels.makeId("Waiting", ["waiting"]), "waiting-2");
  assertEqual(TabLabels.makeId("Waiting", ["waiting", "waiting-2"]), "waiting-3");
});

test("findLabel returns the label or null", () => {
  const labels = TabLabels.defaultSettings().labels;
  assertEqual(TabLabels.findLabel(labels, "paused").name, "Paused");
  assertEqual(TabLabels.findLabel(labels, "gone"), null);
  assertEqual(TabLabels.findLabel(labels, undefined), null);
  assertEqual(TabLabels.findLabel(labels, ""), null);
});

test("titlePrefix combines emoji and name according to the toggles", () => {
  assertEqual(TabLabels.titlePrefix(waiting, ALL), "⏳ Waiting · ");
  assertEqual(TabLabels.titlePrefix(waiting, { favicon: false, title: true, emoji: false }), "Waiting · ");
  assertEqual(TabLabels.titlePrefix(waiting, { favicon: false, title: false, emoji: true }), "⏳ · ");
  assertEqual(TabLabels.titlePrefix(waiting, { favicon: true, title: false, emoji: false }), "");
});

test("titlePrefix for a label with no name shows just the emoji", () => {
  const label = { id: "x", name: "", emoji: "👀", colour: "#aa00ff" };
  assertEqual(TabLabels.titlePrefix(label, ALL), "👀 · ");
  assertEqual(TabLabels.titlePrefix(label, { favicon: false, title: true, emoji: false }), "");
});

test("buildTitle, isPrefixed and stripPrefix work from a prefix string", () => {
  const prefix = "⏳ Waiting · ";
  assertEqual(TabLabels.buildTitle("Inbox", prefix), "⏳ Waiting · Inbox");
  assertTrue(TabLabels.isPrefixed("⏳ Waiting · Inbox", prefix));
  assertTrue(!TabLabels.isPrefixed("Inbox", prefix));
  assertEqual(TabLabels.stripPrefix("⏳ Waiting · Inbox", prefix), "Inbox");
  assertEqual(TabLabels.stripPrefix("Inbox", prefix), "Inbox");
});

test("an empty prefix never counts as applied and changes nothing", () => {
  assertTrue(!TabLabels.isPrefixed("Inbox", ""));
  assertEqual(TabLabels.buildTitle("Inbox", ""), "Inbox");
  assertEqual(TabLabels.stripPrefix("Inbox", ""), "Inbox");
});

test("menuTitle shows the emoji and the name when there is one", () => {
  assertEqual(TabLabels.menuTitle({ name: "", emoji: "👀" }), "👀");
  assertEqual(TabLabels.menuTitle({ name: "Waiting", emoji: "⏳" }), "⏳ Waiting");
});

test("isColour accepts only #rrggbb", () => {
  assertTrue(TabLabels.isColour("#a1B2c3"));
  assertTrue(!TabLabels.isColour("red"));
  assertTrue(!TabLabels.isColour(undefined));
});

test("SETTINGS_KEYS lists every stored setting", () => {
  assertEqual(
    TabLabels.SETTINGS_KEYS,
    ["labels", "showFavicon", "showTitle", "showEmoji", "containerRules", "displayMode"]
  );
});

test("exportLabels writes a Tab Labels file without ids", () => {
  const data = JSON.parse(TabLabels.exportLabels(TabLabels.defaultSettings().labels));
  assertEqual(data.format, "tab-labels");
  assertEqual(data.version, 1);
  assertEqual(data.labels[0], { name: "Waiting", emoji: "⏳", colour: "#d98e04" });
});

test("an exported file imports back to the same labels", () => {
  const labels = TabLabels.defaultSettings().labels;
  const r = TabLabels.parseLabelsImport(TabLabels.exportLabels(labels));
  assertTrue(r.ok);
  assertEqual(r.skipped, 0);
  assertEqual(r.labels, labels.map(({ name, emoji, colour }) => ({ name, emoji, colour })));
});

test("parseLabelsImport accepts a bare array of labels", () => {
  const r = TabLabels.parseLabelsImport(JSON.stringify([valid]));
  assertTrue(r.ok);
  assertEqual(r.labels, [{ name: "Review", emoji: "👀", colour: "#aa00ff" }]);
});

test("parseLabelsImport rejects bad JSON and the wrong shape", () => {
  assertTrue(!TabLabels.parseLabelsImport("not json").ok);
  assertTrue(!TabLabels.parseLabelsImport("null").ok);
  assertTrue(!TabLabels.parseLabelsImport(JSON.stringify({ labels: [valid] })).ok);
  assertTrue(!TabLabels.parseLabelsImport(JSON.stringify({ format: "tab-labels", labels: "x" })).ok);
});

test("parseLabelsImport skips invalid entries and counts them", () => {
  const r = TabLabels.parseLabelsImport(JSON.stringify([valid, { name: "Bad", emoji: "x", colour: "red" }, 5]));
  assertTrue(r.ok);
  assertEqual(r.labels.length, 1);
  assertEqual(r.skipped, 2);
});

test("parseLabelsImport fails when nothing in the file is valid", () => {
  assertTrue(!TabLabels.parseLabelsImport(JSON.stringify([{ name: "Bad" }])).ok);
  assertTrue(!TabLabels.parseLabelsImport("[]").ok);
});

test("parseLabelsImport takes at most 100 labels", () => {
  const many = Array.from({ length: 120 }, (_, i) => ({ ...valid, name: "L" + i }));
  const r = TabLabels.parseLabelsImport(JSON.stringify(many));
  assertEqual(r.labels.length, 100);
  assertEqual(r.skipped, 20);
});

test("mergeImported adds new labels and skips ones already present", () => {
  const existing = [{ id: "a", name: "Review", emoji: "👀", colour: "#AA00FF" }];
  const imported = [
    { name: "Review", emoji: "👀", colour: "#aa00ff" },
    { name: "Later", emoji: "🕐", colour: "#112233" },
    { name: "Later", emoji: "🕐", colour: "#112233" },
  ];
  const r = TabLabels.mergeImported(existing, imported);
  assertEqual(r.added, [{ name: "Later", emoji: "🕐", colour: "#112233" }]);
  assertEqual(r.duplicates, 2);
});

test("tabs in a container never get the favicon dot", () => {
  const display = { favicon: true, title: true, emoji: false };
  assertEqual(TabLabels.displayForTab(display, "firefox-container-3"), { favicon: false, title: true, emoji: false });
});

test("tabs outside containers keep the display settings", () => {
  const display = { favicon: true, title: false, emoji: true };
  assertEqual(TabLabels.displayForTab(display, "firefox-default"), display);
  assertEqual(TabLabels.displayForTab(display, "firefox-private"), display);
  assertEqual(TabLabels.displayForTab(display, undefined), display);
});

test("displayForTab does not change the settings object it is given", () => {
  const display = { favicon: true, title: true, emoji: true };
  TabLabels.displayForTab(display, "firefox-container-1");
  assertEqual(display.favicon, true);
});

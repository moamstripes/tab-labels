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
    ["labels", "showFavicon", "showTitle", "showEmoji", "containerRules", "groupContainers", "displayMode", "colorMode"]
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

test("Enter in a label that has a label after it moves to the next one", () => {
  const rows = [{ emoji: "👀", name: "A" }, { emoji: "🎯", name: "B" }, { emoji: "", name: "" }];
  assertEqual(TabLabels.enterAction(rows, 0), "next");
  assertEqual(TabLabels.enterAction(rows, 1), "next");
});

test("Enter in the last label adds a new one when it has an emoji or a name", () => {
  assertEqual(TabLabels.enterAction([{ emoji: "👀", name: "" }], 0), "add");
  assertEqual(TabLabels.enterAction([{ emoji: "", name: "Later" }], 0), "add");
  assertEqual(TabLabels.enterAction([{ emoji: " ", name: " later " }], 0), "add");
});

test("Enter in a blank last label does nothing, so blank labels do not pile up", () => {
  assertEqual(TabLabels.enterAction([{ emoji: "", name: "" }], 0), "stay");
  assertEqual(TabLabels.enterAction([{ emoji: " ", name: "  " }], 0), "stay");
});

test("enterAction copes with an empty list or a bad index", () => {
  assertEqual(TabLabels.enterAction([], 0), "stay");
  assertEqual(TabLabels.enterAction([{ emoji: "👀", name: "A" }], 5), "stay");
});

test("refreshSummary counts refreshed and injected tabs together", () => {
  assertEqual(TabLabels.refreshSummary({ refreshed: 3, injected: 1, skipped: 0 }), "Refreshed 4 tabs.");
  assertEqual(TabLabels.refreshSummary({ refreshed: 1, injected: 0, skipped: 0 }), "Refreshed 1 tab.");
});

test("refreshSummary mentions tabs that could not be reached", () => {
  assertEqual(
    TabLabels.refreshSummary({ refreshed: 2, injected: 0, skipped: 2 }),
    "Refreshed 2 tabs. 2 could not be reached (browser pages, or tabs that have not loaded yet)."
  );
  assertEqual(
    TabLabels.refreshSummary({ refreshed: 1, injected: 0, skipped: 1 }),
    "Refreshed 1 tab. 1 could not be reached (browser pages, or tabs that have not loaded yet)."
  );
});

test("refreshSummary copes with no tabs, or none reachable", () => {
  assertEqual(TabLabels.refreshSummary({ refreshed: 0, injected: 0, skipped: 0 }), "There are no open tabs to refresh.");
  assertEqual(
    TabLabels.refreshSummary({ refreshed: 0, injected: 0, skipped: 3 }),
    "No tabs could be refreshed. 3 could not be reached (browser pages, or tabs that have not loaded yet)."
  );
  assertEqual(TabLabels.refreshSummary(null), "There are no open tabs to refresh.");
});

test("allPrefixes lists every prefix a label can put in a title", () => {
  const all = TabLabels.allPrefixes(TabLabels.defaultSettings().labels);
  assertTrue(all.includes("⏳ Waiting · "), "emoji and name");
  assertTrue(all.includes("Waiting · "), "name only");
  assertTrue(all.includes("⏳ · "), "emoji only");
  assertEqual(new Set(all).size, all.length, "no duplicates");
});

test("allPrefixes handles a label with no name and an empty list", () => {
  assertEqual(TabLabels.allPrefixes([{ id: "x", name: "", emoji: "👀", colour: "#000000" }]), ["👀 · "]);
  assertEqual(TabLabels.allPrefixes([]), []);
  assertEqual(TabLabels.allPrefixes(undefined), []);
});

test("stripAllPrefixes removes every occurrence, anywhere in the title", () => {
  const known = ["⏳ Waiting · ", "⏸️ Paused · "];
  assertEqual(TabLabels.stripAllPrefixes("(1) ⏳ Waiting · Inbox", known), "(1) Inbox");
  assertEqual(TabLabels.stripAllPrefixes("⏸️ Paused · ⏳ Waiting · Inbox", known), "Inbox");
  assertEqual(TabLabels.stripAllPrefixes("Inbox", known), "Inbox");
  assertEqual(TabLabels.stripAllPrefixes("Inbox", []), "Inbox");
  assertEqual(TabLabels.stripAllPrefixes("Inbox", ["", null]), "Inbox");
});

test("normaliseTitle leaves exactly one prefix, at the front", () => {
  const known = TabLabels.allPrefixes(TabLabels.defaultSettings().labels);
  const waiting = "⏳ Waiting · ";
  assertEqual(TabLabels.normaliseTitle("Inbox", waiting, known), waiting + "Inbox");
  assertEqual(TabLabels.normaliseTitle(waiting + "Inbox", waiting, known), waiting + "Inbox");
  assertEqual(TabLabels.normaliseTitle("(1) " + waiting + "Inbox", waiting, known), waiting + "(1) Inbox");
  assertEqual(TabLabels.normaliseTitle(waiting + "(1) " + waiting + "Inbox", waiting, known), waiting + "(1) Inbox");
});

test("normaliseTitle replaces another label's prefix and can remove the label entirely", () => {
  const known = TabLabels.allPrefixes(TabLabels.defaultSettings().labels);
  assertEqual(TabLabels.normaliseTitle("⏸️ Paused · (2) Inbox", "⏳ Waiting · ", known), "⏳ Waiting · (2) Inbox");
  assertEqual(TabLabels.normaliseTitle("⏳ Waiting · (2) Inbox", "", known), "(2) Inbox");
});

test("the colour mode follows the system until the user picks light or dark", () => {
  assertEqual(TabLabels.defaultSettings().colorMode, "system");
  assertEqual(TabLabels.normaliseSettings({}).colorMode, "system");
  assertEqual(TabLabels.normaliseSettings({ colorMode: "light" }).colorMode, "light");
  assertEqual(TabLabels.normaliseSettings({ colorMode: "dark" }).colorMode, "dark");
});

test("any other colour mode value falls back to the system setting", () => {
  for (const value of ["Dark", "auto", "", 1, true, null, {}]) {
    assertEqual(TabLabels.normaliseSettings({ colorMode: value }).colorMode, "system");
  }
});

test("grouping is off for every container by default, and only an exact true switches a container on", () => {
  assertEqual(TabLabels.defaultSettings().groupContainers, {});
  assertEqual(TabLabels.normaliseSettings({}).groupContainers, {});
  assertEqual(TabLabels.normaliseSettings({ groupContainers: { "firefox-container-1": true } }).groupContainers, { "firefox-container-1": true });
  for (const value of ["yes", 1, "true", null, false, {}, []]) {
    assertEqual(TabLabels.normaliseSettings({ groupContainers: { "firefox-container-1": value } }).groupContainers, {});
  }
});

test("normaliseSettings keeps only real container ids in groupContainers and tolerates other shapes", () => {
  const raw = { groupContainers: { "firefox-container-2": true, "firefox-default": true, nonsense: true } };
  assertEqual(TabLabels.normaliseSettings(raw).groupContainers, { "firefox-container-2": true });
  for (const value of [null, "x", 5, [], true]) {
    assertEqual(TabLabels.normaliseSettings({ groupContainers: value }).groupContainers, {});
  }
});

test("the old global groupByContainer setting no longer does anything", () => {
  assertEqual(TabLabels.normaliseSettings({ groupByContainer: true }).groupContainers, {});
  assertEqual("groupByContainer" in TabLabels.normaliseSettings({ groupByContainer: true }), false);
});

test("groupTitle is the label name, or the emoji when the name is empty", () => {
  assertEqual(TabLabels.groupTitle({ name: "Waiting", emoji: "⏳" }), "Waiting");
  assertEqual(TabLabels.groupTitle({ name: "", emoji: "⏳" }), "⏳");
});

function groupSettings(extra) {
  return Object.assign(
    {
      labels: [
        { id: "waiting", name: "Waiting", emoji: "⏳", colour: "#d98e04" },
        { id: "quiet", name: "", emoji: "🔕", colour: "#4a7fd4" },
      ],
      containerRules: { "firefox-container-1": "waiting", "firefox-container-2": "quiet" },
      groupContainers: { "firefox-container-1": true, "firefox-container-2": true },
    },
    extra
  );
}

function tabIn(id, container, extra) {
  return Object.assign({ id, windowId: 1, cookieStoreId: container, pinned: false, groupId: -1 }, extra);
}

test("planContainerGroups does nothing for containers that are not switched on", () => {
  const tabs = [tabIn(1, "firefox-container-1"), tabIn(2, "firefox-container-2")];
  assertEqual(TabLabels.planContainerGroups(tabs, {}, groupSettings({ groupContainers: {} })), []);
  const plan = TabLabels.planContainerGroups(tabs, {}, groupSettings({ groupContainers: { "firefox-container-2": true } }));
  assertEqual(plan.map((p) => p.cookieStoreId), ["firefox-container-2"]);
});

test("planContainerGroups does nothing for a switched-on container that has no label", () => {
  const tabs = [tabIn(1, "firefox-container-3")];
  const settings = groupSettings({ groupContainers: { "firefox-container-3": true } });
  assertEqual(TabLabels.planContainerGroups(tabs, {}, settings), []);
});

test("planContainerGroups makes one new group per switched-on container that has a label, named after it", () => {
  const tabs = [
    tabIn(1, "firefox-container-1"),
    tabIn(2, "firefox-container-1"),
    tabIn(3, "firefox-container-2"),
    tabIn(4, "firefox-default"),
    tabIn(5, "firefox-container-9"),
  ];
  assertEqual(TabLabels.planContainerGroups(tabs, {}, groupSettings()), [
    { windowId: 1, cookieStoreId: "firefox-container-1", title: "Waiting", groupId: null, tabIds: [1, 2], retitle: false },
    { windowId: 1, cookieStoreId: "firefox-container-2", title: "🔕", groupId: null, tabIds: [3], retitle: false },
  ]);
});

test("planContainerGroups keeps windows apart", () => {
  const tabs = [tabIn(1, "firefox-container-1"), tabIn(2, "firefox-container-1", { windowId: 2 })];
  const plan = TabLabels.planContainerGroups(tabs, {}, groupSettings());
  assertEqual(plan.map((p) => [p.windowId, p.tabIds]), [[1, [1]], [2, [2]]]);
});

test("planContainerGroups leaves pinned tabs, tabs already in a group and the user's own groups alone", () => {
  const tabs = [
    tabIn(1, "firefox-container-1", { pinned: true }),
    tabIn(2, "firefox-container-1", { groupId: 7 }),
    tabIn(3, "firefox-container-1"),
  ];
  const plan = TabLabels.planContainerGroups(tabs, { 7: "My own group" }, groupSettings());
  assertEqual(plan, [{ windowId: 1, cookieStoreId: "firefox-container-1", title: "Waiting", groupId: null, tabIds: [3], retitle: false }]);
});

test("planContainerGroups adds new tabs to the container's existing group", () => {
  const tabs = [tabIn(1, "firefox-container-1", { groupId: 7 }), tabIn(2, "firefox-container-1")];
  assertEqual(TabLabels.planContainerGroups(tabs, { 7: "Waiting" }, groupSettings()), [
    { windowId: 1, cookieStoreId: "firefox-container-1", title: "Waiting", groupId: 7, tabIds: [2], retitle: false },
  ]);
});

test("planContainerGroups renames a group this extension made for that container", () => {
  const tabs = [tabIn(1, "firefox-container-1", { groupId: 7 })];
  assertEqual(TabLabels.planContainerGroups(tabs, { 7: "Old name" }, groupSettings(), { ownedGroups: [7] }), [
    { windowId: 1, cookieStoreId: "firefox-container-1", title: "Waiting", groupId: 7, tabIds: [], retitle: true },
  ]);
});

test("planContainerGroups never renames or joins a group that holds other containers' tabs", () => {
  const tabs = [
    tabIn(1, "firefox-container-1", { groupId: 7 }),
    tabIn(2, "firefox-container-2", { groupId: 7 }),
    tabIn(3, "firefox-container-1"),
  ];
  const plan = TabLabels.planContainerGroups(tabs, { 7: "Mixed" }, groupSettings(), { ownedGroups: [7] });
  assertEqual(plan, [{ windowId: 1, cookieStoreId: "firefox-container-1", title: "Waiting", groupId: null, tabIds: [3], retitle: false }]);
});

test("planContainerGroups can be limited to some containers, or to renaming only", () => {
  const tabs = [tabIn(1, "firefox-container-1"), tabIn(2, "firefox-container-2"), tabIn(3, "firefox-container-2", { groupId: 8 })];
  const only = TabLabels.planContainerGroups(tabs, { 8: "x" }, groupSettings(), { containers: ["firefox-container-1"] });
  assertEqual(only.map((p) => p.cookieStoreId), ["firefox-container-1"]);
  const renameOnly = TabLabels.planContainerGroups(tabs, { 8: "x" }, groupSettings(), { regroup: false, ownedGroups: [8] });
  assertEqual(renameOnly, [{ windowId: 1, cookieStoreId: "firefox-container-2", title: "🔕", groupId: 8, tabIds: [], retitle: true }]);
});

test("planContainerGroups skips containers with no rule, or a rule whose label is gone", () => {
  const tabs = [tabIn(1, "firefox-container-1"), tabIn(2, "firefox-container-3")];
  const settings = groupSettings({ containerRules: { "firefox-container-1": "deleted" } });
  assertEqual(TabLabels.planContainerGroups(tabs, {}, settings), []);
});

test("planContainerGroups adopts a group named like the label, for example one restored after a restart", () => {
  const tabs = [tabIn(1, "firefox-container-1", { groupId: 7 }), tabIn(2, "firefox-container-1")];
  const plan = TabLabels.planContainerGroups(tabs, { 7: "Waiting" }, groupSettings(), { ownedGroups: [] });
  assertEqual(plan.map((p) => [p.groupId, p.tabIds, p.retitle]), [[7, [2], false]]);
});

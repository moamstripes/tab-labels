test("emoji picker has several named sections", () => {
  const names = TabLabelsEmoji.GROUPS.map((g) => g.name);
  assertTrue(names.length >= 6, "expected at least 6 sections, got " + names.length);
  assertTrue(names.every((n) => n.trim() !== ""), "a section has no name");
  assertEqual(new Set(names).size, names.length, "section names must be unique");
});

test("every emoji in the picker is accepted as a label emoji", () => {
  const bad = [];
  for (const g of TabLabelsEmoji.GROUPS) {
    for (const [emoji] of g.items) {
      if (!TabLabels.validateLabel({ name: "", emoji, colour: "#000000" }).ok) bad.push(emoji);
    }
  }
  assertEqual(bad, []);
});

test("every emoji in the picker has search keywords and appears once", () => {
  const seen = new Set();
  for (const g of TabLabelsEmoji.GROUPS) {
    assertTrue(g.items.length > 0, g.name + " is empty");
    for (const [emoji, keywords] of g.items) {
      assertTrue(typeof keywords === "string" && keywords.trim() !== "", emoji + " has no keywords");
      assertTrue(!seen.has(emoji), emoji + " is listed twice");
      seen.add(emoji);
    }
  }
});

test("the default label emoji are in the picker", () => {
  const all = TabLabelsEmoji.GROUPS.flatMap((g) => g.items.map((i) => i[0]));
  for (const l of TabLabels.defaultSettings().labels) assertTrue(all.includes(l.emoji), l.emoji + " missing");
});

test("an empty search means show everything", () => {
  assertEqual(TabLabelsEmoji.search(""), null);
  assertEqual(TabLabelsEmoji.search("   "), null);
  assertEqual(TabLabelsEmoji.search(undefined), null);
});

test("search matches keywords, ignoring case", () => {
  assertTrue(TabLabelsEmoji.search("wait").includes("\u23f3"));
  assertTrue(TabLabelsEmoji.search("PAUSE").includes("\u23f8\ufe0f"));
});

test("search needs every word to match", () => {
  const r = TabLabelsEmoji.search("hourglass done");
  assertTrue(r.includes("\u231b"), "hourglass done should find the finished hourglass");
  assertTrue(!r.includes("\u23f3"), "the waiting hourglass should not match 'done'");
});

test("search with no matches returns an empty list", () => {
  assertEqual(TabLabelsEmoji.search("zzzzzzzz"), []);
});

const manifest = JSON.parse(readFile("manifest.json"));

test("manifest is Manifest V3 with the required permissions", () => {
  assertEqual(manifest.manifest_version, 3);
  for (const p of ["menus", "tabs", "storage", "sessions", "contextualIdentities", "cookies", "scripting"]) {
    assertTrue(manifest.permissions.includes(p), "missing permission " + p);
  }
  assertTrue(manifest.host_permissions.includes("<all_urls>"), "missing host permission");
});

test("manifest references only files that exist", () => {
  const files = []
    .concat(manifest.background.scripts)
    .concat(...manifest.content_scripts.map((c) => c.js))
    .concat(manifest.options_ui.page)
    .concat(Object.values(manifest.icons));
  for (const f of files) assertTrue(fileExists(f), "missing file " + f);
});

test("shared logic is loaded before the scripts that use it", () => {
  assertEqual(manifest.background.scripts[0], "lib/labels.js");
  assertEqual(manifest.content_scripts[0].js[0], "lib/labels.js");
});

test("settings page loads the emoji picker scripts in order, and they exist", () => {
  const html = readFile("options/options.html");
  const scripts = ["../lib/labels.js", "../lib/emoji.js", "emoji-picker.js", "options.js"];
  let last = -1;
  for (const s of scripts) {
    const at = html.indexOf('src="' + s + '"');
    assertTrue(at > last, s + " is missing or out of order in options.html");
    last = at;
  }
  assertTrue(fileExists("lib/emoji.js") && fileExists("options/emoji-picker.js"), "picker files missing");
});

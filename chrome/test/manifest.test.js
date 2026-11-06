const manifest = JSON.parse(readFile("manifest.json"));

test("manifest is Manifest V3 with a service worker and the required permissions", () => {
  assertEqual(manifest.manifest_version, 3);
  assertEqual(manifest.background.service_worker, "background.js");
  for (const p of ["contextMenus", "storage"]) {
    assertTrue(manifest.permissions.includes(p), "missing permission " + p);
  }
  assertTrue(manifest.host_permissions.includes("<all_urls>"), "missing host permission");
});

test("manifest has no Firefox-only keys", () => {
  assertTrue(manifest.browser_specific_settings === undefined, "browser_specific_settings is Firefox only");
  for (const p of ["menus", "sessions", "contextualIdentities", "cookies"]) {
    assertTrue(!manifest.permissions.includes(p), "Firefox-only permission " + p);
  }
});

test("manifest references only files that exist", () => {
  const files = [manifest.background.service_worker]
    .concat(...manifest.content_scripts.map((c) => c.js))
    .concat(manifest.options_ui.page)
    .concat(Object.values(manifest.icons))
    .concat(Object.values(manifest.action.default_icon));
  for (const f of files) assertTrue(fileExists(f), "missing file " + f);
});

test("extension icons are PNG, which is what Chrome requires", () => {
  for (const f of Object.values(manifest.icons)) assertTrue(f.endsWith(".png"), f + " is not a PNG");
});

test("shared logic is loaded before the scripts that use it", () => {
  assertEqual(manifest.content_scripts[0].js[0], "lib/labels.js");
  assertTrue(readFile("background.js").includes('importScripts("lib/labels.js")'), "service worker must import lib/labels.js");
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

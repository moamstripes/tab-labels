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

test("settings page has a favicon that points at a real file", () => {
  const html = readFile("options/options.html");
  const match = html.match(/<link[^>]*rel="icon"[^>]*href="([^"]+)"/);
  assertTrue(!!match, "options.html has no <link rel=\"icon\">");
  assertTrue(fileExists("options/" + match[1]), "favicon file missing: " + match[1]);
});

test("settings page: switches and Refresh are in a sidebar, labels are in the main column", () => {
  const html = readFile("options/options.html");
  const start = html.indexOf("<aside");
  const end = html.indexOf("</aside>");
  assertTrue(start >= 0 && end > start, "there is no sidebar");
  const aside = html.slice(start, end);
  for (const key of ["showFavicon", "showTitle", "showEmoji"]) {
    assertTrue(aside.includes('data-key="' + key + '"'), key + " is not in the sidebar");
  }
  assertTrue(aside.includes('id="refresh-tabs"'), "the Refresh button is not in the sidebar");
  assertTrue(html.indexOf('id="rows"') > end, "the label list must be in the main column, not the sidebar");
});

test("settings page: import, export and reset are icon buttons with names, at the top of the Labels card", () => {
  const html = readFile("options/options.html");
  const head = html.slice(html.indexOf('class="card-head"'), html.indexOf('id="rows"'));
  assertTrue(head.includes("<h2>Labels</h2>"), "the buttons must sit in the Labels card header");
  for (const id of ["import", "export", "reset"]) {
    const m = head.match(new RegExp('<button id="' + id + '"[^>]*>'));
    assertTrue(!!m, id + " button is not in the Labels card header");
    assertTrue(/aria-label="[^"]+"/.test(m[0]) && /title="[^"]+"/.test(m[0]), id + " needs a title and an aria-label");
  }
});

test("settings page (Firefox): Containers come after Labels", () => {
  const html = readFile("options/options.html");
  assertTrue(html.indexOf('id="containers"') > html.indexOf('id="rows"'), "Containers must be below Labels");
});

test("settings page has the 'Take me to space' toggle in the sidebar, with the decoration hidden from screen readers", () => {
  const html = readFile("options/options.html");
  const aside = html.slice(html.indexOf("<aside"), html.indexOf("</aside>"));
  assertTrue(aside.includes('id="space-toggle"'), "the toggle is not in the sidebar");
  assertTrue(aside.includes("Take me to space"), "the toggle text is missing");
  assertTrue(/<span aria-hidden="true">[^<]*✧<\/span>/.test(aside), "the decorative symbols must be aria-hidden");
});

test("the space theme's background picture exists and the stylesheet uses it", () => {
  assertTrue(fileExists("options/space.svg"), "options/space.svg is missing");
  const css = readFile("options/options.css");
  assertTrue(css.includes('url("space.svg")') && css.includes(":root[data-space]"), "the stylesheet does not use space.svg");
  const svg = readFile("options/space.svg");
  assertTrue(svg.includes("<svg") && !svg.includes("<script"), "space.svg must be a plain picture with no script");
});

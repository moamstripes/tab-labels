const manifest = JSON.parse(readFile("manifest.json"));

test("manifest is Manifest V3 with a service worker and the required permissions", () => {
  assertEqual(manifest.manifest_version, 3);
  assertEqual(manifest.background.service_worker, "background.js");
  for (const p of ["contextMenus", "storage", "scripting"]) {
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


test("the space theme's background picture exists and the stylesheet uses it", () => {
  assertTrue(fileExists("options/space.svg"), "options/space.svg is missing");
  const css = readFile("options/options.css");
  assertTrue(css.includes('url("space.svg")') && css.includes(":root[data-space]"), "the stylesheet does not use space.svg");
  const svg = readFile("options/space.svg");
  assertTrue(svg.includes("<svg") && !svg.includes("<script"), "space.svg must be a plain picture with no script");
});

test("settings page: the sun/moon button and the space button are at the top right, the space button under the sun/moon", () => {
  const html = readFile("options/options.html");
  const header = html.slice(html.indexOf('<header class="page-header">'), html.indexOf("</header>"));
  const controls = header.slice(header.indexOf('class="page-controls"'));
  const mode = controls.indexOf('id="mode-button"');
  const space = controls.indexOf('id="space-button"');
  assertTrue(mode >= 0 && space > mode, "the sun/moon button must come first, then the space button");
  const button = controls.slice(space, controls.indexOf("</button>", space));
  assertTrue(button.includes("Take me to space") && button.includes("Land back"), "the space button needs both texts");
  assertTrue(button.includes("(\ufe36\ufe39\ufe3a)"), "the 'Land back' face is missing");
  assertTrue(!button.includes("<small"), "the space button has no description");
  assertTrue(/<span aria-hidden="true">[^<]*\u2727<\/span>/.test(button) && /<span aria-hidden="true">\([^<]*\)<\/span>/.test(button), "the decorative symbols must be aria-hidden");
  const aside = html.slice(html.indexOf("<aside"), html.indexOf("</aside>"));
  assertTrue(!aside.includes("space") && !aside.includes("Space"), "nothing about space belongs in the sidebar any more");
});

test("settings page: the sun/moon button has both icons and a name", () => {
  const html = readFile("options/options.html");
  const m = html.match(/<button id="mode-button"[^>]*>/);
  assertTrue(!!m && /aria-label="[^"]+"/.test(m[0]) && /title="[^"]+"/.test(m[0]), "the button needs a title and an aria-label");
  const body = html.slice(html.indexOf('id="mode-button"'), html.indexOf("</button>", html.indexOf('id="mode-button"')));
  assertTrue(body.includes("icon-moon") && body.includes("icon-sun"), "both the sun and the moon icons must be there");
});

test("settings page: a light and a dark choice exist in the stylesheet, next to the automatic one", () => {
  const css = readFile("options/options.css");
  assertTrue(css.includes(':root[data-theme="dark"]') && css.includes(':root[data-theme="light"]'), "manual light and dark are missing");
  assertTrue(css.includes(':root:not([data-theme="light"])'), "the automatic dark colours must give way to an explicit light choice");
});

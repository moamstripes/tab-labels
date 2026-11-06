// Test runner for macOS's built-in JavaScript engine.
// Run from the project root: osascript -l JavaScript test/run.js
ObjC.import("Foundation");

const fm = $.NSFileManager.defaultManager;

function readFile(path) {
  const s = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, $());
  if (s.isNil()) throw new Error("Cannot read " + path);
  return ObjC.unwrap(s);
}

function fileExists(path) {
  return fm.fileExistsAtPath($(path));
}

const results = [];

globalThis.readFile = readFile;
globalThis.fileExists = fileExists;
globalThis.test = function (name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (e) {
    results.push({ name, ok: false, error: String(e && e.message ? e.message : e) });
  }
};
globalThis.assertTrue = function (value, message) {
  if (!value) throw new Error(message || "Expected a truthy value");
};
globalThis.assertEqual = function (actual, expected, message) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error((message ? message + ": " : "") + "expected " + e + " but got " + a);
};

(0, eval)(readFile("lib/labels.js"));
(0, eval)(readFile("lib/emoji.js"));

const files = ObjC.deepUnwrap(fm.contentsOfDirectoryAtPathError($("test"), $()))
  .filter((f) => f.endsWith(".test.js"))
  .sort();

for (const f of files) {
  (0, eval)(readFile("test/" + f));
}

const failed = results.filter((r) => !r.ok);
for (const r of results) {
  console.log((r.ok ? "PASS  " : "FAIL  ") + r.name + (r.ok ? "" : "\n      " + r.error));
}
console.log("\n" + (results.length - failed.length) + " passed, " + failed.length + " failed");
if (failed.length) throw new Error(failed.length + " test(s) failed");

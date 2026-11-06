#!/usr/bin/env bash
# Builds the installable package for one browser: dist/tab-labels-<browser>-<version>.zip
# Only the files the extension needs at runtime are included (no tests, docs or README).
#
# Usage: scripts/build.sh firefox|chrome
# Prints the path of the zip on its last line. Also leaves the staged files in dist/<browser>/.
set -euo pipefail

browser="${1:-}"
case "$browser" in
  firefox | chrome) ;;
  *)
    echo "usage: $0 firefox|chrome" >&2
    exit 1
    ;;
esac

root="$(cd "$(dirname "$0")/.." && pwd)"
src="$root/$browser"
version="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['version'])" "$src/manifest.json")"
stage="$root/dist/$browser"
out="$root/dist/tab-labels-$browser-$version.zip"

rm -rf "$stage" "$out"
mkdir -p "$stage"
for item in manifest.json background.js content.js lib options icons; do
  cp -R "$src/$item" "$stage/$item"
done
find "$stage" -name ".DS_Store" -delete

(cd "$stage" && zip -r -q -X "$out" .)
echo "$out"

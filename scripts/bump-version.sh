#!/usr/bin/env bash
# Sets the version in one browser's manifest.json and prints the commands that release it.
# It changes one file and nothing else: it does not commit, tag or push.
#
# Usage: scripts/bump-version.sh firefox|chrome 1.2.0
set -euo pipefail

browser="${1:-}"
version="${2:-}"
case "$browser" in
  firefox | chrome) ;;
  *)
    echo "usage: $0 firefox|chrome X.Y.Z" >&2
    exit 1
    ;;
esac
if ! [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "version must look like 1.2.3, got: '$version'" >&2
  exit 1
fi

root="$(cd "$(dirname "$0")/.." && pwd)"
manifest="$root/$browser/manifest.json"

python3 - "$manifest" "$version" <<'PY'
import re, sys

path, version = sys.argv[1], sys.argv[2]
text = open(path).read()
new, count = re.subn(r'("version"\s*:\s*")[^"]+(")', r"\g<1>" + version + r"\2", text, count=1)
if count != 1:
    sys.exit("no version field found in " + path)
open(path, "w").write(new)
PY

echo "Set $browser version to $version in $browser/manifest.json."
echo
echo "To release it:"
echo "  git add $browser/manifest.json"
echo "  git commit -m \"Release $browser $version\""
echo "  git tag $browser-v$version"
echo "  git push && git push origin $browser-v$version"

# Tab Labels

Tag browser tabs with coloured labels such as ⏳ Waiting, ⏸️ Paused or ✏️ To do. A label shows as a coloured dot on the tab icon, as a name and/or emoji in front of the tab title, or both. Everything stays in your browser: nothing is sent anywhere.

There are two extensions here, one per browser. They share the same name, settings page and label logic, but each is its own project with its own version.

| Folder | Browser | Notes |
| --- | --- | --- |
| [`firefox/`](firefox/) | Firefox 140 or newer | Right-click a tab to label it. Container rules. Labels survive restarts. |
| [`chrome/`](chrome/) | Chrome 110 or newer | Labels sit on the page and toolbar icon right-click menus. No containers. Labels are lost when Chrome quits. |

Each folder has its own README with install steps, usage and a manual test checklist.

The Firefox add-on is registered on addons.mozilla.org as a private (unlisted) add-on. Its developer page, where versions are uploaded and signed, is <https://addons.mozilla.org/en-US/developers/addon/fdb422307dd04e4c91e8/> (needs the Mozilla account that owns it).

## Website

`docs/` is a one-page website for the Firefox extension (what it does, screenshots, privacy, permissions, how to install). It is plain HTML with no scripts or trackers, and GitHub Pages serves it from `main` and `/docs` once the repository is public: `https://moamstripes.github.io/tab-labels/`. Use that address as the add-on's homepage in the details on addons.mozilla.org. The screenshots are in `docs/assets/`; retake them when the settings page changes.

## Installing a release

Releases are on the repository's **Releases** page. Tags are per browser, so each release is for one browser.

- **Firefox:** download the signed `.xpi` (when the release has one) and open it in Firefox. Otherwise download the zip and follow the Firefox README.
- **Chrome:** download the zip and unzip it. In `chrome://extensions` switch on Developer mode, click **Load unpacked** and choose the unzipped folder.

## Working on it

The unit tests need no installs on a Mac. They use the JavaScript engine built into macOS:

```
cd firefox && osascript -l JavaScript test/run.js
cd chrome  && osascript -l JavaScript test/run.js
```

To build the package a release would contain:

```
bash scripts/build.sh firefox     # or chrome
```

This writes `dist/tab-labels-<browser>-<version>.zip` with only the files the extension needs at run time.

The label logic in `lib/labels.js` exists once per browser. The Chrome copy has the container features removed. A change to shared behaviour needs making in both.

## Releasing

Each browser is released on its own by pushing a tag named `<browser>-v<version>`.

1. Set the version, for example `bash scripts/bump-version.sh firefox 1.2.0`. This edits `firefox/manifest.json` only.
2. Run the commands the script prints: commit, tag (`firefox-v1.2.0`), and push the commit and the tag.
3. GitHub Actions does the rest (see below).

The number in the tag has to match `version` in that browser's `manifest.json`. If it does not, the release stops with an error before anything is published.

### What the workflows do

- **CI** (`.github/workflows/ci.yml`): on every push to `main` and every pull request, runs the unit tests and builds the package for both browsers.
- **Release** (`.github/workflows/release.yml`): on a `firefox-v*` or `chrome-v*` tag, checks the version, runs that browser's tests, builds the zip, and creates a GitHub release with the zip attached and notes generated from the commits.

Both workflows run on macOS runners because the tests use the macOS JavaScript engine. (macOS minutes are free for public repositories; for a private one they cost more than Linux minutes.)

### Signing the Firefox release (one-time setup)

Firefox only keeps add-ons that Mozilla has signed. The add-on's developer page is <https://addons.mozilla.org/en-US/developers/addon/fdb422307dd04e4c91e8/>.

To have the release workflow sign it as a private (unlisted) add-on and attach the `.xpi`:

1. Create API credentials at <https://addons.mozilla.org/developers/addon/api/key/>.
2. Store them as two repository secrets, `AMO_JWT_ISSUER` (the JWT issuer) and `AMO_JWT_SECRET` (the JWT secret). From a terminal, `gh secret set AMO_JWT_ISSUER --repo moamstripes/tab-labels` and then the same for `AMO_JWT_SECRET`; each command asks for the value and hides it as you paste. Or use Settings, Secrets and variables, Actions on GitHub. Do not paste the values into chat, issues or files.
3. Check they are there with `gh secret list --repo moamstripes/tab-labels` (it lists names only).

Without these secrets the Firefox release still happens, just with the zip and no `.xpi`. Mozilla rejects a version number it has already signed, so each Firefox release needs a new version.

To sign a version that was released earlier without a signed file, run the workflow by hand for its tag: `gh workflow run release.yml -f tag=firefox-v1.2.0`. It rebuilds the zip, signs it, and adds the files to the existing release.

### Not automated

Publishing to the Chrome Web Store is not part of the workflows. It needs a Chrome Web Store developer account and its own credentials. The Chrome release is the zip for loading unpacked.

## Licence

MIT. See [LICENSE](LICENSE).

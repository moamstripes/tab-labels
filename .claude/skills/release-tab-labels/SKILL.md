---
name: release-tab-labels
description: Use whenever the Tab Labels extension gets a new version number (Firefox or Chrome), or the user asks to release, publish or ship it. Commits and pushes the work to GitHub under the nickname identity, then creates a GitHub release with a downloadable zip for each browser.
---

# Release Tab Labels

Standing instruction from the user: **when a version of the extension is updated, push it to GitHub and create a release for it.** That is already approved for this repository (`moamstripes/tab-labels`, private), so do not ask again for the push, the tags or the releases. Anything else outward-facing (publishing to the Chrome Web Store, listing on addons.mozilla.org, changing repository visibility) still needs asking.

Work from `~/Documents/tab-labels`. Both browsers are normally released together, because updates are made to both.

## Steps

1. **Check the ground.**
   - `git status` and `git log -3`. Anything uncommitted that belongs to this release is committed in step 4.
   - `gh auth status`. If not logged in, ask the user to run `! gh auth login`.
   - The commit identity must be the repo-local one: `git config --local user.name` is `moamstripes` and `git config --local user.email` is the GitHub noreply address. If either is missing, set them (the number in the email is `gh api user --jq .id`). Never commit with the global identity or the work email, and never put the user's full name in a file or commit message.

2. **Choose the version.** Semantic versioning: patch for fixes, minor for new features, major for anything that breaks stored settings. Both browsers get the same number unless a change really affects only one. The number must be new: `git tag -l`, `gh release list`. Mozilla refuses a Firefox version it has already signed.

3. **Test.** `cd firefox && osascript -l JavaScript test/run.js` and the same in `chrome/`. Stop if anything fails. If the change touches browser behaviour, run the real-browser checks described in `CLAUDE.md` first. Say plainly what was and was not tested in a real browser.

4. **Commit the work**, before the version bump, in its own commit with a message that says what changed and why. End the message with the co-author line from the session's attribution instructions.

5. **Bump and commit the version.**
   - `bash scripts/bump-version.sh firefox X.Y.Z` and `bash scripts/bump-version.sh chrome X.Y.Z`
   - Commit only the two manifests as `Release X.Y.Z`.

6. **Push and tag.**
   - `git push`
   - `git tag firefox-vX.Y.Z` and `git tag chrome-vX.Y.Z`, then `git push origin firefox-vX.Y.Z chrome-vX.Y.Z`
   - Pushing a tag starts `.github/workflows/release.yml`, which checks the manifest version against the tag, runs that browser's tests, builds `tab-labels-<browser>-<version>.zip` and creates the GitHub release. There is one run per tag.

7. **Watch it.** `gh run list --limit 5`, then `gh run watch <id> --exit-status` for each Release run.

8. **Verify the releases.** For each tag: `gh release view <tag> --json url,assets`. Download the zip into the scratchpad, check `unzip -p <zip> manifest.json` shows the right version, and that the zip holds only runtime files (no `test/`, `docs/`, README).

9. **Report** both release links and the zip names. For Firefox, say whether a signed `.xpi` is attached. It is only added when the repository has the secrets `AMO_JWT_ISSUER` and `AMO_JWT_SECRET` (check names with `gh secret list`, never values). If a Firefox release is missing its `.xpi`, `gh workflow run release.yml -f tag=firefox-vX.Y.Z` signs that tag and adds the file to the existing release.

## When something goes wrong

- **Workflow fails before a release exists** (for example the version check): fix the cause in a new commit, then ask before deleting and re-pushing the tag.
- **A release was published with a problem:** fix forward with the next patch version. Do not delete or move a published tag or release without asking.
- **Tests fail:** do not tag. Fix first.
- Never print tokens or secrets.

## Not covered

Chrome Web Store uploads and Firefox listed (public) submissions are separate, manual routes and are not part of this skill.

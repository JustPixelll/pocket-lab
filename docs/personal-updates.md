# Personal updates

Pocket Korean can publish permanent-key APKs to the public
[Releases page](https://github.com/JustPixelll/pocket-lab/releases). Once the owner
configures signing, a successful trusted `main` build produces the next release.
The phone can check for a newer release, open its APK in the browser, and use
Android's normal installation screen. No GitHub login or token is needed on the
phone.

**The owner setup below still has to be run. Adding this code does not generate a
key, configure GitHub secrets, or convert an installed prototype into a personal
build.** Disposable prototypes, including v0.1.7 and any v0.1.8 built before owner
setup, use temporary signing keys. The installed v0.1.7 key is no longer available.
There is one final backup/migration when moving to the permanent key.

## One-time owner setup

Use your own PC, or a Codespace from which you can save a private backup outside
the Codespace. You need Python 3.9 or later, a JDK with `keytool` (JDK 17 works),
and the [GitHub CLI](https://cli.github.com/). Run the helper from this repository's
checkout, using GitHub account **JustPixelll** with repository administration
access.

1. Authenticate GitHub CLI on your computer, if needed:

   ```sh
   gh auth login --hostname github.com --git-protocol https --web
   ```

2. Run the helper with a **new, dedicated private backup directory outside the
   checkout**. On macOS or Linux:

   ```sh
   python3 scripts/setup-personal-updates.py --backup-dir "$HOME/Pocket-Korean-signing-backup"
   ```

   On Windows PowerShell:

   ```powershell
   py -3 scripts/setup-personal-updates.py --backup-dir "$env:USERPROFILE\Pocket-Korean-signing-backup"
   ```

3. Enter a strong keystore password when the terminal asks. Keep it in your
   password manager. The helper uses the same password for the store and key,
   and does not print or save the password.
4. The helper creates the keystore and a small identity record in the directory
   you chose. **Copy that directory to durable private storage you control** and
   save the password before confirming `BACKED UP`. In a Codespace, download the
   backup outside the Codespace before continuing. Losing both your signing key
   and its backup prevents future updates under that identity.
5. The helper uploads four encrypted repository Actions secrets and records one
   public fingerprint variable. It stops on any failure, retains your local key,
   and does not build or publish an app.
6. In GitHub, open **Actions → Build Pocket Korean → Run workflow**, select
   **main**, and run it. After tests, compilation, lint, and signature/version
   checks pass, the workflow publishes the first personal release.

The helper creates a JKS keystore with an RSA 3072-bit key, alias
`pocket-korean-personal`, and a certificate valid for 10,000 days. Passwords reach
`keytool` through its documented environment-variable option. Secret values reach
`gh secret set` through standard input and are encrypted by GitHub CLI before
upload; they are not placed in command arguments or temporary Base64 files.
The private directory/files use restrictive permissions on POSIX systems.

### Codespaces authentication

A Codespace's default `GITHUB_TOKEN` can have insufficient permission to manage
Actions secrets even when ordinary repository operations work. Environment
tokens also take precedence over GitHub CLI's saved login. If that blocks setup,
use an owner login without those environment-token overrides for these commands:

```sh
env -u GH_TOKEN -u GITHUB_TOKEN gh auth login --hostname github.com --git-protocol https --web
env -u GH_TOKEN -u GITHUB_TOKEN python3 scripts/setup-personal-updates.py --backup-dir "$HOME/Pocket-Korean-signing-backup"
```

If you use a fine-grained owner token instead, select this repository and grant
**Secrets: write** and **Variables: write**. Never put a credential in this
repository, an issue, release asset, app, or chat. The helper disables GitHub CLI
debug logging in its child processes and does not print raw command output.

### What gets configured

These settings appear under **Repository Settings → Secrets and variables →
Actions**. The repository is public; Actions secrets remain secret.

| Setting | Kind | Value |
| --- | --- | --- |
| `POCKET_KEYSTORE_BASE64` | Secret | Base64-encoded owner keystore |
| `POCKET_KEYSTORE_PASSWORD` | Secret | Owner's keystore password |
| `POCKET_KEY_ALIAS` | Secret | `pocket-korean-personal` |
| `POCKET_KEY_PASSWORD` | Secret | Owner's key password |
| `POCKET_SIGNING_CERT_SHA256` | Variable | Public certificate SHA-256, 64 hexadecimal characters without separators |

Base64 is an encoding, not encryption. Only the GitHub Actions secret may contain
that encoded key. The fingerprint contains no private key and is checked against
each release APK to prevent an accidental signing-identity change.

### If setup stops

Keep the original backup. Resume using the same directory:

```sh
python3 scripts/setup-personal-updates.py --backup-dir "$HOME/Pocket-Korean-signing-backup" --resume
```

The helper checks the backed-up certificate against its identity record and any
registered GitHub fingerprint. It refuses to substitute another key. Separate
GitHub secret writes are not atomic, so the workflow fails visibly when signing
settings are partial. A resumed setup reuploads the same four values. The helper
does not read secret values back, overwrite an unrelated existing setup, or
generate a replacement during resume.

If a tool failed before `signing-identity.json` was created, retain the directory
and inspect the failure before doing anything to its files. Do not delete a key
that might already be in use. The helper intentionally does not rotate keys.

## Move from the installed prototype once

1. In the working prototype, choose **Settings → Export backup** and save the JSON
   outside app storage. It contains vocabulary, reviews, quest progress, settings,
   character choices, inventory, and coin/purchase history.
2. Download the first **personal** `Pocket-Korean.apk` from Releases. Confirm the
   release exists before removing the old installation.
3. Uninstall the disposable prototype, install the personal APK, and import the
   saved JSON. Android cannot install a differently signed APK over the old app.
4. Prepare the translation/handwriting models again if needed. Android's installed
   Korean voice and speech provider are separate from the notebook backup.

After this transition, higher-version APKs with the same package and permanent
signing identity update the installation in place. Continue keeping occasional
JSON backups; uninstalling or clearing app storage still removes local data.
The signing backup and notebook backup serve different purposes and both matter.

## Future release and phone flow

- **Check for updates** makes one user-triggered, unauthenticated HTTPS request to
  GitHub's fixed public latest-release endpoint. It sends no notebook data.
- A newer supported release offers the APK download in the external browser.
  Android asks you to approve installation and may ask you to allow that browser
  or file manager as an installation source. The app does not request
  `REQUEST_INSTALL_PACKAGES`, install silently, or host remote code in its WebView.
- No public release yet is a normal result. Network/API failures and rate limits
  have readable retry messages, with the Releases page available as a fallback.
- About shows the installed version and its `prototype` or `personal` channel.

The native bridge adds:

| Action | Contract |
| --- | --- |
| `capabilities` | Adds integer `versionCode` and `updateChannel: 'prototype' \| 'personal'` |
| `checkForUpdates` | `{}` → `{found, available, currentVersion, currentVersionCode, latestVersion, latestVersionCode, releaseUrl, downloadUrl}` |
| `openUpdates` | `{mode:'download'}` opens the fixed latest APK URL; otherwise opens the fixed Releases page; returns `{opened:true}` |

The checker accepts published `v0.1.N` tags, compares the numeric build against
the installed version code, and requires the expected uploaded APK asset with
the exact repository/tag download URL. A 404 returns `found:false`,
`available:false`, null latest-version/download fields, and the fixed Releases
page. Errors are `UPDATES_NETWORK_ERROR`, `UPDATES_RATE_LIMIT`,
`UPDATES_UNAVAILABLE`, or `UPDATES_INVALID_RELEASE`. A concurrent check returns
`BUSY`. No caller can supply an arbitrary URL.

## Workflow details

The existing `Build Pocket Korean` workflow keeps its increasing run number as
the Android version code and uses `0.1.<run number>` as the display version.
Keep that numbering monotonic if the workflow is later replaced. Rerunning one
run does not increment its number.

Only successful `main` push/manual runs with all four signing secrets and the
matching fingerprint publish releases. Pull requests and builds before any
signing setup use disposable debug signing and publish no release. A partially
configured or changed identity fails instead of falling back to a prototype.
The keystore exists only in the signing step's protected temporary directory and
is deleted when that step exits.

A separate publishing job gets `contents:write`; the build job retains read-only
repository permission. Release tags are `v0.1.N`. Assets are `Pocket-Korean.apk`,
`SHA256SUMS.txt`, `BUILD-TYPE.txt`, and `BUILD-METADATA.json`. Metadata records the
actual package/version, source commit, checksum, channel, and public certificate
fingerprint. A release is drafted, its assets uploaded, then published as latest.
Existing release tags are never overwritten; inspect an unfinished draft before
retrying a failed publish. A numeric version guard rejects an older rerun when a
newer version has already been published, so it cannot move the latest-download
link backwards. A failed release-list request or an unexpected published version
also stops publication for review. These releases are publicly downloadable.

## Primary references

- [Android app signing and update identity](https://developer.android.com/studio/publish/app-signing)
- [Android version codes](https://developer.android.com/studio/publish/versioning)
- [Android APK distribution and install-source permission](https://developer.android.com/distribute/marketing-tools/alternative-distribution)
- [GitHub latest-release API](https://docs.github.com/en/rest/releases/releases#get-the-latest-release)
- [GitHub Actions secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets)
- [GitHub CLI secret upload](https://cli.github.com/manual/gh_secret_set)
- [GitHub CLI environment/token precedence](https://cli.github.com/manual/gh_help_environment)
- [GitHub Actions token permissions](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token)
- [JDK 17 keytool](https://docs.oracle.com/en/java/javase/17/docs/specs/man/keytool.html)

# Verification

## Local logic and integration tests

From the repository root, with Node.js 20 or newer:

```sh
npm test
```

These tests require no installed npm packages. They cover vocabulary scheduling and persistence, curriculum consistency, and the actual app handlers with a small DOM fixture. The modal-click regression checks that a submit button retains its default action while a direct backdrop click still closes the dialog.

## Optional browser smoke check

```sh
node tests/ui-smoke.mjs
```

The script uses an existing Playwright installation and Chromium browser. It starts its own temporary server on localhost, opens a fresh browser context, checks all five tabs at 320/390/768 pixels, verifies typed-recall persistence, saves/searches/opens a custom word, completes the first lesson, and requires no uncaught page errors. It also saves six screenshots, by default in `docs/screenshots`. Its server and browser are closed when the run finishes or fails.

Playwright is optional QA tooling and is not a production dependency. Use these environment variables to supply tooling installed elsewhere:

| Variable | Purpose |
| --- | --- |
| `POCKET_PLAYWRIGHT_MODULE` | Absolute path to an installed `playwright` package or its entry point. Defaults to resolving `playwright` from the repository. |
| `POCKET_CHROMIUM_EXECUTABLE` | Path to a compatible Chromium executable. Defaults to Playwright's configured browser. |
| `POCKET_FONT_DIR` | Optional `@fontsource/noto-sans-kr` package directory containing `400.css`, `600.css`, `700.css`, and its `files` folder. Supplies Korean screenshot fonts independently of the host. |
| `POCKET_SCREENSHOT_DIR` | Optional output directory, replacing `docs/screenshots`. |
| `POCKET_BROWSER_ARGS` | Optional JSON array of Chromium flags required by the test environment. Defaults to `["--disable-dev-shm-usage"]`. |

For an existing external QA installation:

```sh
POCKET_PLAYWRIGHT_MODULE=/path/to/qa/node_modules/playwright \
POCKET_CHROMIUM_EXECUTABLE=/path/to/chromium \
POCKET_FONT_DIR=/path/to/qa/node_modules/@fontsource/noto-sans-kr \
node tests/ui-smoke.mjs
```

Repository assets are located relative to the script, so it can also run from another working directory. Executable, font, and screenshot override paths may be absolute or relative to that working directory. No public server or signed-in session is used.

The browser check exercises the local interface and typed learning flows. Android microphone services, Korean audio, model downloads, handwriting recognition, translation quality, APK installation, and device-specific behavior still need Android verification; a passing browser run does not establish those capabilities.

## Installed Android app check

The **Android startup smoke** workflow follows successful builds on `main`. It downloads that run's existing APK, boots an Android 15 emulator, installs the APK, and runs:

```sh
node tests/android-smoke.mjs path/to/Pocket-Korean.apk android-smoke
```

The adjacent `BUILD-TYPE.txt` must identify a disposable debug build. The check verifies the real Activity launch, bundled WebView page, stylesheet, five navigation items, and a native `capabilities` response. It checks for a surviving app process and application crashes. The artifact records the APK's SHA-256 alongside the result, device screenshot, and logs.

This gate does not request a microphone permission, download models, or perform translation, ink recognition, or spoken audio. Those services can correctly report unavailable on a fresh emulator. Stable release builds disable WebView debugging, so this specific debug gate explicitly skips them; it does not mark them as device-tested.

## Latest prototype verification

- **Final APK version, source commit, build result, size, and SHA-256: pending.** A native startup fix requires a new APK build before these identifiers can be recorded.
- **Logic and integration checks passed:** all 58 `npm test` tests, covering scheduling, persistence/imports, curriculum consistency, and app-handler regressions.
- **Browser smoke passed:** all 18 checks, with zero uncaught page errors. Verified all five tabs at 320/390/768 pixels, typed-recall persistence, custom vocabulary saving/search/detail, and first-lesson completion.

**Emulator startup verification is pending.** The preceding [smoke run 38312968060](https://github.com/JustPixelll/pocket-lab/actions/runs/38312968060) opened the bundled UI, found all five tabs, the stylesheet, and the native bridge, and found no application crash or JavaScript error. Its capabilities request timed out after 40 seconds during ML Kit's first-launch model catalog initialization. A fix will return the current capabilities immediately and refresh model availability in the background; the startup gate must pass against the new APK before startup is counted as verified.

**Actual-phone checks remain:** APK installation and launch; microphone permission, Korean/English speech recognition, and Korean spoken audio; model downloads; finger-drawn Korean recognition; and translation quality plus behavior after models are downloaded and the phone is offline. The passing logic, browser, build, and lint checks do not establish these native capabilities on the user's phone.

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

- **APK version:** `0.1.6` (disposable debug signing).
- **Built source:** `b800c5dfb105effd4448b1fdcb53abc07e5002db`.
- **Build and Android lint passed:** [build run 38316974838](https://github.com/JustPixelll/pocket-lab/actions/runs/38316974838). No lint errors; compatibility/update and trusted-WebView JavaScript warnings remain in the build report.
- **APK:** `Pocket-Korean.apk`, 96,820,159 bytes. SHA-256: `078958515dc4b1d58c557ca1c7b2ef1b553415c77cd235be40e28b03b5ee43be`. The downloaded ZIP and APK checksums match the published artifact metadata and checksum file.
- **Logic and integration checks passed:** all 58 `npm test` tests, covering scheduling, persistence/imports, curriculum consistency, and app-handler regressions.
- **Browser smoke passed:** all 18 checks, with zero uncaught page errors. These covered all five tabs at 320/390/768 pixels, typed-recall persistence, custom vocabulary saving/search/detail, and first-lesson completion.

**Installed Android checks:** [smoke run 38317169219](https://github.com/JustPixelll/pocket-lab/actions/runs/38317169219) tests this exact APK on an Android 15 emulator. Completed attempts verified Activity launch, the bundled home DOM and stylesheet, five navigation items, the native version/checksum, and real Java bridge responses. Attempt 2 also verified a genuine Android Words tap reaching the intended route. No Pocket Korean crash or uncaught JavaScript error was recorded in those completed checks.

**Android startup and ordinary screen presentation remain incompletely verified.** The latest [attempt 4, job 115042524193](https://github.com/JustPixelll/pocket-lab/actions/runs/38317169219/job/115042524193), using QA script `f3aa4ee59dff1d869ecc8e9ddba4a16573ec775c`, failed the cold-launch assertion: Android's `am start -W` returned `Status: timeout` after 13,088 ms. Android later logged the Activity as displayed at 15,956 ms after launch; the saved screen capture still shows the native splash. The crash buffer is empty and the final Activity dump shows the app focused and resumed. This attempt did not reach the DOM, bridge, or Words checks and is not counted as a pass. Its evidence is [artifact 11776804968](https://github.com/JustPixelll/pocket-lab/actions/runs/38317169219/artifacts/11776804968).

Earlier diagnostic images were captured during several seconds of emulator graphics backlog. Attempt 2 reached the correct Words route through a genuine Android tap, but its physical images showing the intended screens followed renderer screenshot requests. Attempt 3's passive home image showed the interface updating before any renderer screenshot, while an unrelated Pixel Launcher ANR obscured the app and blocked safe Words targeting. Together these establish successful app/bridge runs and delayed presentation in the emulator, but do not establish reliable ordinary launch and navigation. The cause of the inconsistent startup is not conclusively established, and phone performance remains unmeasured.

The fixture uses `-gpu swiftshader -feature -Vulkan`. It force-stops the previously observed setup package, `com.google.android.googlesdksetup`, before launch. It also contains a targeted stop for the background Pixel Launcher package, `com.google.android.apps.nexuslauncher`, after a successful Activity launch; attempt 4 failed before reaching that checkpoint. App crash, process continuity, and JavaScript error checks remain in place. No production repaint workaround was added to make a test image pass.

**Actual-phone checks remain:** installation and launch; microphone permission and Korean/English speech recognition; Korean spoken audio; model downloads; finger-drawn Korean recognition; translation quality; and operation offline after models are downloaded. Emulator capability flags report service availability, not successful recognition, speech playback, or translation inference.

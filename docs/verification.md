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
- **Build and Android lint passed:** [build run 38316974838](https://github.com/JustPixelll/pocket-lab/actions/runs/38316974838). There are no lint errors; compatibility/update and trusted-WebView JavaScript warnings remain documented by the build report.
- **APK:** `Pocket-Korean.apk`, 96,820,159 bytes. SHA-256: `078958515dc4b1d58c557ca1c7b2ef1b553415c77cd235be40e28b03b5ee43be`. The downloaded ZIP and APK checksums match the published artifact metadata and checksum file.
- **Logic and integration checks passed:** all 58 `npm test` tests, covering scheduling, persistence/imports, curriculum consistency, and app-handler regressions.
- **Browser smoke passed:** all 18 checks, with zero uncaught page errors. Verified all five tabs at 320/390/768 pixels, typed-recall persistence, custom vocabulary saving/search/detail, and first-lesson completion.

**Emulator Activity/DOM/bridge assertions passed:** [smoke run 38317169219](https://github.com/JustPixelll/pocket-lab/actions/runs/38317169219), attempt 2, installed and launched version `0.1.6` on an Android 15 emulator. It verified the bundled home DOM, all five navigation items, stylesheet, a real native capabilities roundtrip (97 ms), and a genuine Android Words tap reaching the intended route, with no application crash or uncaught JavaScript error. The evidence artifact records the APK checksum, native version, response time, screenshots, and device logs. Capabilities returns the current snapshot while optional model readiness is checked in the background. The first attempt failed during the SDK system-image download, before the emulator or app started.

The first two successful assertion runs confirmed the exact APK checksum and native version `0.1.5`; their capabilities roundtrips took 1,316 ms and 1,437 ms. Both physical screenshots retained the initial loading frame despite the completed home DOM, including after two animation frames and a three-second compositor settle.

Diagnostic attempt 3 used that same APK and bracketed renderer screenshots with Android-surface screenshots. It confirmed correct home and Words rendering, a genuine Android Words tap reaching the intended route, a 1,657 ms basic native dispatch and a 98 ms capabilities response, and no app crash or uncaught JavaScript error. Physical captures before the renderer screenshot requests retained the previous screen; later captures showed the intended home and Words screens. Frame timing also revealed several seconds of graphics backlog, and the post-tap physical capture began before that frame completed. The ordering alone does not prove renderer screenshots are required for updates. Ordinary presentation remains unresolved and is not counted as visually verified.

That run used emulator 37.2.12.0 with the action's `swiftshader_indirect` default. Android now [deprecates that graphics mode](https://developer.android.com/studio/run/emulator-acceleration) and [documents disabling Vulkan](https://developer.android.com/studio/run/emulator-troubleshooting) for web rendering incompatibilities. Version `0.1.6` was built from unchanged application source, with the build-number version metadata incremented, and checked using `-gpu swiftshader -feature -Vulkan`. The log confirms Vulkan was disabled. This did not remove the several-second startup graphics backlog; the immediate Words capture again started before its frame completed. A bounded passive sample at home DOM +5/+15 seconds and Words DOM +3/+10 seconds will distinguish delayed presentation from a persistent freeze. These physical captures and frame statistics precede the corresponding renderer screenshot, without changing application state or requesting repaint.

The emulator fixture force-stops its unrelated `com.google.android.googlesdksetup` setup package before launching Pocket Korean, following an observed setup-app ANR in an earlier run. Pocket Korean's crash and JavaScript error checks remain active.

**Actual-phone checks remain:** APK installation and launch; microphone permission, Korean/English speech recognition, and Korean spoken audio; model downloads; finger-drawn Korean recognition; and translation quality plus behavior after models are downloaded and the phone is offline. The passing logic, browser, build, and lint checks do not establish these native capabilities on the user's phone.

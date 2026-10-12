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

The script uses an existing Playwright installation and Chromium browser. It starts its own temporary server on localhost, opens a fresh browser context, checks all six tabs at 320/390/768 pixels, verifies typed-recall persistence, saves/searches/opens a custom word, completes and revisits the first quest, buys a hat and checks persistence, verifies independent quest-audio controls, and requires no uncaught page errors. It also saves twelve screenshots, by default in `docs/screenshots`. Its server and browser are closed when the run finishes or fails.

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

The browser check exercises the local interface and typed learning flows. Its speech-synthesis stub checks the requested Korean text and language; it does not verify voice playback. Android microphone services, Korean audio, model downloads, handwriting recognition, translation quality, APK installation, and device-specific behavior still need Android verification; a passing browser run does not establish those capabilities.

## Installed Android app check

The **Android startup smoke** workflow follows successful builds on `main`. It downloads that run's existing APK, boots an Android 15 emulator, installs the APK, and runs:

```sh
node tests/android-smoke.mjs path/to/Pocket-Korean.apk android-smoke
```

The adjacent `BUILD-TYPE.txt` must identify a disposable debug build. The check verifies the real Activity launch, bundled WebView page, stylesheet, six navigation items, and a native `capabilities` response. It checks for a surviving app process and application crashes. The artifact records the APK's SHA-256 alongside the result, device screenshot, and logs.

This gate does not request a microphone permission, download models, or perform translation, ink recognition, or spoken audio. Those services can correctly report unavailable on a fresh emulator. Stable release builds disable WebView debugging, so this specific debug gate explicitly skips them; it does not mark them as device-tested.

## Character and quest update verification

- **Logic and integration:** 81 tests pass, including old-backup migration, permanent quest/mastery rewards, atomic purchases, idempotent imports, failed-save recovery, and independent quest-audio controls.
- **Browser:** 29 checks pass, with zero uncaught page errors. All six tabs fit at 320/390/768 pixels; shop and wardrobe also fit at the narrow and wide sizes. The first quest awards 20 coins, its replay awards none, and a purchased/equipped beanie survives reopening and appears in quest scenes.
- **Content:** exactly ten quests, four challenges each, and five reusable townspeople. Existing lesson IDs, grammar, challenge answers, prerequisites and vocabulary are preserved. Korean content uses no romanization.
- **Handwriting regression:** inspection of the actual `digital-ink-recognition:19.0.0` SDK reproduced `IllegalStateException: Missing required properties: preContext` when building the previous context. A focused JVM check against that SDK confirmed the corrected builder accepts an empty pre-context and retains the writing-area dimensions. The target answer is never supplied to recognition. See [native services](native-services.md).
- **Native build and Android lint:** passed in [build run 38323819134](https://github.com/JustPixelll/pocket-lab/actions/runs/38323819134). The same run passed all 81 Node tests.
- **Installer:** version `0.1.7`, built from `049b547b253d608ff417178bad30f6e622ad5030`, with disposable debug signing. `Pocket-Korean.apk` is 96,840,987 bytes; SHA-256 `5fd7e04bbc36013d449837b59ea18bd198e166c24ad13594245d2fd680d42457`.
- **Download integrity:** the artifact ZIP SHA-256 matched GitHub's `78a0985731e8c1feb647d0d025ccdc6d328aec6b7067dd9a0a1f4e7ae1c59b1d`. The extracted APK matched the build's checksum file. All eight changed app assets match the tested source byte for byte, and the packaged attribution image matches the build artifact.
- **Android emulator:** the automatic [startup smoke run 38323969517](https://github.com/JustPixelll/pocket-lab/actions/runs/38323969517) was still running at the installer handoff (2026-10-12 23:49 UTC). It is not included in the pass claims above. Browser checks and the exact-SDK builder regression do not establish recognition of a finger drawing or Korean voice playback on a phone.

## Previous installed prototype

Version `0.1.6` was built from `b800c5dfb105effd4448b1fdcb53abc07e5002db` in [build run 38316974838](https://github.com/JustPixelll/pocket-lab/actions/runs/38316974838). Compilation and Android lint passed. Its APK SHA-256 was `078958515dc4b1d58c557ca1c7b2ef1b553415c77cd235be40e28b03b5ee43be` (96,820,159 bytes).

The owner installed this version on a real phone and reported that the app almost completely works. Their screenshots show a handwriting service error and missing Korean text-to-speech/speech-language setup. That report confirms installation and ordinary interface use on their phone; it is not evidence of successful handwriting, microphone recognition, or spoken Korean audio.

The earlier [Android smoke run 38317169219](https://github.com/JustPixelll/pocket-lab/actions/runs/38317169219) had inconsistent cold-start presentation in its emulator. Some attempts established DOM loading, native bridge responses, and a real Android Words tap. Attempt 4 failed a cold-launch timeout at 13,088 ms, with the Activity later reported displayed at 15,956 ms and no app crash. Its evidence is [artifact 11776804968](https://github.com/JustPixelll/pocket-lab/actions/runs/38317169219/artifacts/11776804968). It is not counted as a reliable launch/presentation pass. No production repaint workaround was added.

## Phone follow-up

After exporting an old backup and installing the new test APK, import the backup if replacing it required uninstalling. Check a finger-drawn syllable after the Korean handwriting model is downloaded; Korean quest audio after installing a Korean TTS voice; and Korean/English microphone transcription using the phone's speech provider. The updated speech fallback permits the provider to use its supported language service when on-device recognition reports a missing language. Translation quality and offline operation still require checks on the actual phone.

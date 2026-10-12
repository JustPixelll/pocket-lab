# Pocket Korean · 한글 in your pocket

A personal Android Korean-learning app for the `pocket-lab` project. It keeps a local vocabulary notebook and adds handwriting, spoken recall, a translator, and short adaptive lessons. Korean vocabulary and sound hints never use romanization.

## Install on your Android phone

1. Open this repository's **Actions** tab while signed into the GitHub account that owns it.
2. Open the latest successful **Build Pocket Korean** run.
3. Download **Pocket-Korean-Android** from **Artifacts**. Extract the ZIP and open `Pocket-Korean.apk`.
4. Allow your browser/file manager to install this app if Android asks. Check `BUILD-TYPE.txt`: the first prototype uses a disposable test key. Before replacing a test build, export your notebook; a new build may require uninstalling, reinstalling and importing it. Stable updates are available once protected signing secrets are configured.
5. In Pocket Korean, open the top-right settings button and **Prepare both Korean models**. The initial translation and handwriting downloads need internet, approximately 50 MB together. A mobile connection can be used.
6. Install a Korean text-to-speech voice in your phone's voice settings if Listen reports that one is missing. Grant microphone access when you first choose spoken practice.

The minimum Android version is **Android 8.0 (API 26)**. Use an up-to-date Android System WebView. No Play Store listing, app account, server, or AI API key is needed.

## The five areas

### Learn

Ten curated mini-adventures with 40 challenges. Each introduces one useful grammar pattern and a few words, then uses sentence-building or meaning-choice puzzles. Recommendations depend on practiced vocabulary and completed prerequisite lessons. Missing words get a focused warm-up. Existing handwritten/translated words can satisfy matching curriculum prerequisites.

This version is a finite, reviewed lesson bank, not an unlimited text generator. It can choose a suitable next step and revisit material without inventing new grammar. Lessons do not automatically grant vocabulary mastery.

### Write

Draw directly with a finger or stylus. Practice syllable blocks, consonants, vowels, or words from your notebook. Show/hide the shape guide; undo or clear strokes; ask the local Korean handwriting model what it recognizes.

The translucent guide shows a character's shape, not numbered stroke order. Recognition candidates indicate recognized text, not penmanship quality. Isolated consonants can be less reliable than complete syllable blocks.

### Speak

English → Korean, Korean → English, and mixed practice. The app displays a prompt and asks for a spoken answer, then shows the transcript for you to check before submitting. Type instead whenever voice input is unavailable. Dictionary verbs are labeled as dictionary-form questions.

**This assesses vocabulary recall from the transcript, not pronunciation quality.** Speech transcription can make mistakes. Empty/no-match/error results do not become failed vocabulary attempts. The phone's speech provider may process audio online; the app prefers on-device recognition when available and does not keep recordings.

### Words

A searchable notebook with listen/slow listen, Hangul-only pronunciation hints where curated, English meanings, examples, editable accepted English answers, and independent progress in both directions.

| Color | Meaning | What changes it |
|---|---|---|
| Black | New | No recall tests yet |
| Yellow | Learning | At least one test, with mastery criteria still unmet |
| Green | Mastered | Both directions reach stage 3 with successful credited reviews spanning at least four days in each direction |

Credited successes are separated by at least 20 hours. Normal review intervals grow through 1, 3, 7, 14, and 30 days. A miss or revealed answer brings a word back sooner and can demote it. Repeated immediate successes cannot manufacture mastery. Recent, difficult, and overdue words appear more often; mastered words remain in occasional review.

The starter notebook contains 12 words, including the seven already practiced: 한국어, 한글, 자다, 안녕히 주무세요, 감사합니다, 지금, 오늘. Prior exposure is not treated as proven mastery. The full optional curated bank has 60 entries.

### Translate

English ↔ Korean translation using Google Translate through **ML Kit on-device translation**. Once the Korean model is downloaded, text translation runs on the phone. Translate a phrase, select a word or phrase in the result, then add it to the notebook. Every addition opens an editable Korean/English preview. Partial selections are translated separately for the draft meaning; context and inflections still need checking.

Machine-suggested vocabulary retains source metadata. The app does not invent pronunciation hints for newly translated items; use Korean audio, or add a checked Hangul sound hint yourself.

## Keep your notebook

Progress is stored locally in the app's WebView storage. There is no app login or cloud vocabulary sync. Uninstalling/clearing app data removes it, so use **Settings → Export backup**. Backups include words, review events, lesson completions and preferences.

Import merges rather than erases. Reimporting the same backup does not double-count reviews. An older backup cannot erase a later failed review or overwrite a newer vocabulary correction. Invalid/corrupted data and storage failures are surfaced without silently reseeding the notebook.

## Development and verification

The app is a Java Android shell plus bundled HTML/CSS/JavaScript. Native services expose a small JSON bridge. Assets load from Android's private HTTPS asset origin; the WebView does not load remote pages. See [native services](docs/native-services.md), [learning engine](docs/learning-engine.md), [curriculum sources](docs/curriculum-sources.md), and [verification](docs/verification.md).

```sh
# Pure learning/curriculum tests, no dependencies or network needed
npm test

# Browser UI preview: native-only features explain that the APK is needed
npm run preview

# Full Android build, with JDK 17, Gradle 8.11.1 and Android SDK 35 installed
gradle :app:assembleDebug :app:lintDebug
```

GitHub Actions runs tests, compiles/lints the Android app, and attaches the installable APK. **No signing keys are committed.** By default each runner creates a disposable Android debug key, so builds from different runs may not install over one another. Export/import preserves your notebook when replacing such builds.

For seamless personal updates, the workflow already supports a stable release identity supplied through protected GitHub Actions secrets: `POCKET_KEYSTORE_BASE64`, `POCKET_KEYSTORE_PASSWORD`, `POCKET_KEY_ALIAS`, and `POCKET_KEY_PASSWORD`. These have not been configured by this project. With them present, the workflow writes the key only to its temporary runner directory, builds a signed release, then deletes the temporary key. Do not put keys in source files, issues, logs, or chat.

The source includes an original Google Translate attribution badge. The automated build refreshes it from Google's official badge archive, selects an original PNG, and logs its name and checksum before packaging. The unmodified attribution image is also included in the build artifact for inspection.

Actual microphone recognition, downloaded models, audio voices, and system installation need a real-device check. Browser service mocks only exercise the interface/bridge contract; they are not evidence that a phone's speech/model services work.

The separate **Android startup smoke** workflow checks each successful disposable debug APK on an Android emulator, including a real native-service roundtrip. Its evidence artifact identifies the tested APK by SHA-256. Automated assertions establish Activity launch, the loaded DOM, and bridge integration; physical screen captures require visual review. See [verification](docs/verification.md) for the current presentation result. Speech providers, model downloads, and recognition still need a check on the phone where you will use the app.

## Sources and attribution

- [Android in-app content](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content)
- [ML Kit translation](https://developers.google.com/ml-kit/language/translation/android)
- [ML Kit digital ink](https://developers.google.com/ml-kit/vision/digital-ink-recognition/android)
- [Android speech recognition](https://developer.android.com/reference/android/speech/SpeechRecognizer)
- [ML Kit translation attribution](https://developers.google.com/ml-kit/language/translation/translation-terms)
- [Google Translate / Cloud Translation](https://cloud.google.com/translate)

Google Translate is used to power automatic translation. Pocket Korean is independent of Google. Automatic translations can be wrong; review them in context before learning them. The required Google translation disclaimer is available in the app's About area. Google's attribution asset retains Google's branding and is not the app logo. Korean curriculum references and editorial limitations are recorded separately in `docs/curriculum-sources.md`.

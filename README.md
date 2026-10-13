# Pocket Korean · 한글 in your pocket

A personal Android Korean-learning app set at **Greybridge Outpost**, with a stylized fantasy cast, ten story contracts, and travel equipment earned through learning. Keep a local vocabulary notebook, practice handwriting and spoken recall, and translate useful phrases. Korean vocabulary and sound hints never use romanization.

The [repository](https://github.com/JustPixelll/pocket-lab) is public. Your vocabulary, learning progress, and character remain stored on your phone; the app does not publish or sync them to GitHub.

## Install on your Android phone

1. For a prototype APK, open this repository's **Actions** tab while signed into GitHub. Once the owner completes the permanent signing setup below, personal APKs are also available from the public [Releases page](https://github.com/JustPixelll/pocket-lab/releases) without a GitHub login.
2. Open the latest successful **Build Pocket Korean** run.
3. Download **Pocket-Korean-Android** from **Artifacts**. Extract the ZIP and open `Pocket-Korean.apk`.
4. Allow your browser/file manager to install this app if Android asks. Check `BUILD-TYPE.txt`: prototype builds use disposable test keys. Export your backup before replacing one. Moving from the installed v0.1.7 prototype to the permanent signing identity requires one final uninstall, install, and import; it cannot be an in-place update. Later personal releases signed with that same permanent key can update the app while keeping its data.
5. In Pocket Korean, open the top-right settings button and **Prepare both Korean models**. The initial translation and handwriting downloads need internet, approximately 50 MB together. A mobile connection can be used.
6. If a speaker button reports a missing Korean voice, open **Settings → Korean voice settings**, choose a speech engine that supports Korean, and download its Korean voice data. Return to the app and tap the speaker again; your quest stays where you left it. Translation and handwriting models are separate from spoken voices, so preparing those models does not install a Korean voice.
7. Grant microphone access when you first choose spoken practice. Listening to Korean audio does not require microphone access.

The minimum Android version is **Android 8.0 (API 26)**. Use an up-to-date Android System WebView. No Play Store listing, app account, server, or AI API key is needed.

## Personal app updates

**Settings → Get app updates** opens the update controls. An explicit check asks GitHub for the latest public release and compares it with the installed version. APK downloads open in the phone's system browser, and Android handles installation after you open the downloaded file. The app checks only when requested; it does not silently install an update. Public release downloads do not require a GitHub login or a token in the app.

**Permanent signing still needs a one-time setup by the repository owner. It has not been completed for this project.** Follow [personal updates](docs/personal-updates.md), using the owner-run [setup helper](scripts/setup-personal-updates.py). The helper needs Python 3, JDK `keytool`, and GitHub CLI authenticated with the owner's permissions. It keeps the permanent key outside the checkout, configures the protected Actions secrets, and registers the public signing-certificate fingerprint. Keep the key backup for future releases; do not share its contents in source files, issues, logs, or chat.

After setup, successful personal builds on `main`, triggered by a push or a manual workflow run, can publish a tagged release with the APK and public checksum/build metadata. Prototype builds and pull requests do not publish personal releases. Until the first personal release exists, continue using the prototype artifacts. Before the one-time transition, export a JSON backup; after installing the personal release, import it and prepare the Korean language models again.

## The six areas

### Home

Prepare your wayfarer at **Camp**, name them, and equip them for the next contract. The **Outfitter** offers travel tunics, ranger wraps, coats, cloaks, hats, and body colors; **Equipment** lets you wear the items you own. Starting gear and several body colors are free. Paid cosmetics cost 20–80 coins and only change appearance. The fantasy presentation keeps existing ownership and equipped items intact.

Your equipped character appears in quest scenes with Greybridge's recurring cast: a quartermaster, scout, provisioner, archivist, and rival delver. Open **Contacts → Codex** to read their dossiers and find their contracts.

Earn **20 coins the first time you complete each quest** and **10 coins the first time a word becomes green**. Replaying a quest or bringing a demoted word back to green does not award coins again. Existing completed quests and earlier mastery recorded in your review history receive their rewards once when your notebook is upgraded, including words that were green before a later missed review. There are no currency purchases.

### Learn

Exactly **10 curated story quests**, presented as contracts on the **Quest board**, follow the recurring cast at Greybridge Outpost. Each has four short challenges, a field objective, Korean dialogue with English meanings, and a conclusion. It introduces one useful grammar pattern and a few words through sentence-building or meaning-choice puzzles. Speaker buttons in every quest let you hear Korean dialogue, vocabulary, examples, and model answers through the phone's Korean text-to-speech voice.

Recommendations depend on practiced vocabulary and completed prerequisite quests. Missing words get a focused warm-up. Existing handwritten or translated words can satisfy matching curriculum prerequisites. Completed quests stay available to revisit. The fantasy revision preserves all ten quest IDs, completed lessons, learning progress, earned rewards, and equipment.

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

Progress is stored locally in the app's WebView storage. There is no app login or cloud vocabulary sync. Uninstalling/clearing app data removes it, so use **Settings → Export backup**. Backups include words, review events, quest completions, preferences, your character's name and equipment, owned cosmetics, and the reward and purchase receipts used to calculate coins.

Import merges rather than erases. The current schema 2 reads and upgrades earlier schema 1 notebooks and backups without resetting vocabulary or quest progress. Reimporting the same backup does not double-count reviews, coin rewards, or purchases. An older backup cannot erase a later failed review, overwrite a newer vocabulary correction, remove owned items, or revert a newer character choice. Invalid/corrupted data and storage failures are surfaced without silently reseeding the notebook; a failed write leaves the previous saved state intact.

If separate copies spend the same earned coins on different items, merging keeps both items. Available coins stay at zero until future rewards cover that difference, then new rewards become spendable again.

## Development and verification

The app is a Java Android shell plus bundled HTML/CSS/JavaScript. Native services expose a small JSON bridge. Assets load from Android's private HTTPS asset origin; the WebView does not load remote pages. See [native services](docs/native-services.md), [learning engine](docs/learning-engine.md), [curriculum sources](docs/curriculum-sources.md), and [verification](docs/verification.md).

```sh
# Learning, curriculum, coins and persistence tests; no dependencies or network needed
npm test

# Browser UI preview: native-only features explain that the APK is needed
npm run preview

# Full Android build, with JDK 17, Gradle 8.11.1 and Android SDK 35 installed
gradle :app:assembleDebug :app:lintDebug
```

GitHub Actions runs tests, compiles/lints the Android app, and attaches the installable APK. **No signing keys are committed.** By default each runner creates a disposable Android debug key, so builds from different runs may not install over one another. Export/import preserves your notebook when replacing such builds.

The permanent release identity uses protected GitHub Actions secrets: `POCKET_KEYSTORE_BASE64`, `POCKET_KEYSTORE_PASSWORD`, `POCKET_KEY_ALIAS`, and `POCKET_KEY_PASSWORD`, plus the public Actions variable `POCKET_SIGNING_CERT_SHA256`. The owner-run setup helper configures these; setup remains pending. The workflow writes the key only to its temporary runner directory, verifies the built APK against the registered public certificate fingerprint, and deletes the temporary key. Neither the signing key nor its passwords belong in source or release artifacts. See [personal updates](docs/personal-updates.md) for the complete setup and recovery instructions.

The source includes an original Google Translate attribution badge. The automated build refreshes it from Google's official badge archive, selects an original PNG, and logs its name and checksum before packaging. The unmodified attribution image is also included in the build artifact for inspection.

**Phone feedback:** the user confirmed that the native features work on their actual phone in **v0.1.7**, including spoken input, Korean audio, handwriting, and translation. That confirms the installed prototype's behavior on that phone. The fantasy presentation and public update-check revision require their own build and device verification; see [verification](docs/verification.md) for recorded results. Browser service mocks only exercise the interface/bridge contract.

The separate **Android startup smoke** workflow checks successful disposable debug APKs on an Android emulator, including a real native-service roundtrip. Its evidence artifact identifies the tested APK by SHA-256. Automated assertions establish Activity launch, the loaded DOM, and bridge integration; physical screen captures require visual review. This debug-only gate does not verify a personal release APK. Other phones and new native changes need separate checks of their speech providers, model downloads, and recognition.

## Sources and attribution

- [Android in-app content](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content)
- [ML Kit translation](https://developers.google.com/ml-kit/language/translation/android)
- [ML Kit digital ink](https://developers.google.com/ml-kit/vision/digital-ink-recognition/android)
- [Android speech recognition](https://developer.android.com/reference/android/speech/SpeechRecognizer)
- [ML Kit translation attribution](https://developers.google.com/ml-kit/language/translation/translation-terms)
- [Google Translate / Cloud Translation](https://cloud.google.com/translate)

Google Translate is used to power automatic translation. Pocket Korean is independent of Google. Automatic translations can be wrong; review them in context before learning them. The required Google translation disclaimer is available in the app's About area. Google's attribution asset retains Google's branding and is not the app logo. Korean curriculum references and editorial limitations are recorded separately in `docs/curriculum-sources.md`.

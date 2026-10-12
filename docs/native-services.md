# Native Android services

`MainActivity` is an `android.app.Activity` hosting only packaged assets at
`https://appassets.androidplatform.net/assets/index.html`. The native bridge has
no API backend or API keys. Android SpeechRecognizer and TextToSpeech use the
phone's installed services, which may process content online.

## Bridge contract

JavaScript calls `PocketNative.request(JSON.stringify({id, action, payload}))`.
Each ID must be unique while its operation is outstanding. Responses call
`window.__pocketNativeResult({id, ok, data, error?})`; `error` is
`{code, message}`. Events call `window.__pocketNativeEvent({type, data})`.
Responses are queued until the bundled page has finished loading. Unknown
actions and invalid payloads fail with readable messages. Malformed envelopes
without a usable ID emit `nativeError` because no response can be correlated.

| Action | Payload | Successful response data |
| --- | --- | --- |
| `capabilities` | `{}` | `platform`, `speechAvailable`, `onDeviceSpeechAvailable`, `ttsReady`, `translationReady`, `inkReady`, `version`, `koreanVoiceAvailable`, `englishVoiceAvailable` |
| `speak` | `{text, lang:'ko-KR'\|'en-US', rate:0.85}` | `{started:true, status:'queued', mayUseNetwork}` |
| `stopSpeaking` | `{}` | `{stopped:true}` |
| `listen` | `{lang:'ko-KR'\|'en-US', preferOffline:true}` | `{alternatives:[strings], text, onDevice, mayUseNetwork}` |
| `stopListening` | `{}` | `{stopped:true}`; the original `listen` later receives results or an error |
| `translate` | `{text, source:'en'\|'ko', target:'en'\|'ko'}` | `{text}` |
| `prepareModels` | `{which:'translation'\|'ink'\|'all', wifiOnly:false}` | `{ready:true, translationReady, inkReady}` |
| `recognizeInk` | `{strokes:[[{x,y,t}]], width, height}` | `{candidates:[strings]}` |
| `exportBackup` | `{content, name}` | `{saved:true, name}` after Android's document picker and write finish |
| `importBackup` | `{}` | `{content}` after reading a UTF-8 document |
| `openSpeechSettings` | `{kind?:'speech'\|'tts'\|'microphone'}` | `{opened:true}`; defaults to `speech` |

Additional fields are informative; the required bridge fields remain intact.
Speech language aliases `ko` and `en` are accepted. `speak` resolves when queued,
not after audio completion. `speaking` events indicate actual playback start,
completion, or interruption; `speechOutputError` reports asynchronous failures.

Other events are `speechPartial {text}`, `listening {active,onDevice,mayUseNetwork}`,
`modelStatus {status,translationReady,inkReady}`, and `capabilities` with the same
data as the action. Model statuses are `checked`, `downloading`, `ready`, or `error`.

`capabilities` returns the current snapshot immediately, without awaiting ML Kit's
first-launch model initialization or TTS initialization. Model readiness is false
until a local check has confirmed it. Startup and capability requests share one
background readiness check, whose completion emits `modelStatus` and `capabilities`.
Explicit translation, ink, and post-download preparation checks always query fresh
state; older asynchronous results cannot replace a newer completed readiness check.
TTS initialization independently emits `capabilities` when its provider responds.

## Model preparation and limits

- ML Kit dependencies: `com.google.mlkit:translate:17.0.3` and
  `com.google.mlkit:digital-ink-recognition:19.0.0`.
- Ink 19 uses `com.google.mlkit.vision.digitalink.recognition` for the recognizer,
  model, ink builders, and context. Result candidates are in
  `com.google.mlkit.vision.digitalink.common`; older flat-package imports do not
  apply to this dependency version.
- Translation supports English ↔ Korean. The Korean translation model is shared
  by the two directional clients. Handwriting uses the `ko` model.
- Startup and capability checks query local model status. Only the explicit
  `prepareModels` action downloads models. Missing models produce `MODEL_REQUIRED`.
- Translation and ink inference run on-device after preparation. Google's guides
  estimate approximately 30 MB per translation language and 20 MB per ink language.
  Download size and availability can vary.
- Text input is limited to 4,000 characters, additionally bounded by the phone's
  TTS limit. Ink accepts at most 200 strokes and 20,000 points. Coordinates and
  canvas dimensions must use the same units; writing area dimensions are positive
  and at most 10,000. Preserve chronological stroke order and use a single line.
- Ink returns up to five text candidates. It does not grade penmanship or stroke
  correctness. Translation is a suggestion and does not establish the sole valid
  answer to a language exercise.
- Native file reads/writes are bounded at 4 MiB. Import removes a UTF-8 BOM and
  rejects malformed UTF-8. The JavaScript application must validate the backup
  schema and request confirmation before replacing existing learner data.

## Speech behavior

The microphone permission is requested only when the learner taps a feature that
calls `listen`. A granted permission resumes that request. A denial is not cached
as a permanent rejection by the app; Android controls future permission prompts.
The microphone settings option opens this app's Android permission settings.

On Android 12/API 31+, an available on-device recognizer is preferred. If the
requested language is unsupported or its local model is missing, the bridge tries
the installed default recognizer. On older Android versions it uses the default
recognizer directly. The offline preference is forwarded, but Android documents
that providers can ignore it. Events disclose whether the selected recognizer is
the on-device service or could use a network service. The app should explain this
before voice use; it must not promise that all speech stays offline.

Recognition returns what the service heard. It is not a pronunciation assessment.
The UI should show the transcript and let the learner accept it before checking
an answer. Do not label recognizer confidence as a pronunciation percentage.

TTS prefers a voice of the requested language that does not require a connection.
If no such voice is available, it uses the configured provider's default for that
language and reports `mayUseNetwork`. Missing language data produces
`VOICE_REQUIRED`. Speaking while recording is rejected; starting a recording
stops existing TTS playback.

## Lifecycle, files, and navigation

Speech recognizers are used on Android's main thread and destroyed after a result,
error, timeout, or cancellation. Backgrounding the activity stops the microphone
and TTS. It does not cancel a document picker or a model download. Cancelling the
picker returns `CANCELLED`; no broad storage permission is requested. Import and
export use Android's Storage Access Framework and background file I/O.

Automatic Android backup is disabled with `allowBackup="false"`. The legacy
`backup_rules.xml` excludes every supported storage domain on Android 11 and
earlier. On Android 12+, `data_extraction_rules.xml` separately excludes all
domains from cloud backup and device-to-device transfer, including private
WebView state and device-protected storage. Explicit transfer rules are needed
because some manufacturers do not apply `allowBackup="false"` to device transfer.
The app's manual JSON export/import uses the learner's chosen document location.

Request deadlines are 40 seconds normally and 290 seconds for model preparation
or selecting a document, just before the UI's own deadlines. A timed-out model download may
still complete through ML Kit and will update capability state. Closing the
activity releases all service instances and rejects its outstanding requests.

Native window padding owns status-bar, cutout, navigation-bar, and keyboard
insets. Insets are consumed before the WebView to avoid double safe-area padding.
The system Back action calls `window.pocketBack()` synchronously: return `true`
after handling an open modal or in-app route; return `false` at the app's root to
finish the activity. Both legacy and Android 13+ back paths are supported.

Only the HTTPS app-assets origin and `/assets/` paths are loaded in the WebView.
External navigation, resource requests, cleartext, file URLs, and content URLs
are blocked. WebView camera/microphone grants are denied; microphone access goes
through the native action. Remote scripts and frames must not be added to the UI.
The native settings action is the only non-document external activity launcher.
`setBlockNetworkLoads(true)` also disables ordinary network fallback. Chromium
still invokes request interception for HTTPS URLs and uses the supplied local
response; the setting does not prevent WebViewAssetLoader from serving assets.

## Official API references

- [ML Kit translation for Android](https://developers.google.com/ml-kit/language/translation/android)
- [Translation language support](https://developers.google.com/ml-kit/language/translation/translation-language-support)
- [Translation capabilities and limitations](https://developers.google.com/ml-kit/language/translation)
- [Digital ink recognition for Android](https://developers.google.com/ml-kit/vision/digital-ink-recognition/android)
- [Digital ink language models](https://developers.google.com/ml-kit/vision/digital-ink-recognition/base-models)
- [Ink 19 recognizer API](https://developers.google.com/android/reference/com/google/mlkit/vision/digitalink/recognition/DigitalInkRecognizer)
- [Ink result candidate API](https://developers.google.com/android/reference/com/google/mlkit/vision/digitalink/common/RecognitionCandidate)
- [SpeechRecognizer](https://developer.android.com/reference/android/speech/SpeechRecognizer)
- [RecognizerIntent](https://developer.android.com/reference/android/speech/RecognizerIntent)
- [TextToSpeech](https://developer.android.com/reference/android/speech/tts/TextToSpeech)
- [Voice](https://developer.android.com/reference/android/speech/tts/Voice)
- [WebViewAssetLoader](https://developer.android.com/reference/androidx/webkit/WebViewAssetLoader)
- [Android backup rules and valid storage domains](https://developer.android.com/identity/data/autobackup)
- [Chromium WebView request interception](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/android_webview/browser/network_service/aw_proxying_url_loader_factory.cc)
- [Chromium WebView network-blocking flags](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/android_webview/browser/network_service/net_helpers.cc)

The translation UI must satisfy [ML Kit translation usage guidelines](https://developers.google.com/ml-kit/language/translation/translation-terms)
and the linked [Google attribution requirements](https://docs.cloud.google.com/translate/attribution).
Attribution and the app's backup schema are implemented by the bundled UI.

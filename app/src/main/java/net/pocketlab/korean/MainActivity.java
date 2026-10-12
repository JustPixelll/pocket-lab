package net.pocketlab.korean;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;

import androidx.webkit.WebViewAssetLoader;

import com.google.android.gms.tasks.Task;
import com.google.android.gms.tasks.Tasks;
import com.google.mlkit.common.model.DownloadConditions;
import com.google.mlkit.common.model.RemoteModel;
import com.google.mlkit.common.model.RemoteModelManager;
import com.google.mlkit.nl.translate.TranslateLanguage;
import com.google.mlkit.nl.translate.TranslateRemoteModel;
import com.google.mlkit.nl.translate.Translation;
import com.google.mlkit.nl.translate.Translator;
import com.google.mlkit.nl.translate.TranslatorOptions;
import com.google.mlkit.vision.digitalink.common.RecognitionCandidate;
import com.google.mlkit.vision.digitalink.recognition.DigitalInkRecognition;
import com.google.mlkit.vision.digitalink.recognition.DigitalInkRecognitionModel;
import com.google.mlkit.vision.digitalink.recognition.DigitalInkRecognitionModelIdentifier;
import com.google.mlkit.vision.digitalink.recognition.DigitalInkRecognizer;
import com.google.mlkit.vision.digitalink.recognition.DigitalInkRecognizerOptions;
import com.google.mlkit.vision.digitalink.recognition.Ink;
import com.google.mlkit.vision.digitalink.recognition.RecognitionContext;
import com.google.mlkit.vision.digitalink.recognition.WritingArea;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Local app shell. The JavaScript bridge is exposed only to packaged, trusted assets. */
public final class MainActivity extends Activity {
    private static final String APP_HOST = "appassets.androidplatform.net";
    private static final String APP_URL = "https://" + APP_HOST + "/assets/index.html";
    private static final int MICROPHONE_REQUEST = 501;
    private static final int EXPORT_REQUEST = 502;
    private static final int IMPORT_REQUEST = 503;
    private static final int MAX_BACKUP_BYTES = 4 * 1024 * 1024;
    private static final int MAX_BRIDGE_CHARS = 5 * 1024 * 1024;
    private static final int MAX_TEXT_CHARS = 4000;

    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService files = Executors.newSingleThreadExecutor();
    private final Map<String, PendingRequest> pending = new LinkedHashMap<>();
    private final ArrayDeque<String> pageCallbacks = new ArrayDeque<>();

    private WebView web;
    private boolean pageReady;
    private boolean handlingBack;
    private volatile boolean destroyed;
    private OnBackInvokedCallback backCallback;

    private TextToSpeech tts;
    private boolean ttsReady;
    private Translator enKo;
    private Translator koEn;
    private TranslateRemoteModel translationModel;
    private RemoteModelManager modelManager;
    private DigitalInkRecognitionModel inkModel;
    private DigitalInkRecognizer inkRecognizer;
    private boolean translationReady;
    private boolean inkReady;
    private boolean backgroundModelRefreshInFlight;
    private long modelRefreshSerial;
    private long appliedModelRefreshSerial;
    private String preparingRequestId;

    private SpeechRecognizer speech;
    private String speechRequestId;
    private String speechLanguage;
    private boolean speechPreferOffline;
    private boolean speechUsesOnDevice;
    private boolean speechFallbackTried;
    private int speechGeneration;
    private String microphoneRequestId;
    private JSONObject microphonePayload;

    private String documentRequestId;
    private String documentContent;
    private String documentName;

    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);
        configureWindow();
        createWebView();
        initializeServices();
        if (Build.VERSION.SDK_INT >= 33) {
            backCallback = this::handleBack;
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                OnBackInvokedDispatcher.PRIORITY_DEFAULT, backCallback);
        }
        web.loadUrl(APP_URL);
    }

    private void configureWindow() {
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= 29) {
            getWindow().setStatusBarContrastEnforced(false);
            getWindow().setNavigationBarContrastEnforced(false);
        }
        if (Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(false);
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
                | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
    }

    private void createWebView() {
        FrameLayout frame = new FrameLayout(this);
        frame.setBackgroundColor(Color.rgb(248, 247, 241));
        frame.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                Insets safe = insets.getInsets(WindowInsets.Type.systemBars()
                    | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
                return WindowInsets.CONSUMED;
            }
            view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets.consumeSystemWindowInsets();
        });
        web = new WebView(this);
        frame.addView(web, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(frame);
        frame.requestApplyInsets();

        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        // Intercepted app-assets responses still load; prevent fallback to actual networking.
        settings.setBlockNetworkLoads(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setSafeBrowsingEnabled(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        web.setBackgroundColor(Color.rgb(248, 247, 241));
        WebView.setWebContentsDebuggingEnabled(
            (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0);

        WebViewAssetLoader assets = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                if (!isAppUri(request.getUrl()) || !"GET".equals(request.getMethod())) return blocked();
                WebResourceResponse resource = assets.shouldInterceptRequest(request.getUrl());
                return resource != null ? resource : blocked();
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !isAppUri(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return !isAppUri(Uri.parse(url));
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.cancel();
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                pageReady = false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (!isAppUri(Uri.parse(url))) return;
                pageReady = true;
                while (!pageCallbacks.isEmpty()) evaluate(pageCallbacks.removeFirst());
                emit("capabilities", capabilities());
                emitModelStatus(preparingRequestId == null ? "checked" : "downloading");
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                // Audio is requested by the bounded native listen action, never by arbitrary web content.
                request.deny();
            }
        });
        web.addJavascriptInterface(new NativeBridge(), "PocketNative");
    }

    private static boolean isAppUri(Uri uri) {
        return uri != null && "https".equals(uri.getScheme()) && APP_HOST.equals(uri.getHost())
            && (uri.getPort() == -1 || uri.getPort() == 443) && uri.getUserInfo() == null
            && uri.getPath() != null && uri.getPath().startsWith("/assets/");
    }

    private static WebResourceResponse blocked() {
        return new WebResourceResponse("text/plain", "UTF-8", 403, "Blocked",
            Collections.singletonMap("Cache-Control", "no-store"),
            new ByteArrayInputStream(new byte[0]));
    }

    private void initializeServices() {
        try {
            modelManager = RemoteModelManager.getInstance();
            translationModel = new TranslateRemoteModel.Builder(TranslateLanguage.KOREAN).build();
            enKo = Translation.getClient(new TranslatorOptions.Builder()
                .setSourceLanguage(TranslateLanguage.ENGLISH)
                .setTargetLanguage(TranslateLanguage.KOREAN).build());
            koEn = Translation.getClient(new TranslatorOptions.Builder()
                .setSourceLanguage(TranslateLanguage.KOREAN)
                .setTargetLanguage(TranslateLanguage.ENGLISH).build());
        } catch (RuntimeException unavailable) {
            translationReady = false;
        }
        try {
            DigitalInkRecognitionModelIdentifier identifier =
                DigitalInkRecognitionModelIdentifier.fromLanguageTag("ko");
            if (identifier != null) {
                inkModel = DigitalInkRecognitionModel.builder(identifier).build();
                inkRecognizer = DigitalInkRecognition.getClient(
                    DigitalInkRecognizerOptions.builder(inkModel).build());
            }
        } catch (Exception unavailable) {
            inkReady = false;
        }
        try {
            tts = new TextToSpeech(this, status -> main.post(() -> {
                if (destroyed) return;
                ttsReady = status == TextToSpeech.SUCCESS;
                if (ttsReady && tts != null) {
                    tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                        @Override public void onStart(String id) {
                            onMain(() -> emit("speaking", object("active", true, "id", id)));
                        }
                        @Override public void onDone(String id) {
                            onMain(() -> emit("speaking", object("active", false, "id", id)));
                        }
                        @Override public void onError(String id) {
                            onMain(() -> {
                                emit("speaking", object("active", false, "id", id));
                                emit("speechOutputError", object("id", id,
                                    "code", "TTS_ERROR", "message", "The phone could not play that voice."));
                            });
                        }
                        @Override public void onError(String id, int code) { onError(id); }
                        @Override public void onStop(String id, boolean interrupted) {
                            onMain(() -> emit("speaking", object("active", false, "id", id)));
                        }
                    });
                }
                emit("capabilities", capabilities());
            }));
        } catch (RuntimeException unavailable) {
            ttsReady = false;
        }
        refreshModelState(null);
    }

    public final class NativeBridge {
        @JavascriptInterface
        public void request(String input) {
            if (destroyed) return;
            if (input == null || input.length() > MAX_BRIDGE_CHARS) {
                onMain(() -> emit("nativeError", object("code", "INVALID_REQUEST",
                    "message", "This request is too large.")));
                return;
            }
            try {
                JSONObject request = new JSONObject(input);
                String id = request.optString("id", "");
                String action = request.optString("action", "");
                JSONObject payload = request.optJSONObject("payload");
                if (id.isEmpty() || id.length() > 160 || action.isEmpty() || action.length() > 64) {
                    onMain(() -> emit("nativeError", object("code", "INVALID_REQUEST",
                        "message", "A request identifier and action are required.")));
                    return;
                }
                JSONObject safePayload = payload == null ? new JSONObject() : payload;
                onMain(() -> beginRequest(id, action, safePayload));
            } catch (JSONException invalid) {
                onMain(() -> emit("nativeError", object("code", "INVALID_REQUEST",
                    "message", "The app sent a request that could not be read.")));
            }
        }
    }

    private void beginRequest(String id, String action, JSONObject payload) {
        if (destroyed) return;
        // Retain the first operation when a caller accidentally repeats an identifier.
        if (pending.containsKey(id)) return;
        if (pending.size() >= 64) {
            sendResult(id, false, null, "BUSY", "Please wait for the current operation to finish.");
            return;
        }
        // Settle before the UI's 45-second/five-minute promise deadlines.
        long timeout = ("prepareModels".equals(action) || "exportBackup".equals(action)
            || "importBackup".equals(action)) ? 290_000L : 40_000L;
        Runnable deadline = () -> fail(id, "TIMEOUT", "This operation took too long. Please try again.");
        pending.put(id, new PendingRequest(deadline));
        main.postDelayed(deadline, timeout);
        try {
            switch (action) {
                case "capabilities":
                    // Optional first-launch model setup must not delay the bridge handshake.
                    succeed(id, capabilities());
                    refreshModelState(null);
                    break;
                case "speak": speak(id, payload); break;
                case "stopSpeaking":
                    if (tts != null) tts.stop();
                    emit("speaking", object("active", false));
                    succeed(id, object("stopped", true));
                    break;
                case "listen": listen(id, payload); break;
                case "stopListening": stopListening(id); break;
                case "translate": translate(id, payload); break;
                case "prepareModels": prepareModels(id, payload); break;
                case "recognizeInk": recognizeInk(id, payload); break;
                case "exportBackup": exportBackup(id, payload); break;
                case "importBackup": importBackup(id); break;
                case "openSpeechSettings": openSpeechSettings(id, payload); break;
                default: fail(id, "UNKNOWN_ACTION", "This app action is not supported.");
            }
        } catch (JSONException | IllegalArgumentException invalid) {
            fail(id, "INVALID_INPUT", "Please check the input and try again.");
        } catch (Exception error) {
            fail(id, "NATIVE_ERROR", "The phone could not complete this action. Please try again.");
        }
    }

    private JSONObject capabilities() {
        boolean available = false;
        boolean local = false;
        try {
            available = SpeechRecognizer.isRecognitionAvailable(this);
            local = Build.VERSION.SDK_INT >= 31
                && SpeechRecognizer.isOnDeviceRecognitionAvailable(this);
        } catch (RuntimeException ignored) { /* A missing provider is a capability, not an app failure. */ }
        String version = "0.1.0";
        try { version = getPackageManager().getPackageInfo(getPackageName(), 0).versionName; }
        catch (PackageManager.NameNotFoundException ignored) { }
        boolean koreanVoice = false;
        boolean englishVoice = false;
        if (ttsReady && tts != null) {
            try {
                koreanVoice = tts.isLanguageAvailable(Locale.KOREA) >= TextToSpeech.LANG_AVAILABLE;
                englishVoice = tts.isLanguageAvailable(Locale.US) >= TextToSpeech.LANG_AVAILABLE;
            } catch (RuntimeException ignored) { }
        }
        return object("platform", "android", "speechAvailable", available || local,
            "onDeviceSpeechAvailable", local, "ttsReady", ttsReady,
            "translationReady", translationReady, "inkReady", inkReady, "version", version,
            "koreanVoiceAvailable", koreanVoice, "englishVoiceAvailable", englishVoice);
    }

    private void refreshModelState(Runnable after) {
        if (destroyed) return;
        boolean background = after == null;
        if (background && backgroundModelRefreshInFlight) return;
        if (modelManager == null) {
            translationReady = false;
            inkReady = false;
            if (after != null) after.run();
            return;
        }
        // Explicit service actions always check afresh, especially after a model download.
        if (background) backgroundModelRefreshInFlight = true;
        long serial = ++modelRefreshSerial;
        Task<Boolean> translation = downloaded(translationModel);
        Task<Boolean> handwriting = downloaded(inkModel);
        Tasks.whenAllComplete(translation, handwriting).addOnCompleteListener(ignored -> {
            if (destroyed) return;
            if (background) backgroundModelRefreshInFlight = false;
            // A slow earlier check must not overwrite a newer completed readiness check.
            if (serial >= appliedModelRefreshSerial) {
                appliedModelRefreshSerial = serial;
                translationReady = enKo != null && koEn != null && translation.isSuccessful()
                    && Boolean.TRUE.equals(translation.getResult());
                inkReady = inkRecognizer != null && handwriting.isSuccessful()
                    && Boolean.TRUE.equals(handwriting.getResult());
                emitModelStatus(preparingRequestId == null ? "checked" : "downloading");
                emit("capabilities", capabilities());
            }
            if (after != null) after.run();
        });
    }

    private Task<Boolean> downloaded(RemoteModel model) {
        if (model == null || modelManager == null) return Tasks.forResult(false);
        try { return modelManager.isModelDownloaded(model); }
        catch (RuntimeException unavailable) { return Tasks.forResult(false); }
    }

    private void emitModelStatus(String status) {
        emit("modelStatus", object("status", status,
            "translationReady", translationReady, "inkReady", inkReady));
    }

    private void prepareModels(String id, JSONObject payload) throws JSONException {
        String which = payload.optString("which", "all");
        if (!"translation".equals(which) && !"ink".equals(which) && !"all".equals(which))
            throw new IllegalArgumentException("Unknown model selection");
        if (preparingRequestId != null) {
            fail(id, "BUSY", "Language models are already being prepared. Please wait.");
            return;
        }
        boolean translation = !"ink".equals(which);
        boolean handwriting = !"translation".equals(which);
        if (modelManager == null || (translation && (enKo == null || koEn == null))
            || (handwriting && inkModel == null)) {
            fail(id, "SERVICE_UNAVAILABLE", "Language tools could not start. Please reopen the app.");
            return;
        }
        DownloadConditions.Builder builder = new DownloadConditions.Builder();
        if (payload.optBoolean("wifiOnly", false)) builder.requireWifi();
        DownloadConditions conditions = builder.build();
        preparingRequestId = id;
        emitModelStatus("downloading");
        List<Task<Void>> downloads = new ArrayList<>();
        if (translation) {
            downloads.add(enKo.downloadModelIfNeeded(conditions));
            downloads.add(koEn.downloadModelIfNeeded(conditions));
        }
        if (handwriting) downloads.add(modelManager.download(inkModel, conditions));
        Tasks.whenAll(downloads).addOnCompleteListener(done -> {
            if (destroyed) return;
            if (id.equals(preparingRequestId)) preparingRequestId = null;
            refreshModelState(() -> {
                if (done.isSuccessful() && (!translation || translationReady) && (!handwriting || inkReady)) {
                    emitModelStatus("ready");
                    succeed(id, object("ready", true, "translationReady", translationReady,
                        "inkReady", inkReady));
                } else {
                    emitModelStatus("error");
                    fail(id, "MODEL_DOWNLOAD_FAILED",
                        "The language models could not be downloaded. Check your connection and try again."
                            + (payload.optBoolean("wifiOnly", false) ? " Wi-Fi is required for this download." : ""));
                }
            });
        });
    }

    private void translate(String id, JSONObject payload) throws JSONException {
        String text = requiredText(payload, "text", MAX_TEXT_CHARS);
        String source = payload.optString("source", "en");
        String target = payload.optString("target", "ko");
        if (!("en".equals(source) || "ko".equals(source))
            || !("en".equals(target) || "ko".equals(target))) throw new IllegalArgumentException("Language");
        if (source.equals(target)) {
            succeed(id, object("text", text));
            return;
        }
        refreshModelState(() -> {
            if (!pending.containsKey(id)) return;
            if (!translationReady) {
                fail(id, "MODEL_REQUIRED", "Download the Korean translation model in Settings first.");
                return;
            }
            Translator translator = "en".equals(source) ? enKo : koEn;
            try {
                translator.translate(text)
                    .addOnSuccessListener(output -> succeed(id, object("text", output)))
                    .addOnFailureListener(error -> fail(id, "TRANSLATION_FAILED",
                        "The translation could not be completed. Try again or prepare the language models again."));
            } catch (RuntimeException unavailable) {
                fail(id, "TRANSLATION_FAILED", "The translation service could not start. Please reopen the app.");
            }
        });
    }

    private void recognizeInk(String id, JSONObject payload) throws JSONException {
        JSONArray strokes = payload.getJSONArray("strokes");
        if (strokes.length() == 0 || strokes.length() > 200) throw new IllegalArgumentException("Strokes");
        float width = finiteFloat(payload.getDouble("width"));
        float height = finiteFloat(payload.getDouble("height"));
        if (width <= 0 || height <= 0 || width > 10000 || height > 10000)
            throw new IllegalArgumentException("Writing area");
        Ink.Builder ink = Ink.builder();
        int points = 0;
        int nonempty = 0;
        for (int i = 0; i < strokes.length(); i++) {
            JSONArray path = strokes.getJSONArray(i);
            if (path.length() == 0) continue;
            Ink.Stroke.Builder stroke = Ink.Stroke.builder();
            for (int j = 0; j < path.length(); j++) {
                if (++points > 20000) throw new IllegalArgumentException("Too many points");
                JSONObject point = path.getJSONObject(j);
                float x = finiteFloat(point.getDouble("x"));
                float y = finiteFloat(point.getDouble("y"));
                if (Math.abs(x) > 100000 || Math.abs(y) > 100000)
                    throw new IllegalArgumentException("Point outside bounds");
                if (point.has("t") && !point.isNull("t")) {
                    stroke.addPoint(Ink.Point.create(x, y, point.getLong("t")));
                } else {
                    stroke.addPoint(Ink.Point.create(x, y));
                }
            }
            ink.addStroke(stroke.build());
            nonempty++;
        }
        if (nonempty == 0) throw new IllegalArgumentException("Empty drawing");
        final Ink drawing;
        final RecognitionContext context;
        try {
            drawing = ink.build();
            // SDK 19 requires preContext even for a standalone drawing. Do not
            // pass the exercise's expected answer as recognition context.
            context = RecognitionContext.builder()
                .setPreContext("")
                .setWritingArea(new WritingArea(width, height)).build();
        } catch (RuntimeException unavailable) {
            fail(id, "INK_SETUP_FAILED",
                "The handwriting service could not prepare this drawing. Reopen the app and try again.");
            return;
        }
        refreshModelState(() -> {
            if (!pending.containsKey(id)) return;
            if (!inkReady) {
                fail(id, "MODEL_REQUIRED", "Download the Korean handwriting model in Settings first.");
                return;
            }
            try {
                inkRecognizer.recognize(drawing, context)
                    .addOnSuccessListener(result -> {
                        JSONArray candidates = new JSONArray();
                        for (RecognitionCandidate candidate : result.getCandidates()) {
                            if (candidates.length() == 5) break;
                            candidates.put(candidate.getText());
                        }
                        succeed(id, object("candidates", candidates));
                    })
                    .addOnFailureListener(error -> fail(id, "INK_RECOGNITION_FAILED",
                        "The handwriting service could not read this drawing. Try again. If it keeps failing, prepare the Korean handwriting model in Settings."));
            } catch (RuntimeException unavailable) {
                fail(id, "INK_RECOGNITION_FAILED", "The handwriting service could not start. Please reopen the app.");
            }
        });
    }

    private void speak(String id, JSONObject payload) throws JSONException {
        String text = requiredText(payload, "text", Math.min(MAX_TEXT_CHARS, TextToSpeech.getMaxSpeechInputLength()));
        String language = speechLanguage(payload);
        float rate = finiteFloat(payload.optDouble("rate", 0.85));
        if (rate < 0.3f || rate > 2.0f) throw new IllegalArgumentException("Speech rate");
        if (!ttsReady || tts == null) {
            fail(id, "TTS_NOT_READY", "The phone's voice service is not ready. Check Speech settings and try again.");
            return;
        }
        if (speechRequestId != null || microphoneRequestId != null) {
            fail(id, "BUSY", "Finish the microphone recording before playing a voice.");
            return;
        }
        Locale locale = Locale.forLanguageTag(language);
        int supported = tts.isLanguageAvailable(locale);
        if (supported < TextToSpeech.LANG_AVAILABLE || tts.setLanguage(locale) < TextToSpeech.LANG_AVAILABLE) {
            fail(id, "VOICE_REQUIRED", "Install a " + ("ko-KR".equals(language) ? "Korean" : "English")
                + " voice in your phone's text-to-speech settings.");
            return;
        }
        // Prefer an installed local voice. The selected provider may offer only network voices.
        Voice selected = null;
        Set<Voice> voices = tts.getVoices();
        if (voices != null) {
            for (Voice voice : voices) {
                if (voice.getLocale().getLanguage().equals(locale.getLanguage())
                    && !voice.isNetworkConnectionRequired()
                    && (voice.getFeatures() == null
                        || !voice.getFeatures().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED))
                    && (selected == null || voice.getQuality() > selected.getQuality())) selected = voice;
            }
        }
        if (selected != null) tts.setVoice(selected);
        Voice actual = tts.getVoice();
        boolean mayUseNetwork = actual == null || actual.isNetworkConnectionRequired();
        tts.setSpeechRate(rate);
        int queued = tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, id);
        if (queued == TextToSpeech.ERROR) {
            fail(id, "TTS_ERROR", "The phone could not play that voice. Check Speech settings.");
        } else {
            succeed(id, object("started", true, "status", "queued", "mayUseNetwork", mayUseNetwork));
        }
    }

    private void listen(String id, JSONObject payload) throws JSONException {
        speechLanguage(payload); // Validate before asking for permission.
        if (speechRequestId != null || microphoneRequestId != null) {
            fail(id, "BUSY", "A microphone recording is already in progress.");
            return;
        }
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            microphoneRequestId = id;
            microphonePayload = payload;
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, MICROPHONE_REQUEST);
            return;
        }
        startListening(id, payload);
    }

    private void startListening(String id, JSONObject payload) {
        if (!pending.containsKey(id) || destroyed) return;
        if (tts != null) tts.stop();
        speechRequestId = id;
        speechLanguage = speechLanguage(payload);
        speechPreferOffline = payload.optBoolean("preferOffline", true);
        speechFallbackTried = false;
        try {
            boolean local = Build.VERSION.SDK_INT >= 31
                && SpeechRecognizer.isOnDeviceRecognitionAvailable(this);
            startRecognizer(local);
        } catch (RuntimeException unavailable) {
            finishSpeechError("SPEECH_UNAVAILABLE", "The phone's speech service could not start. Check Speech settings.");
        }
    }

    private void startRecognizer(boolean local) {
        if (speechRequestId == null || destroyed) return;
        disposeRecognizer();
        speechUsesOnDevice = local;
        final int generation = speechGeneration;
        try {
            if (local && Build.VERSION.SDK_INT >= 31) {
                speech = SpeechRecognizer.createOnDeviceSpeechRecognizer(this);
            } else {
                if (!SpeechRecognizer.isRecognitionAvailable(this)) {
                    finishSpeechError("SPEECH_UNAVAILABLE", "No speech recognition service is installed on this phone.");
                    return;
                }
                speech = SpeechRecognizer.createSpeechRecognizer(this);
            }
            speech.setRecognitionListener(new RecognitionListener() {
                private boolean current() {
                    return !destroyed && generation == speechGeneration && speechRequestId != null;
                }
                @Override public void onReadyForSpeech(Bundle params) {
                    if (current()) emitListening(true);
                }
                @Override public void onBeginningOfSpeech() { }
                @Override public void onRmsChanged(float rmsdB) { }
                @Override public void onBufferReceived(byte[] buffer) { }
                @Override public void onEndOfSpeech() {
                    if (current()) emitListening(false);
                }
                @Override public void onError(int code) {
                    if (!current()) return;
                    if (speechUsesOnDevice && !speechFallbackTried
                        && (code == SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED
                            || code == SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE)) {
                        speechFallbackTried = true;
                        // The local language is missing. Let the default provider
                        // use its available engines; keeping offline-only here
                        // can repeat the same missing-language failure.
                        speechPreferOffline = false;
                        startRecognizer(false);
                        return;
                    }
                    finishSpeechError(speechErrorCode(code), speechErrorMessage(code));
                }
                @Override public void onResults(Bundle results) {
                    if (!current()) return;
                    ArrayList<String> raw = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    JSONArray alternatives = new JSONArray();
                    if (raw != null) {
                        for (String item : raw) {
                            if (item != null && !item.trim().isEmpty() && alternatives.length() < 5)
                                alternatives.put(item.substring(0, Math.min(item.length(), MAX_TEXT_CHARS)));
                        }
                    }
                    if (alternatives.length() == 0) {
                        finishSpeechError("NO_MATCH", "No words were recognized. Try speaking again.");
                        return;
                    }
                    String resultId = speechRequestId;
                    boolean wasLocal = speechUsesOnDevice;
                    clearSpeech();
                    succeed(resultId, object("alternatives", alternatives,
                        "text", alternatives.optString(0), "onDevice", wasLocal,
                        "mayUseNetwork", !wasLocal));
                }
                @Override public void onPartialResults(Bundle partial) {
                    if (!current()) return;
                    ArrayList<String> parts = partial.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    if (parts != null && !parts.isEmpty()) emit("speechPartial", object("text", parts.get(0)));
                }
                @Override public void onEvent(int eventType, Bundle params) { }
            });
            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE, speechLanguage)
                .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5)
                .putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                .putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, speechPreferOffline);
            emitListening(true);
            speech.startListening(intent);
        } catch (RuntimeException unavailable) {
            if (local && !speechFallbackTried) {
                speechFallbackTried = true;
                startRecognizer(false);
            } else {
                finishSpeechError("SPEECH_UNAVAILABLE", "The phone's speech service could not start. Check Speech settings.");
            }
        }
    }

    private void emitListening(boolean active) {
        emit("listening", object("active", active, "onDevice", speechUsesOnDevice,
            "mayUseNetwork", !speechUsesOnDevice));
    }

    private void stopListening(String id) {
        if (microphoneRequestId != null) {
            fail(microphoneRequestId, "CANCELLED", "Microphone recording was cancelled.");
        }
        if (speech != null && speechRequestId != null) {
            try { speech.stopListening(); }
            catch (RuntimeException error) {
                finishSpeechError("CANCELLED", "Microphone recording stopped.");
            }
        }
        emitListening(false);
        succeed(id, object("stopped", true));
    }

    private void disposeRecognizer() {
        speechGeneration++;
        SpeechRecognizer old = speech;
        speech = null;
        if (old != null) {
            try { old.cancel(); } catch (RuntimeException ignored) { }
            try { old.destroy(); } catch (RuntimeException ignored) { }
        }
    }

    private void clearSpeech() {
        speechRequestId = null;
        disposeRecognizer();
        emitListening(false);
    }

    private void finishSpeechError(String code, String message) {
        String id = speechRequestId;
        clearSpeech();
        if (id != null) fail(id, code, message);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode != MICROPHONE_REQUEST) return;
        String id = microphoneRequestId;
        JSONObject payload = microphonePayload;
        microphoneRequestId = null;
        microphonePayload = null;
        if (id == null || !pending.containsKey(id)) return;
        if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) {
            startListening(id, payload == null ? new JSONObject() : payload);
        } else {
            fail(id, "PERMISSION_DENIED", "Microphone access is off. Allow it in Android app settings to use voice input.");
        }
    }

    private static String speechErrorCode(int code) {
        switch (code) {
            case SpeechRecognizer.ERROR_NO_MATCH: return "NO_MATCH";
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT: return "SPEECH_TIMEOUT";
            case SpeechRecognizer.ERROR_NETWORK:
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT: return "SPEECH_NETWORK_ERROR";
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS: return "PERMISSION_DENIED";
            case SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED: return "LANGUAGE_NOT_SUPPORTED";
            case SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE: return "SPEECH_MODEL_REQUIRED";
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY: return "BUSY";
            default: return "SPEECH_ERROR";
        }
    }

    private static String speechErrorMessage(int code) {
        switch (code) {
            case SpeechRecognizer.ERROR_NO_MATCH: return "No words were recognized. Try speaking again.";
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT: return "No speech was detected. Tap the microphone and try again.";
            case SpeechRecognizer.ERROR_NETWORK:
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
                return "The phone's speech provider needs a connection or an installed offline language. Check Speech settings.";
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                return "Microphone access is off. Allow microphone access in Android app settings.";
            case SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED:
                return "The phone's speech service does not support this language. Check Speech settings.";
            case SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE:
                return "Install this speech language in the phone's Speech settings, then try again.";
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY:
                return "The phone's speech service is busy. Wait a moment and try again.";
            case SpeechRecognizer.ERROR_AUDIO:
                return "The microphone could not record. Close any other app using it and try again.";
            default: return "The phone's speech service stopped. Please try again.";
        }
    }

    private void exportBackup(String id, JSONObject payload) throws JSONException {
        if (!documentSlotAvailable(id)) return;
        String content = requiredText(payload, "content", MAX_BACKUP_BYTES);
        if (content.getBytes(StandardCharsets.UTF_8).length > MAX_BACKUP_BYTES) {
            fail(id, "FILE_TOO_LARGE", "Backups must be smaller than 4 MB.");
            return;
        }
        String name = payload.optString("name", "pocket-lab-backup.json")
            .replaceAll("[\\p{Cntrl}\\\\/:*?\"<>|]", "-").trim();
        if (name.isEmpty()) name = "pocket-lab-backup.json";
        if (name.length() > 100) name = name.substring(0, 100);
        if (!name.toLowerCase(Locale.ROOT).endsWith(".json")) name += ".json";
        documentRequestId = id;
        documentContent = content;
        documentName = name;
        try {
            startActivityForResult(new Intent(Intent.ACTION_CREATE_DOCUMENT)
                .addCategory(Intent.CATEGORY_OPENABLE).setType("application/json")
                .putExtra(Intent.EXTRA_TITLE, name), EXPORT_REQUEST);
        } catch (ActivityNotFoundException missing) {
            fail(id, "FILE_PICKER_UNAVAILABLE", "No document picker is installed on this phone.");
        }
    }

    private void importBackup(String id) {
        if (!documentSlotAvailable(id)) return;
        documentRequestId = id;
        documentContent = null;
        documentName = null;
        try {
            startActivityForResult(new Intent(Intent.ACTION_OPEN_DOCUMENT)
                .addCategory(Intent.CATEGORY_OPENABLE).setType("*/*")
                .putExtra(Intent.EXTRA_MIME_TYPES,
                    new String[]{"application/json", "text/plain", "application/octet-stream"}), IMPORT_REQUEST);
        } catch (ActivityNotFoundException missing) {
            fail(id, "FILE_PICKER_UNAVAILABLE", "No document picker is installed on this phone.");
        }
    }

    private boolean documentSlotAvailable(String id) {
        if (documentRequestId == null) return true;
        fail(id, "BUSY", "Finish the current file selection first.");
        return false;
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != EXPORT_REQUEST && requestCode != IMPORT_REQUEST) return;
        String id = documentRequestId;
        String content = documentContent;
        String name = documentName;
        clearDocumentRequest();
        if (id == null || !pending.containsKey(id)) return;
        Uri uri = data == null ? null : data.getData();
        if (resultCode != RESULT_OK || uri == null) {
            fail(id, "CANCELLED", "File selection was cancelled.");
            return;
        }
        files.execute(() -> {
            if (requestCode == EXPORT_REQUEST) {
                try {
                    try (OutputStream output = getContentResolver().openOutputStream(uri, "wt")) {
                        if (output == null || content == null) throw new IOException("No output stream");
                        output.write(content.getBytes(StandardCharsets.UTF_8));
                        output.flush();
                    }
                    onMain(() -> succeed(id, object("saved", true, "name", name)));
                } catch (IOException | SecurityException error) {
                    onMain(() -> fail(id, "FILE_WRITE_FAILED", "The backup could not be saved. Try another location."));
                }
            } else {
                try (InputStream input = getContentResolver().openInputStream(uri)) {
                    if (input == null) throw new IOException("No input stream");
                    ByteArrayOutputStream buffer = new ByteArrayOutputStream();
                    byte[] chunk = new byte[8192];
                    int count;
                    while ((count = input.read(chunk)) != -1) {
                        if (buffer.size() + count > MAX_BACKUP_BYTES) {
                            onMain(() -> fail(id, "FILE_TOO_LARGE", "Choose a backup smaller than 4 MB."));
                            return;
                        }
                        buffer.write(chunk, 0, count);
                    }
                    String decoded = StandardCharsets.UTF_8.newDecoder()
                        .onMalformedInput(CodingErrorAction.REPORT)
                        .onUnmappableCharacter(CodingErrorAction.REPORT)
                        .decode(ByteBuffer.wrap(buffer.toByteArray())).toString();
                    final String result = decoded.startsWith("\uFEFF") ? decoded.substring(1) : decoded;
                    onMain(() -> succeed(id, object("content", result)));
                } catch (IOException | SecurityException error) {
                    onMain(() -> fail(id, "FILE_READ_FAILED", "This file could not be read. Choose a UTF-8 JSON backup."));
                }
            }
        });
    }

    private void clearDocumentRequest() {
        documentRequestId = null;
        documentContent = null;
        documentName = null;
    }

    private void openSpeechSettings(String id, JSONObject payload) {
        String kind = payload.optString("kind", "speech");
        Intent intent;
        if ("microphone".equals(kind)) {
            intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.parse("package:" + getPackageName()));
        } else if ("tts".equals(kind)) {
            intent = new Intent("com.android.settings.TTS_SETTINGS");
        } else {
            intent = new Intent(Settings.ACTION_VOICE_INPUT_SETTINGS);
        }
        try {
            startActivity(intent);
            succeed(id, object("opened", true));
        } catch (ActivityNotFoundException unavailable) {
            try {
                startActivity(new Intent(Settings.ACTION_SETTINGS));
                succeed(id, object("opened", true));
            } catch (ActivityNotFoundException missing) {
                fail(id, "SETTINGS_UNAVAILABLE", "Open Speech or Text-to-speech in your phone's Android settings.");
            }
        }
    }

    private static String requiredText(JSONObject payload, String key, int maximum) throws JSONException {
        Object value = payload.get(key);
        if (!(value instanceof String)) throw new IllegalArgumentException("Text required");
        String text = (String) value;
        if (text.trim().isEmpty() || text.length() > maximum) throw new IllegalArgumentException("Text length");
        return text;
    }

    private static String speechLanguage(JSONObject payload) {
        String language = payload.optString("lang", "ko-KR");
        if ("ko".equals(language)) return "ko-KR";
        if ("en".equals(language)) return "en-US";
        if (!"ko-KR".equals(language) && !"en-US".equals(language))
            throw new IllegalArgumentException("Unsupported speech language");
        return language;
    }

    private static float finiteFloat(double value) {
        if (!Double.isFinite(value) || value > Float.MAX_VALUE || value < -Float.MAX_VALUE)
            throw new IllegalArgumentException("Invalid number");
        return (float) value;
    }

    private void succeed(String id, JSONObject data) {
        complete(id, true, data, null, null);
    }

    private void fail(String id, String code, String message) {
        complete(id, false, null, code, message);
    }

    private void complete(String id, boolean ok, JSONObject data, String code, String message) {
        if (Looper.myLooper() != Looper.getMainLooper()) {
            onMain(() -> complete(id, ok, data, code, message));
            return;
        }
        PendingRequest request = pending.remove(id);
        if (request == null) return;
        main.removeCallbacks(request.deadline);
        if (id.equals(microphoneRequestId)) {
            microphoneRequestId = null;
            microphonePayload = null;
        }
        if (id.equals(speechRequestId)) clearSpeech();
        if (id.equals(documentRequestId)) clearDocumentRequest();
        if (id.equals(preparingRequestId)) preparingRequestId = null;
        sendResult(id, ok, data, code, message);
    }

    private void sendResult(String id, boolean ok, JSONObject data, String code, String message) {
        JSONObject result = object("id", id, "ok", ok, "data", data == null ? new JSONObject() : data);
        if (!ok) {
            try { result.put("error", object("code", code, "message", message)); }
            catch (JSONException impossible) { throw new IllegalStateException(impossible); }
        }
        runCallback("window.__pocketNativeResult", result);
    }

    private void emit(String type, JSONObject data) {
        if (destroyed || !pageReady) return;
        runCallback("window.__pocketNativeEvent", object("type", type, "data", data));
    }

    private void runCallback(String function, JSONObject value) {
        if (destroyed) return;
        String json = value.toString().replace("\u2028", "\\u2028").replace("\u2029", "\\u2029");
        String script = "if(typeof " + function + "==='function'){" + function + "(" + json + ");}";
        if (!pageReady) pageCallbacks.addLast(script);
        else evaluate(script);
    }

    private void evaluate(String script) {
        if (!destroyed && web != null) web.evaluateJavascript(script, null);
    }

    private static JSONObject object(Object... values) {
        JSONObject result = new JSONObject();
        try {
            for (int i = 0; i < values.length; i += 2) {
                result.put((String) values[i], values[i + 1] == null ? JSONObject.NULL : values[i + 1]);
            }
        } catch (JSONException impossible) {
            throw new IllegalArgumentException(impossible);
        }
        return result;
    }

    private void onMain(Runnable action) {
        if (destroyed) return;
        if (Looper.myLooper() == Looper.getMainLooper()) action.run();
        else main.post(() -> { if (!destroyed) action.run(); });
    }

    @Override
    public void onBackPressed() {
        handleBack();
    }

    private void handleBack() {
        if (handlingBack || destroyed) return;
        if (web == null || !pageReady) {
            finish();
            return;
        }
        handlingBack = true;
        web.evaluateJavascript("(function(){try{return !!(window.pocketBack && window.pocketBack());}"
            + "catch(error){return false;}})()", result -> {
                handlingBack = false;
                if (!destroyed && !"true".equals(result)) finish();
            });
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
        if (tts != null) emit("capabilities", capabilities());
    }

    @Override
    protected void onStop() {
        if (microphoneRequestId != null)
            fail(microphoneRequestId, "CANCELLED", "Recording was cancelled because the app moved to the background.");
        if (speechRequestId != null)
            finishSpeechError("CANCELLED", "Recording stopped because the app moved to the background.");
        if (tts != null) tts.stop();
        if (web != null) web.onPause();
        super.onStop();
    }

    @Override
    protected void onDestroy() {
        if (Build.VERSION.SDK_INT >= 33 && backCallback != null)
            getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback(backCallback);
        for (String id : new ArrayList<>(pending.keySet()))
            fail(id, "CANCELLED", "The app closed before this action finished.");
        disposeRecognizer();
        if (tts != null) {
            tts.stop();
            tts.shutdown();
        }
        if (enKo != null) enKo.close();
        if (koEn != null) koEn.close();
        if (inkRecognizer != null) inkRecognizer.close();
        destroyed = true;
        files.shutdownNow();
        main.removeCallbacksAndMessages(null);
        pageCallbacks.clear();
        if (web != null) {
            web.removeJavascriptInterface("PocketNative");
            web.stopLoading();
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    private static final class PendingRequest {
        final Runnable deadline;
        PendingRequest(Runnable deadline) { this.deadline = deadline; }
    }
}

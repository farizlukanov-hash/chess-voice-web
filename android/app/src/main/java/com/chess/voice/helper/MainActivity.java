package com.chess.voice.helper;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebView;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

import java.util.ArrayList;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";
    private static final int REQUEST_RECORD_AUDIO = 1;
    private SpeechRecognizer speechRecognizer;
    private boolean isListening = false;
    private WebView webView;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Log.d(TAG, "MainActivity onCreate started");
    }

    @Override
    public void onStart() {
        super.onStart();

        // Добавляем JavaScript интерфейс после того как WebView готов
        webView = getBridge().getWebView();
        if (webView != null) {
            // ВАЖНО: Разрешаем WebView использовать микрофон
            webView.setWebChromeClient(new WebChromeClient() {
                @Override
                public void onPermissionRequest(final PermissionRequest request) {
                    Log.d(TAG, "WebView permission request: " + request.getResources()[0]);
                    // Автоматически разрешаем доступ к микрофону
                    runOnUiThread(() -> {
                        request.grant(request.getResources());
                        Log.d(TAG, "Permission granted to WebView");
                    });
                }
            });

            webView.addJavascriptInterface(new WebAppInterface(), "AndroidVoice");
            Log.d(TAG, "AndroidVoice interface added to WebView");
        } else {
            Log.e(TAG, "WebView is null!");
        }
    }

    public class WebAppInterface {
        @JavascriptInterface
        public void startRecognition() {
            Log.d(TAG, "startRecognition called from JS");

            runOnUiThread(() -> {
                // Проверяем разрешение
                if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.RECORD_AUDIO)
                        != PackageManager.PERMISSION_GRANTED) {
                    ActivityCompat.requestPermissions(MainActivity.this,
                            new String[]{Manifest.permission.RECORD_AUDIO}, REQUEST_RECORD_AUDIO);
                    return;
                }

                if (!SpeechRecognizer.isRecognitionAvailable(MainActivity.this)) {
                    sendToJS("onError", "Speech recognition not available");
                    return;
                }

                if (speechRecognizer == null) {
                    speechRecognizer = SpeechRecognizer.createSpeechRecognizer(MainActivity.this);
                    speechRecognizer.setRecognitionListener(new RecognitionListener() {
                        @Override
                        public void onReadyForSpeech(Bundle params) {
                            Log.d(TAG, "onReadyForSpeech");
                            sendToJS("onReady", "");
                        }

                        @Override
                        public void onBeginningOfSpeech() {
                            Log.d(TAG, "onBeginningOfSpeech");
                        }

                        @Override
                        public void onRmsChanged(float rmsdB) {}

                        @Override
                        public void onBufferReceived(byte[] buffer) {}

                        @Override
                        public void onEndOfSpeech() {
                            Log.d(TAG, "onEndOfSpeech");
                        }

                        @Override
                        public void onError(int error) {
                            Log.e(TAG, "onError: " + error);
                            if (isListening) {
                                runOnUiThread(() -> {
                                    try {
                                        Thread.sleep(100);
                                        startListening();
                                    } catch (Exception e) {
                                        Log.e(TAG, "Error restarting: " + e.getMessage());
                                    }
                                });
                            }
                        }

                        @Override
                        public void onResults(Bundle results) {
                            Log.d(TAG, "onResults");
                            ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);

                            if (matches != null && !matches.isEmpty()) {
                                String text = matches.get(0);
                                Log.d(TAG, "Recognized: " + text);
                                sendToJS("onResult", text);
                            }

                            if (isListening) {
                                runOnUiThread(() -> {
                                    try {
                                        Thread.sleep(100);
                                        startListening();
                                    } catch (Exception e) {
                                        Log.e(TAG, "Error restarting: " + e.getMessage());
                                    }
                                });
                            }
                        }

                        @Override
                        public void onPartialResults(Bundle partialResults) {}

                        @Override
                        public void onEvent(int eventType, Bundle params) {}
                    });
                }

                isListening = true;
                startListening();
            });
        }

        @JavascriptInterface
        public void stopRecognition() {
            Log.d(TAG, "stopRecognition called from JS");
            runOnUiThread(() -> {
                isListening = false;
                if (speechRecognizer != null) {
                    speechRecognizer.stopListening();
                    speechRecognizer.destroy();
                    speechRecognizer = null;
                }
            });
        }
    }

    private void startListening() {
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ru-RU");
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false);

        speechRecognizer.startListening(intent);
        Log.d(TAG, "startListening called");
    }

    private void sendToJS(String event, String data) {
        Log.d(TAG, "sendToJS called: event=" + event + ", data=" + data);
        runOnUiThread(() -> {
            if (webView == null) {
                Log.e(TAG, "WebView is null in sendToJS!");
                return;
            }
            String js = String.format("window.dispatchEvent(new CustomEvent('androidVoice', {detail: {event: '%s', data: '%s'}}))",
                    event, data.replace("'", "\\'"));
            Log.d(TAG, "Executing JS: " + js);
            webView.evaluateJavascript(js, result -> {
                Log.d(TAG, "JS executed, result: " + result);
            });
        });
    }
}

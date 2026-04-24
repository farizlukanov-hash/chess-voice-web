package com.chess.voice.helper;

import android.Manifest;
import android.content.Intent;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import java.util.ArrayList;
import java.util.Locale;

@CapacitorPlugin(
    name = "VoiceRecognition",
    permissions = {
        @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "audio")
    }
)
public class VoiceRecognitionPlugin extends Plugin {
    private static final String TAG = "VoiceRecognition";
    private SpeechRecognizer speechRecognizer;
    private boolean isListening = false;

    @PluginMethod
    public void start(PluginCall call) {
        Log.d(TAG, "start() called");

        if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
            call.reject("Speech recognition not available");
            return;
        }

        if (speechRecognizer == null) {
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
            speechRecognizer.setRecognitionListener(new RecognitionListener() {
                @Override
                public void onReadyForSpeech(Bundle params) {
                    Log.d(TAG, "onReadyForSpeech");
                    JSObject ret = new JSObject();
                    ret.put("event", "ready");
                    notifyListeners("recognitionEvent", ret);
                }

                @Override
                public void onBeginningOfSpeech() {
                    Log.d(TAG, "onBeginningOfSpeech");
                }

                @Override
                public void onRmsChanged(float rmsdB) {
                    // Ignore
                }

                @Override
                public void onBufferReceived(byte[] buffer) {
                    // Ignore
                }

                @Override
                public void onEndOfSpeech() {
                    Log.d(TAG, "onEndOfSpeech");
                }

                @Override
                public void onError(int error) {
                    Log.e(TAG, "onError: " + error);

                    // Автоматически перезапускаем при ошибках
                    if (isListening) {
                        getActivity().runOnUiThread(() -> {
                            try {
                                Thread.sleep(100);
                                startRecognition();
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

                        JSObject ret = new JSObject();
                        ret.put("text", text);
                        notifyListeners("recognitionResult", ret);
                    }

                    // Автоматически перезапускаем
                    if (isListening) {
                        getActivity().runOnUiThread(() -> {
                            try {
                                Thread.sleep(100);
                                startRecognition();
                            } catch (Exception e) {
                                Log.e(TAG, "Error restarting: " + e.getMessage());
                            }
                        });
                    }
                }

                @Override
                public void onPartialResults(Bundle partialResults) {
                    // Ignore
                }

                @Override
                public void onEvent(int eventType, Bundle params) {
                    // Ignore
                }
            });
        }

        isListening = true;
        startRecognition();
        call.resolve();
    }

    private void startRecognition() {
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ru-RU");
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false);

        speechRecognizer.startListening(intent);
        Log.d(TAG, "startListening called");
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Log.d(TAG, "stop() called");
        isListening = false;

        if (speechRecognizer != null) {
            speechRecognizer.stopListening();
            speechRecognizer.destroy();
            speechRecognizer = null;
        }

        call.resolve();
    }
}

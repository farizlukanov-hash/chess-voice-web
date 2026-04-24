import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { Capacitor } from '@capacitor/core';

export class CapacitorSpeechManager {
  constructor() {
    this.isListening = false;
    this.onResultCallback = null;
    this.onErrorCallback = null;
    this.isNative = Capacitor.isNativePlatform();
    this.listeners = [];
  }

  async checkPermissions() {
    if (!this.isNative) return true;

    try {
      const { speechRecognition } = await SpeechRecognition.checkPermissions();
      console.log('[CapacitorSpeech] Текущие разрешения:', speechRecognition);

      if (speechRecognition === 'prompt' || speechRecognition === 'prompt-with-rationale') {
        console.log('[CapacitorSpeech] Запрашиваю разрешения...');
        const result = await SpeechRecognition.requestPermissions();
        console.log('[CapacitorSpeech] Результат запроса:', result.speechRecognition);
        return result.speechRecognition === 'granted';
      }

      return speechRecognition === 'granted';
    } catch (error) {
      console.error('[CapacitorSpeech] Ошибка проверки разрешений:', error);
      return false;
    }
  }

  async start(onResult, onError) {
    console.log('[CapacitorSpeech] Запуск распознавания...');

    if (!this.isNative) {
      console.log('[CapacitorSpeech] Не нативная платформа');
      if (onError) onError('Not native platform');
      return false;
    }

    this.onResultCallback = onResult;
    this.onErrorCallback = onError;

    const hasPermission = await this.checkPermissions();
    if (!hasPermission) {
      console.error('[CapacitorSpeech] Нет разрешения на микрофон');
      if (onError) onError('Permission denied');
      return false;
    }

    try {
      // Удаляем старые слушатели
      this.removeAllListeners();

      // Добавляем слушатель результатов
      const matchesListener = await SpeechRecognition.addListener('partialResults', (data) => {
        console.log('[CapacitorSpeech] partialResults:', data);
        if (data.matches && data.matches.length > 0) {
          const text = data.matches[0];
          console.log('[CapacitorSpeech] Распознано:', text);
          if (this.onResultCallback) {
            this.onResultCallback(text);
          }
        }
      });
      this.listeners.push(matchesListener);

      // Добавляем слушатель состояния
      const stateListener = await SpeechRecognition.addListener('listeningState', (data) => {
        console.log('[CapacitorSpeech] Состояние:', data.status);
        if (data.status === 'stopped') {
          this.isListening = false;
          // Автоматически перезапускаем
          if (this.onResultCallback) {
            console.log('[CapacitorSpeech] Перезапускаю после остановки...');
            setTimeout(() => this.start(this.onResultCallback, this.onErrorCallback), 100);
          }
        } else if (data.status === 'started') {
          this.isListening = true;
        }
      });
      this.listeners.push(stateListener);

      // Запускаем распознавание
      await SpeechRecognition.start({
        language: 'ru-RU',
        maxResults: 1,
        prompt: 'Говорите...',
        partialResults: true,
        popup: false
      });

      console.log('[CapacitorSpeech] Распознавание запущено');
      return true;
    } catch (error) {
      console.error('[CapacitorSpeech] Ошибка запуска:', error);
      this.isListening = false;
      if (onError) onError(error.message);
      return false;
    }
  }

  async stop() {
    if (!this.isNative || !this.isListening) return;

    try {
      await SpeechRecognition.stop();
      this.isListening = false;
      this.onResultCallback = null;
      this.onErrorCallback = null;
      this.removeAllListeners();
      console.log('[CapacitorSpeech] Распознавание остановлено');
    } catch (error) {
      console.error('[CapacitorSpeech] Ошибка остановки:', error);
    }
  }

  removeAllListeners() {
    this.listeners.forEach(listener => {
      if (listener && listener.remove) {
        listener.remove();
      }
    });
    this.listeners = [];
  }
}

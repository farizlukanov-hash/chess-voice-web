import { createModel, createRecognizer } from 'vosk-browser';

export class VoskSpeechManager {
  constructor() {
    this.model = null;
    this.recognizer = null;
    this.mediaRecorder = null;
    this.audioContext = null;
    this.isListening = false;
    this.onResultCallback = null;
    this.onErrorCallback = null;
  }

  async initialize() {
    console.log('[Vosk] Инициализация...');

    try {
      // Загружаем модель
      const modelUrl = '/vosk-model-small-ru-0.22';
      console.log('[Vosk] Загружаю модель из:', modelUrl);

      this.model = await createModel(modelUrl);
      console.log('[Vosk] Модель загружена');

      // Создаем распознаватель
      this.recognizer = new this.model.KaldiRecognizer(16000);
      console.log('[Vosk] Распознаватель создан');

      return true;
    } catch (error) {
      console.error('[Vosk] Ошибка инициализации:', error);
      return false;
    }
  }

  async start(onResult, onError) {
    console.log('[Vosk] Запуск распознавания...');

    if (!this.model || !this.recognizer) {
      console.log('[Vosk] Модель не загружена, инициализирую...');
      const initialized = await this.initialize();
      if (!initialized) {
        if (onError) onError('Failed to initialize Vosk');
        return false;
      }
    }

    this.onResultCallback = onResult;
    this.onErrorCallback = onError;

    try {
      // Получаем доступ к микрофону
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        }
      });

      console.log('[Vosk] Микрофон получен');

      // Создаем AudioContext
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      const source = this.audioContext.createMediaStreamSource(stream);

      // Создаем ScriptProcessor для обработки аудио
      const processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (e) => {
        if (!this.isListening) return;

        const inputData = e.inputBuffer.getChannelData(0);

        // Конвертируем Float32Array в Int16Array для Vosk
        const int16Data = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Отправляем в распознаватель
        if (this.recognizer) {
          this.recognizer.acceptWaveform(int16Data);

          // Получаем частичный результат
          const result = this.recognizer.partialResult();
          if (result && result.partial) {
            console.log('[Vosk] Частичный результат:', result.partial);
          }

          // Получаем финальный результат
          const finalResult = this.recognizer.result();
          if (finalResult && finalResult.text && finalResult.text.trim()) {
            console.log('[Vosk] Финальный результат:', finalResult.text);
            if (this.onResultCallback) {
              this.onResultCallback(finalResult.text);
            }
          }
        }
      };

      source.connect(processor);
      processor.connect(this.audioContext.destination);

      this.isListening = true;
      this.mediaRecorder = { stream, processor, source };

      console.log('[Vosk] Распознавание запущено');
      return true;

    } catch (error) {
      console.error('[Vosk] Ошибка запуска:', error);
      if (onError) onError(error.message);
      return false;
    }
  }

  async stop() {
    console.log('[Vosk] Остановка распознавания...');

    this.isListening = false;

    if (this.mediaRecorder) {
      if (this.mediaRecorder.processor) {
        this.mediaRecorder.processor.disconnect();
      }
      if (this.mediaRecorder.source) {
        this.mediaRecorder.source.disconnect();
      }
      if (this.mediaRecorder.stream) {
        this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
      }
      this.mediaRecorder = null;
    }

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    console.log('[Vosk] Распознавание остановлено');
  }
}

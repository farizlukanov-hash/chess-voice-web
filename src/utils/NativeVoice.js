export class NativeVoiceRecognition {
  constructor() {
    this.isListening = false;
    this.onResultCallback = null;
    this.onErrorCallback = null;

    console.log('[NativeVoice] Constructor called');

    // Слушаем события от Android
    window.addEventListener('androidVoice', (event) => {
      console.log('[NativeVoice] Событие androidVoice:', event.detail);

      if (event.detail.event === 'onResult') {
        console.log('[NativeVoice] Результат:', event.detail.data);
        if (this.onResultCallback) {
          this.onResultCallback(event.detail.data);
        }
      } else if (event.detail.event === 'onError') {
        console.error('[NativeVoice] Ошибка:', event.detail.data);
        if (this.onErrorCallback) {
          this.onErrorCallback(event.detail.data);
        }
      } else if (event.detail.event === 'onReady') {
        console.log('[NativeVoice] Готов к распознаванию');
      }
    });

    console.log('[NativeVoice] Event listener added');
  }

  async start(onResult, onError) {
    console.log('[NativeVoice] start() method called');
    console.log('[NativeVoice] onResult:', typeof onResult);
    console.log('[NativeVoice] onError:', typeof onError);

    this.onResultCallback = onResult;
    this.onErrorCallback = onError;

    try {
      console.log('[NativeVoice] Checking window.AndroidVoice...');
      console.log('[NativeVoice] window.AndroidVoice:', typeof window.AndroidVoice);

      // Проверяем наличие Android интерфейса
      if (typeof window.AndroidVoice === 'undefined') {
        console.error('[NativeVoice] AndroidVoice не найден');
        if (onError) onError('AndroidVoice interface not found');
        return false;
      }

      console.log('[NativeVoice] AndroidVoice найден, вызываю startRecognition()...');

      // Вызываем нативный метод
      window.AndroidVoice.startRecognition();

      console.log('[NativeVoice] startRecognition() вызван успешно');

      this.isListening = true;

      console.log('[NativeVoice] Распознавание запущено');
      return true;
    } catch (error) {
      console.error('[NativeVoice] Ошибка запуска:', error);
      console.error('[NativeVoice] Error name:', error.name);
      console.error('[NativeVoice] Error message:', error.message);
      console.error('[NativeVoice] Error stack:', error.stack);
      if (onError) onError(error.message);
      return false;
    }
  }

  async stop() {
    console.log('[NativeVoice] Остановка распознавания...');

    this.isListening = false;
    this.onResultCallback = null;
    this.onErrorCallback = null;

    try {
      if (typeof window.AndroidVoice !== 'undefined') {
        window.AndroidVoice.stopRecognition();
      }
      console.log('[NativeVoice] Распознавание остановлено');
    } catch (error) {
      console.error('[NativeVoice] Ошибка остановки:', error);
    }
  }
}

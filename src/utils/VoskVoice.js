// Vosk - офлайн распознавание речи в браузере
// Работает БЕЗ серверов, БЕЗ Web Speech API, БЕЗ проблем с разрешениями

import { createModel, createRecognizer } from 'vosk-browser'

export class VoskVoiceRecognition {
  constructor() {
    this.model = null
    this.recognizer = null
    this.audioContext = null
    this.mediaStream = null
    this.processor = null
    this.isRecording = false
    this.onResultCallback = null
    this.onErrorCallback = null
  }

  async initialize() {
    try {
      console.log('[Vosk] Инициализация...')

      // Загружаем модель
      const modelUrl = '/vosk-model-small-ru-0.22'
      console.log('[Vosk] Загружаю модель:', modelUrl)

      this.model = await createModel(modelUrl)
      console.log('[Vosk] Модель загружена')

      // Создаём распознаватель
      this.recognizer = await createRecognizer(this.model, 16000)
      console.log('[Vosk] Распознаватель создан')

      return true
    } catch (error) {
      console.error('[Vosk] Ошибка инициализации:', error)
      if (this.onErrorCallback) {
        this.onErrorCallback(error.message)
      }
      return false
    }
  }

  async start(onResult, onError) {
    this.onResultCallback = onResult
    this.onErrorCallback = onError

    try {
      // Инициализируем если ещё не сделали
      if (!this.model) {
        const success = await this.initialize()
        if (!success) return false
      }

      console.log('[Vosk] Запрашиваю микрофон...')

      // Получаем доступ к микрофону через Web Audio API
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        }
      })

      console.log('[Vosk] Микрофон получен')

      // Создаём AudioContext
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000
      })

      const source = this.audioContext.createMediaStreamSource(this.mediaStream)

      // Создаём ScriptProcessor для обработки аудио
      const bufferSize = 4096
      this.processor = this.audioContext.createScriptProcessor(bufferSize, 1, 1)

      this.processor.onaudioprocess = async (event) => {
        if (!this.isRecording) return

        const inputData = event.inputBuffer.getChannelData(0)

        // Конвертируем Float32Array в Int16Array для Vosk
        const int16Data = new Int16Array(inputData.length)
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]))
          int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
        }

        // Отправляем в Vosk
        const result = await this.recognizer.acceptWaveform(int16Data)

        if (result) {
          const resultObj = await this.recognizer.result()
          console.log('[Vosk] Результат:', resultObj)

          if (resultObj.text && resultObj.text.trim() !== '') {
            console.log('[Vosk] Распознано:', resultObj.text)
            if (this.onResultCallback) {
              this.onResultCallback(resultObj.text)
            }
          }
        }
      }

      // Подключаем процессор
      source.connect(this.processor)
      this.processor.connect(this.audioContext.destination)

      this.isRecording = true
      console.log('[Vosk] Запись началась')

      return true
    } catch (error) {
      console.error('[Vosk] Ошибка запуска:', error)
      if (this.onErrorCallback) {
        this.onErrorCallback(error.message)
      }
      return false
    }
  }

  async stop() {
    console.log('[Vosk] Останавливаю запись...')
    this.isRecording = false

    // Получаем финальный результат
    if (this.recognizer) {
      try {
        const finalResult = await this.recognizer.finalResult()
        console.log('[Vosk] Финальный результат:', finalResult)

        if (finalResult.text && finalResult.text.trim() !== '') {
          if (this.onResultCallback) {
            this.onResultCallback(finalResult.text)
          }
        }
      } catch (error) {
        console.error('[Vosk] Ошибка получения финального результата:', error)
      }
    }

    // Останавливаем аудио
    if (this.processor) {
      this.processor.disconnect()
      this.processor = null
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop())
      this.mediaStream = null
    }

    if (this.audioContext) {
      await this.audioContext.close()
      this.audioContext = null
    }

    console.log('[Vosk] Остановлено')
  }

  async destroy() {
    await this.stop()

    if (this.recognizer) {
      this.recognizer.free()
      this.recognizer = null
    }

    if (this.model) {
      this.model.free()
      this.model = null
    }

    console.log('[Vosk] Уничтожено')
  }
}

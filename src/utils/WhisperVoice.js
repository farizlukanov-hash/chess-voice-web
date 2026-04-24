// Whisper Voice Recognition через WebSocket
export class WhisperVoiceRecognition {
  constructor(serverUrl = 'ws://localhost:3000') {
    this.serverUrl = serverUrl
    this.ws = null
    this.mediaRecorder = null
    this.audioChunks = []
    this.onResultCallback = null
    this.onErrorCallback = null
    this.isRecording = false
  }

  async connect() {
    return new Promise((resolve, reject) => {
      console.log('[Whisper] Подключаюсь к серверу:', this.serverUrl)

      this.ws = new WebSocket(this.serverUrl)

      this.ws.onopen = () => {
        console.log('[Whisper] Подключен к серверу')
        resolve()
      }

      this.ws.onerror = (error) => {
        console.error('[Whisper] Ошибка WebSocket:', error)
        reject(error)
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          console.log('[Whisper] Получено сообщение:', data)

          if (data.type === 'transcription') {
            if (this.onResultCallback) {
              this.onResultCallback(data.text)
            }
          } else if (data.type === 'error') {
            if (this.onErrorCallback) {
              this.onErrorCallback(data.message)
            }
          }
        } catch (error) {
          console.error('[Whisper] Ошибка парсинга:', error)
        }
      }

      this.ws.onclose = () => {
        console.log('[Whisper] Соединение закрыто')
      }
    })
  }

  async start(onResult, onError) {
    this.onResultCallback = onResult
    this.onErrorCallback = onError

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.connect()
    }

    try {
      // Получаем доступ к микрофону
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      console.log('[Whisper] Микрофон получен')

      // Создаём MediaRecorder
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      })

      this.audioChunks = []

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data)
          console.log('[Whisper] Получен аудио чанк:', event.data.size, 'bytes')
        }
      }

      this.mediaRecorder.onstop = async () => {
        console.log('[Whisper] Запись остановлена, чанков:', this.audioChunks.length)

        if (this.audioChunks.length > 0) {
          // Объединяем все чанки в один Blob
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' })
          console.log('[Whisper] Размер аудио:', audioBlob.size, 'bytes')

          // Конвертируем в base64
          const reader = new FileReader()
          reader.onloadend = () => {
            const base64Audio = reader.result.split(',')[1]

            // Отправляем на сервер
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
              this.ws.send(JSON.stringify({
                type: 'stop',
                audio: base64Audio
              }))
              console.log('[Whisper] Аудио отправлено на сервер')
            }
          }
          reader.readAsDataURL(audioBlob)
        }

        this.audioChunks = []
      }

      // Начинаем запись
      this.mediaRecorder.start(1000) // Собираем чанки каждую секунду
      this.isRecording = true
      console.log('[Whisper] Запись началась')

      // Отправляем сигнал старта
      this.ws.send(JSON.stringify({ type: 'start' }))

      return true
    } catch (error) {
      console.error('[Whisper] Ошибка запуска:', error)
      if (this.onErrorCallback) {
        this.onErrorCallback(error.message)
      }
      return false
    }
  }

  async stop() {
    console.log('[Whisper] Останавливаю запись...')
    this.isRecording = false

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop()

      // Останавливаем все треки
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop())
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }
}

// REST API версия (без WebSocket)
export class WhisperVoiceRecognitionREST {
  constructor(serverUrl = 'http://localhost:3000') {
    this.serverUrl = serverUrl
    this.mediaRecorder = null
    this.audioChunks = []
    this.onResultCallback = null
    this.onErrorCallback = null
    this.isRecording = false
  }

  async start(onResult, onError) {
    this.onResultCallback = onResult
    this.onErrorCallback = onError

    try {
      // Получаем доступ к микрофону
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      console.log('[Whisper REST] Микрофон получен')

      // Создаём MediaRecorder
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      })

      this.audioChunks = []

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data)
        }
      }

      this.mediaRecorder.onstop = async () => {
        console.log('[Whisper REST] Запись остановлена')

        if (this.audioChunks.length > 0) {
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' })
          console.log('[Whisper REST] Размер аудио:', audioBlob.size, 'bytes')

          // Отправляем на сервер через REST API
          const formData = new FormData()
          formData.append('audio', audioBlob, 'recording.webm')

          try {
            const response = await fetch(`${this.serverUrl}/transcribe`, {
              method: 'POST',
              body: formData
            })

            const result = await response.json()
            console.log('[Whisper REST] Результат:', result)

            if (result.text && this.onResultCallback) {
              this.onResultCallback(result.text)
            } else if (result.error && this.onErrorCallback) {
              this.onErrorCallback(result.error)
            }
          } catch (error) {
            console.error('[Whisper REST] Ошибка отправки:', error)
            if (this.onErrorCallback) {
              this.onErrorCallback(error.message)
            }
          }
        }

        this.audioChunks = []
      }

      // Начинаем запись
      this.mediaRecorder.start()
      this.isRecording = true
      console.log('[Whisper REST] Запись началась')

      return true
    } catch (error) {
      console.error('[Whisper REST] Ошибка запуска:', error)
      if (this.onErrorCallback) {
        this.onErrorCallback(error.message)
      }
      return false
    }
  }

  async stop() {
    console.log('[Whisper REST] Останавливаю запись...')
    this.isRecording = false

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop()

      // Останавливаем все треки
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop())
    }
  }
}

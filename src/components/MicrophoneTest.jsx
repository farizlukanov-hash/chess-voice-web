import React, { useState, useEffect } from 'react'
import './MicrophoneTest.css'

function MicrophoneTest({ onClose }) {
  const [devices, setDevices] = useState([])
  const [selectedDevice, setSelectedDevice] = useState('')
  const [permissionStatus, setPermissionStatus] = useState('unknown')
  const [isRecording, setIsRecording] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const [logs, setLogs] = useState([])
  const [stream, setStream] = useState(null)

  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, `[${timestamp}] ${message}`])
    console.log('[MicTest]', message)
  }

  useEffect(() => {
    checkPermissions()
    listDevices()
  }, [])

  const checkPermissions = async () => {
    addLog('Проверяю разрешения...')

    try {
      const result = await navigator.permissions.query({ name: 'microphone' })
      setPermissionStatus(result.state)
      addLog(`Статус разрешения: ${result.state}`)

      result.onchange = () => {
        setPermissionStatus(result.state)
        addLog(`Разрешение изменилось: ${result.state}`)
      }
    } catch (error) {
      addLog(`Ошибка проверки разрешений: ${error.message}`)
    }
  }

  const listDevices = async () => {
    addLog('Получаю список устройств...')

    try {
      const deviceList = await navigator.mediaDevices.enumerateDevices()
      const audioInputs = deviceList.filter(device => device.kind === 'audioinput')

      addLog(`Найдено микрофонов: ${audioInputs.length}`)
      audioInputs.forEach((device, i) => {
        addLog(`  ${i + 1}. ${device.label || 'Микрофон ' + (i + 1)} (${device.deviceId.substring(0, 8)}...)`)
      })

      setDevices(audioInputs)
      if (audioInputs.length > 0) {
        setSelectedDevice(audioInputs[0].deviceId)
      }
    } catch (error) {
      addLog(`Ошибка получения устройств: ${error.message}`)
    }
  }

  const requestPermission = async () => {
    addLog('Запрашиваю разрешение на микрофон...')

    try {
      const testStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      addLog('✓ Разрешение получено!')
      testStream.getTracks().forEach(track => track.stop())

      // Обновляем список устройств (теперь будут видны названия)
      await listDevices()
      checkPermissions()
    } catch (error) {
      addLog(`✗ Ошибка получения разрешения: ${error.name} - ${error.message}`)

      if (error.name === 'NotAllowedError') {
        addLog('Пользователь отклонил разрешение или браузер заблокировал доступ')
      } else if (error.name === 'NotFoundError') {
        addLog('Микрофон не найден на устройстве')
      } else if (error.name === 'NotReadableError') {
        addLog('Микрофон используется другим приложением')
      }
    }
  }

  const startTest = async () => {
    addLog(`Запускаю тест микрофона: ${selectedDevice.substring(0, 8)}...`)

    try {
      const constraints = {
        audio: {
          deviceId: selectedDevice ? { exact: selectedDevice } : undefined,
          echoCancellation: true,
          noiseSuppression: true
        }
      }

      addLog(`Constraints: ${JSON.stringify(constraints)}`)

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
      addLog('✓ Поток получен!')

      setStream(mediaStream)
      setIsRecording(true)

      // Создаем анализатор звука
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const source = audioContext.createMediaStreamSource(mediaStream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)

      const dataArray = new Uint8Array(analyser.frequencyBinCount)

      const updateLevel = () => {
        if (!isRecording) return

        analyser.getByteFrequencyData(dataArray)
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length
        setAudioLevel(Math.round(average))

        requestAnimationFrame(updateLevel)
      }

      updateLevel()
      addLog('Анализатор звука запущен. Говорите в микрофон!')

    } catch (error) {
      addLog(`✗ Ошибка запуска теста: ${error.name} - ${error.message}`)
      setIsRecording(false)
    }
  }

  const stopTest = () => {
    addLog('Останавливаю тест...')

    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop()
        addLog(`Трек остановлен: ${track.kind}`)
      })
      setStream(null)
    }

    setIsRecording(false)
    setAudioLevel(0)
    addLog('Тест остановлен')
  }

  return (
    <div className="mic-test-overlay">
      <div className="mic-test-panel">
        <h2>🎤 Диагностика микрофона</h2>

        <div className="test-section">
          <h3>Статус разрешения</h3>
          <div className={`permission-status ${permissionStatus}`}>
            {permissionStatus === 'granted' && '✓ Разрешено'}
            {permissionStatus === 'denied' && '✗ Запрещено'}
            {permissionStatus === 'prompt' && '? Требуется запрос'}
            {permissionStatus === 'unknown' && '? Неизвестно'}
          </div>

          {permissionStatus !== 'granted' && (
            <button onClick={requestPermission} className="btn-primary">
              Запросить разрешение
            </button>
          )}
        </div>

        <div className="test-section">
          <h3>Доступные микрофоны ({devices.length})</h3>
          {devices.length > 0 ? (
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="device-select"
            >
              {devices.map(device => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Микрофон ${device.deviceId.substring(0, 8)}`}
                </option>
              ))}
            </select>
          ) : (
            <p>Микрофоны не найдены. Запросите разрешение.</p>
          )}
        </div>

        <div className="test-section">
          <h3>Тест записи</h3>
          {!isRecording ? (
            <button
              onClick={startTest}
              disabled={!selectedDevice || permissionStatus !== 'granted'}
              className="btn-primary"
            >
              Начать тест
            </button>
          ) : (
            <button onClick={stopTest} className="btn-danger">
              Остановить тест
            </button>
          )}

          {isRecording && (
            <div className="audio-level">
              <div className="level-label">Уровень звука: {audioLevel}</div>
              <div className="level-bar">
                <div
                  className="level-fill"
                  style={{ width: `${Math.min(audioLevel * 2, 100)}%` }}
                />
              </div>
              <div className="level-hint">
                {audioLevel < 5 && 'Говорите громче!'}
                {audioLevel >= 5 && audioLevel < 20 && 'Слишком тихо'}
                {audioLevel >= 20 && audioLevel < 50 && 'Хорошо'}
                {audioLevel >= 50 && 'Отлично!'}
              </div>
            </div>
          )}
        </div>

        <div className="test-section">
          <h3>Логи</h3>
          <div className="logs-container">
            {logs.map((log, i) => (
              <div key={i} className="log-entry">{log}</div>
            ))}
          </div>
        </div>

        <button onClick={onClose} className="btn-close">
          Закрыть
        </button>
      </div>
    </div>
  )
}

export default MicrophoneTest

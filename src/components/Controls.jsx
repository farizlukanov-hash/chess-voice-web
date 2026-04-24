import React from 'react'
import './Controls.css'

const Controls = ({
  gameStarted,
  playingAsWhite,
  isListening,
  continuousListening,
  onStartGame,
  onRestartGame,
  onStartListening,
  onStopListening,
  onSideChange
}) => {
  const [micPermission, setMicPermission] = React.useState(null)

  React.useEffect(() => {
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'microphone' }).then(result => {
        setMicPermission(result.state)
        result.onchange = () => setMicPermission(result.state)
      }).catch(() => setMicPermission('prompt'))
    }
  }, [])

  const requestMicPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(track => track.stop())
      setMicPermission('granted')
      alert('Разрешение получено! Теперь можете начать партию.')
    } catch (error) {
      alert('Доступ к микрофону запрещён. Проверьте настройки браузера.')
    }
  }

  const handleStartGame = () => {
    if (micPermission !== 'granted') {
      alert('Сначала разрешите доступ к микрофону, нажав кнопку выше.')
      return
    }
    onStartGame()
  }

  return (
    <div className="controls">
      {!gameStarted ? (
        <>
          {micPermission !== 'granted' && (
            <button className="btn btn-warning" onClick={requestMicPermission}>
              🎤 Разрешить микрофон
            </button>
          )}

          {micPermission === 'granted' && (
            <div className="mic-status">✅ Микрофон разрешён</div>
          )}

          <div className="side-selection">
            <button
              className={`side-btn ${playingAsWhite ? 'active' : ''}`}
              onClick={() => onSideChange(true)}
            >
              Играю белыми
            </button>
            <button
              className={`side-btn ${!playingAsWhite ? 'active' : ''}`}
              onClick={() => onSideChange(false)}
            >
              Играю чёрными
            </button>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleStartGame}
            disabled={micPermission !== 'granted'}
          >
            Начать партию
          </button>
        </>
      ) : (
        <>
          {!continuousListening ? (
            <button
              className="btn btn-voice"
              onClick={onStartListening}
            >
              🎤 Включить постоянное прослушивание
            </button>
          ) : (
            <button
              className="btn btn-danger"
              onClick={onStopListening}
            >
              ⏸ Остановить прослушивание
            </button>
          )}

          <button className="btn btn-secondary" onClick={onRestartGame}>
            Начать сначала
          </button>

          <div className="commands-hint">
            <p><strong>Как работает суфлёр:</strong></p>
            <p>1. Противник делает ход на доске</p>
            <p>2. Вы говорите его ход вслух</p>
            <p>3. Суфлёр подсказывает ваш лучший ответ</p>
            <p>4. Вы делаете этот ход на доске</p>
            <br/>
            <p><strong>Примеры:</strong></p>
            <p>• "пешка е четыре"</p>
            <p>• "конь ф три"</p>
            <p>• "слон це четыре"</p>
            <br/>
            <p><strong>Команды:</strong></p>
            <p>• "отмена" - отменить ход</p>
            <p>• "ещё раз" - повторить подсказку</p>
          </div>
        </>
      )}
    </div>
  )
}

export default Controls

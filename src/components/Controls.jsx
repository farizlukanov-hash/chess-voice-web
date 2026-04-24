import React from 'react'
import './Controls.css'

const Controls = ({
  gameStarted,
  playingAsWhite,
  isListening,
  onStartGame,
  onRestartGame,
  onStartListening,
  onSideChange
}) => {
  const [micPermission, setMicPermission] = React.useState(null)

  React.useEffect(() => {
    // Проверяем статус разрешения микрофона
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
      alert('Разрешение получено! Теперь можете начать игру.')
    } catch (error) {
      alert('Доступ к микрофону запрещён. Проверьте настройки браузера.')
    }
  }

  const handleStartGame = async () => {
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
              Белые
            </button>
            <button
              className={`side-btn ${!playingAsWhite ? 'active' : ''}`}
              onClick={() => onSideChange(false)}
            >
              Чёрные
            </button>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleStartGame}
            disabled={micPermission !== 'granted'}
          >
            Начать игру
          </button>
        </>
      ) : (
        <>
          <button
            className="btn btn-voice"
            onClick={onStartListening}
            disabled={isListening}
          >
            {isListening ? '🎤 Слушаю...' : '🎤 Сказать ход'}
          </button>

          <button className="btn btn-secondary" onClick={onRestartGame}>
            Новая игра
          </button>

          <div className="commands-hint">
            <p><strong>Как говорить ходы:</strong></p>
            <p>• "пешка е четыре"</p>
            <p>• "конь ф три"</p>
            <p>• "слон це четыре"</p>
            <p><strong>Команды:</strong></p>
            <p>• "отмена" - отменить ход</p>
            <p>• "ещё раз" - повторить последний ход</p>
          </div>
        </>
      )}
    </div>
  )
}

export default Controls

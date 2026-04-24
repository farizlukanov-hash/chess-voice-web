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
  const handleStartGame = async () => {
    // ЯВНЫЙ запрос микрофона ПЕРЕД началом игры
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      console.log('[Микрофон] Разрешение получено!')
      // Останавливаем поток (нам нужно только разрешение)
      stream.getTracks().forEach(track => track.stop())
      // Теперь запускаем игру
      onStartGame()
    } catch (error) {
      console.error('[Микрофон] Доступ запрещён:', error)
      alert('Доступ к микрофону запрещён. Разрешите доступ в настройках браузера и обновите страницу.')
    }
  }

  return (
    <div className="controls">
      {!gameStarted ? (
        <>
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

          <button className="btn btn-primary" onClick={handleStartGame}>
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

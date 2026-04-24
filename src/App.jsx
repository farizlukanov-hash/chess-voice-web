import React, { useState, useEffect, useRef } from 'react'
import ChessBoard from './components/ChessBoard'
import Controls from './components/Controls'
import StatusPanel from './components/StatusPanel'
import { Chess } from 'chess.js'
import { VoiceParser } from './utils/VoiceParser'
import './App.css'

function App() {
  const [game, setGame] = useState(new Chess())
  const [fen, setFen] = useState(game.fen())
  const [status, setStatus] = useState('Выберите за кого играете и нажмите "Начать партию"')
  const [lastMove, setLastMove] = useState('')
  const [lastMoveSpeech, setLastMoveSpeech] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [playingAsWhite, setPlayingAsWhite] = useState(true)
  const [gameStarted, setGameStarted] = useState(false)
  const [continuousListening, setContinuousListening] = useState(false)

  const recognitionRef = useRef(null)
  const stockfishRef = useRef(null)
  const parserRef = useRef(new VoiceParser())

  // Инициализация Stockfish
  useEffect(() => {
    const initStockfish = async () => {
      try {
        const Stockfish = await import('stockfish.js')
        stockfishRef.current = Stockfish()
        stockfishRef.current.postMessage('uci')
        console.log('[Stockfish] Инициализирован')
      } catch (error) {
        console.error('[Stockfish] Ошибка загрузки:', error)
      }
    }
    initStockfish()
  }, [])

  // Инициализация Web Speech API
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      recognitionRef.current = new SpeechRecognition()
      recognitionRef.current.lang = 'ru-RU'
      recognitionRef.current.continuous = false
      recognitionRef.current.interimResults = false

      recognitionRef.current.onstart = () => {
        console.log('[Микрофон] Начало записи')
      }

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript
        console.log('[Google] Распознал:', transcript)
        handleVoiceCommand(transcript)
      }

      recognitionRef.current.onerror = (event) => {
        console.error('[Микрофон] Ошибка:', event.error)

        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          setIsListening(false)
          const errorMessages = {
            'not-allowed': 'Доступ к микрофону запрещён',
            'network': 'Нет интернета',
            'audio-capture': 'Микрофон не найден'
          }
          const message = errorMessages[event.error] || 'Ошибка микрофона'
          setStatus(message)
        }
      }

      recognitionRef.current.onend = () => {
        console.log('[Микрофон] Запись завершена')
        // Если включено постоянное прослушивание - перезапускаем
        if (continuousListening && gameStarted) {
          setTimeout(() => {
            if (continuousListening && recognitionRef.current) {
              try {
                recognitionRef.current.start()
              } catch (e) {
                console.log('[Микрофон] Уже запущен')
              }
            }
          }, 100)
        } else {
          setIsListening(false)
        }
      }
    } else {
      console.warn('[Web Speech API] Не поддерживается')
      setStatus('Голосовой ввод не поддерживается. Используйте Chrome.')
    }
  }, [continuousListening, gameStarted])

  const speak = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'ru-RU'
      utterance.rate = 0.85
      utterance.pitch = 1.0
      window.speechSynthesis.speak(utterance)
    }
  }

  const startContinuousListening = () => {
    if (!recognitionRef.current) {
      setStatus('Web Speech API не поддерживается')
      return
    }

    setContinuousListening(true)
    setIsListening(true)
    setStatus('🎤 Слушаю постоянно... Говорите ходы противника')

    try {
      recognitionRef.current.start()
    } catch (error) {
      console.error('[Микрофон] Ошибка запуска:', error)
    }
  }

  const stopContinuousListening = () => {
    setContinuousListening(false)
    setIsListening(false)
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    setStatus('Прослушивание остановлено')
  }

  const handleVoiceCommand = (text) => {
    console.log('[DEBUG] Обрабатываю команду:', text)
    setStatus(`Распознано: ${text}`)

    // Команда "отмена"
    if (text.toLowerCase().includes('отмена') || text.toLowerCase().includes('отменить')) {
      undoMove()
      return
    }

    // Команда "ещё раз"
    if (text.toLowerCase().includes('ещё раз') || text.toLowerCase().includes('еще раз')) {
      if (lastMoveSpeech) {
        setStatus('Повторяю последний ход')
        speak(`Ходи ${lastMoveSpeech}`)
      } else {
        setStatus('Нет хода для повтора')
        speak('Нет хода для повтора')
      }
      return
    }

    // Парсинг хода ПРОТИВНИКА
    const legalMoves = game.moves({ verbose: true }).map(m => m.san)
    console.log('[DEBUG] Легальные ходы:', legalMoves)

    const parsedMove = parserRef.current.parseWithContext(text, legalMoves, true)
    console.log('[DEBUG] Распознанный ход противника:', parsedMove)

    if (parsedMove) {
      processOpponentMove(parsedMove)
    } else {
      // Проверяем распознали ли вообще какой-то ход
      const anyMove = parserRef.current.parse(text)
      if (anyMove) {
        setStatus(`Ход ${anyMove} невозможен`)
        speak(`Ход ${anyMove} невозможен`)
      } else {
        setStatus('Не понял ход. Повторите.')
        speak('Не понял ход, повтори')
      }
    }
  }

  const processOpponentMove = (move) => {
    try {
      // Делаем ход противника
      const result = game.move(move)
      if (!result) {
        setStatus('Недопустимый ход')
        speak('Недопустимый ход')
        return
      }

      setFen(game.fen())
      setStatus(`Противник: ${result.san}. Думаю...`)

      // Проверка окончания игры
      if (game.isGameOver()) {
        if (game.isCheckmate()) {
          setStatus('Мат! Игра окончена.')
          speak('Мат! Игра окончена.')
          stopContinuousListening()
        } else if (game.isDraw()) {
          setStatus('Ничья!')
          speak('Ничья!')
          stopContinuousListening()
        }
        return
      }

      // Вычисляем ТВОЙ лучший ход
      setTimeout(() => calculateBestMove(), 300)
    } catch (error) {
      console.error('[Ошибка хода]:', error)
      setStatus('Ошибка хода')
      speak('Ошибка хода')
    }
  }

  const calculateBestMove = () => {
    const currentFen = game.fen()

    if (!stockfishRef.current) {
      // Fallback: случайный ход
      const moves = game.moves()
      if (moves.length > 0) {
        const randomMove = moves[Math.floor(Math.random() * moves.length)]
        suggestMove(randomMove)
      }
      return
    }

    setStatus('Думаю...')

    stockfishRef.current.postMessage(`position fen ${currentFen}`)
    stockfishRef.current.postMessage('go depth 15')

    const handleMessage = (event) => {
      const line = event.data
      if (typeof line === 'string' && line.startsWith('bestmove')) {
        const bestMoveUCI = line.split(' ')[1]

        // Конвертируем UCI в SAN
        const tempGame = new Chess(currentFen)
        const moveObj = tempGame.move(bestMoveUCI, { sloppy: true })

        if (moveObj) {
          suggestMove(moveObj.san)
        }

        stockfishRef.current.removeEventListener('message', handleMessage)
      }
    }

    stockfishRef.current.addEventListener('message', handleMessage)
  }

  const suggestMove = (moveSAN) => {
    setLastMove(moveSAN)
    setLastMoveSpeech(moveSAN)
    setStatus(`✓ Твой ход: ${moveSAN}`)
    speak(`Ходи ${moveSAN}`)

    // ВСЕГДА автоматически включаем прослушивание после подсказки
    setTimeout(() => {
      if (gameStarted && !continuousListening) {
        startContinuousListening()
      }
    }, 3000)
  }

  const startGame = () => {
    const newGame = new Chess()
    setGame(newGame)
    setFen(newGame.fen())
    setGameStarted(true)
    setLastMove('')
    setLastMoveSpeech('')

    if (playingAsWhite) {
      // Играем белыми - подсказываем НАШИ первый ход
      const message = 'Партия началась! Вы играете белыми. Сейчас подскажу ваш первый ход.'
      setStatus(message)
      speak(message)
      setTimeout(() => calculateBestMove(), 1500)
    } else {
      // Играем чёрными - ждём хода противника
      const message = 'Партия началась! Вы играете чёрными. Ждите хода противника и говорите его вслух.'
      setStatus(message)
      speak(message)
      setTimeout(() => startContinuousListening(), 2000)
    }
  }

  const undoMove = () => {
    if (game.history().length < 2) {
      setStatus('Нечего отменять')
      speak('Нечего отменять')
      return
    }

    game.undo() // Отменяем твой ход
    game.undo() // Отменяем ход противника
    setFen(game.fen())

    const lastMoveObj = game.history({ verbose: true }).pop()
    if (lastMoveObj) {
      setLastMove(lastMoveObj.san)
      setLastMoveSpeech(lastMoveObj.san)
      setStatus(`Ход отменён. Вернулись к ходу ${lastMoveObj.san}`)
      speak(`Ход отменён. Вернулись к ходу ${lastMoveObj.san}`)
    } else {
      setLastMove('')
      setLastMoveSpeech('')
      setStatus('Ход отменён. Вернулись к началу партии')
      speak('Ход отменён. Вернулись к началу партии')
    }
  }

  const restartGame = () => {
    stopContinuousListening()
    const newGame = new Chess()
    setGame(newGame)
    setFen(newGame.fen())
    setGameStarted(false)
    setLastMove('')
    setLastMoveSpeech('')
    setStatus('Выберите за кого играете и нажмите "Начать партию"')
    speak('Партия сброшена. Готов к новой игре')
  }

  return (
    <div className="app">
      <h1 className="title">ЦИФРОВОЙ СУФЛЁР</h1>
      <p className="subtitle">Умный помощник в наушнике</p>

      <div className="game-container">
        <ChessBoard fen={fen} />

        <div className="right-panel">
          <StatusPanel
            status={status}
            lastMove={lastMove}
            isListening={isListening}
          />

          <Controls
            gameStarted={gameStarted}
            playingAsWhite={playingAsWhite}
            isListening={isListening}
            continuousListening={continuousListening}
            onStartGame={startGame}
            onRestartGame={restartGame}
            onStartListening={startContinuousListening}
            onStopListening={stopContinuousListening}
            onSideChange={setPlayingAsWhite}
          />
        </div>
      </div>
    </div>
  )
}

export default App

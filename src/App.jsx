import React, { useState, useEffect, useRef } from 'react'
import ChessBoard from './components/ChessBoard'
import Controls from './components/Controls'
import StatusPanel from './components/StatusPanel'
import { Chess } from 'chess.js'
import { VoiceParser } from './utils/VoiceParser'
import { TTSEngine } from './utils/TTSEngine'
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

  const recognitionRef = useRef(null)
  const stockfishRef = useRef(null)
  const parserRef = useRef(new VoiceParser())
  const ttsRef = useRef(new TTSEngine())
  const listeningLoopRef = useRef(false)

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
        console.log('[Микрофон] Слушаю...')
        setStatus('>>> ГОВОРИ СЕЙЧАС! <<<')
      }

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript
        console.log('[Google] Распознал:', transcript)
        processVoiceCommand(transcript)
      }

      recognitionRef.current.onerror = (event) => {
        console.error('[Микрофон] Ошибка:', event.error)
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          setIsListening(false)
        }
      }

      recognitionRef.current.onend = () => {
        console.log('[Микрофон] Запись завершена')
        // Автоматически перезапускаем ВСЕГДА если игра активна
        if (gameStarted && listeningLoopRef.current) {
          setTimeout(() => {
            if (listeningLoopRef.current && recognitionRef.current) {
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
    }
  }, [gameStarted])

  const speak = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'ru-RU'
      utterance.rate = 0.85
      window.speechSynthesis.speak(utterance)
    }
  }

  const startListeningLoop = () => {
    if (!recognitionRef.current) return

    listeningLoopRef.current = true
    setIsListening(true)
    setStatus('🎤 Слушаю постоянно...')

    try {
      recognitionRef.current.start()
    } catch (error) {
      console.error('[Микрофон] Ошибка запуска:', error)
    }
  }

  const stopListeningLoop = () => {
    listeningLoopRef.current = false
    setIsListening(false)
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
  }

  const processVoiceCommand = (text) => {
    console.log('[DEBUG] Обрабатываю:', text)
    setStatus(`Распознано: ${text}`)

    // Команда "отмена"
    if (text.toLowerCase().includes('отмена')) {
      undoMove()
      return
    }

    // Команда "ещё раз"
    if (text.toLowerCase().includes('ещё раз') || text.toLowerCase().includes('еще раз')) {
      if (lastMoveSpeech) {
        speak(`Ходи ${lastMoveSpeech}`)
      } else {
        speak('Нет хода для повтора')
      }
      return
    }

    // Парсим ход противника
    const legalMoves = game.moves()
    const parsedMove = parserRef.current.parseWithContext(text, legalMoves, true)

    if (!parsedMove) {
      const anyMove = parserRef.current.parse(text)
      if (anyMove) {
        setStatus(`Ход ${anyMove} невозможен`)
        speak(`Ход ${anyMove} невозможен`)
      } else {
        setStatus('Не понял ход')
        speak('Не понял ход, повтори')
      }
      return
    }

    // Делаем ход противника
    processOpponentMove(parsedMove)
  }

  const processOpponentMove = (move) => {
    try {
      // 1. Делаем ход противника НА ДОСКЕ
      const opponentResult = game.move(move)
      if (!opponentResult) {
        setStatus('Недопустимый ход')
        speak('Недопустимый ход')
        return
      }

      setFen(game.fen())
      console.log('[DEBUG] Ход противника:', opponentResult.san)

      // Проверка окончания
      if (game.isGameOver()) {
        handleGameOver()
        return
      }

      // 2. Вычисляем ТВОЙ лучший ход
      setStatus('Думаю...')
      calculateBestMove()
    } catch (error) {
      console.error('[Ошибка]:', error)
      setStatus('Ошибка хода')
    }
  }

  const calculateBestMove = () => {
    const currentFen = game.fen()

    if (!stockfishRef.current) {
      // Fallback: случайный ход
      const moves = game.moves()
      if (moves.length > 0) {
        const randomMove = moves[Math.floor(Math.random() * moves.length)]
        makeMyMove(randomMove)
      }
      return
    }

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
          makeMyMove(moveObj.san)
        }

        stockfishRef.current.removeEventListener('message', handleMessage)
      }
    }

    stockfishRef.current.addEventListener('message', handleMessage)
  }

  const makeMyMove = (moveSAN) => {
    // 3. Делаем ТВОЙ ход НА ДОСКЕ
    const myResult = game.move(moveSAN)
    if (!myResult) {
      console.error('[Ошибка] Не удалось сделать мой ход:', moveSAN)
      return
    }

    setFen(game.fen())

    // Конвертируем в речь
    const speechText = ttsRef.current.moveToSpeech(myResult.san)

    setLastMove(myResult.san)
    setLastMoveSpeech(speechText)
    setStatus(`✓ Ход обработан`)

    // 4. Озвучиваем
    speak(`Ходи ${speechText}`)

    console.log('[DEBUG] Мой ход:', myResult.san, '-> Речь:', speechText)

    // Проверка окончания
    if (game.isGameOver()) {
      handleGameOver()
    }
  }

  const handleGameOver = () => {
    stopListeningLoop()
    if (game.isCheckmate()) {
      setStatus('Мат! Игра окончена.')
      speak('Мат! Игра окончена.')
    } else if (game.isDraw()) {
      setStatus('Ничья!')
      speak('Ничья!')
    }
  }

  const startGame = () => {
    const newGame = new Chess()
    setGame(newGame)
    setFen(newGame.fen())
    setGameStarted(true)
    setLastMove('')
    setLastMoveSpeech('')

    if (playingAsWhite) {
      const message = 'Партия началась! Вы играете белыми.'
      setStatus(message)
      speak(message)
      // СРАЗУ запускаем прослушивание
      setTimeout(() => startListeningLoop(), 1500)
      // Подсказываем первый ход
      setTimeout(() => calculateBestMove(), 2000)
    } else {
      const message = 'Партия началась! Вы играете чёрными. Ждите хода противника.'
      setStatus(message)
      speak(message)
      // СРАЗУ запускаем прослушивание
      setTimeout(() => startListeningLoop(), 1500)
    }
  }

  const undoMove = () => {
    if (game.history().length < 2) {
      setStatus('Нечего отменять')
      speak('Нечего отменять')
      return
    }

    game.undo() // Твой ход
    game.undo() // Ход противника
    setFen(game.fen())
    setStatus('Ход отменён')
    speak('Ход отменён')
  }

  const restartGame = () => {
    stopListeningLoop()
    const newGame = new Chess()
    setGame(newGame)
    setFen(newGame.fen())
    setGameStarted(false)
    setLastMove('')
    setLastMoveSpeech('')
    setStatus('Выберите за кого играете и нажмите "Начать партию"')
    speak('Партия сброшена')
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
            onStartGame={startGame}
            onRestartGame={restartGame}
            onSideChange={setPlayingAsWhite}
          />
        </div>
      </div>
    </div>
  )
}

export default App

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
  const [status, setStatus] = useState('Выберите цвет и нажмите "Начать игру"')
  const [lastMove, setLastMove] = useState('')
  const [lastMoveSpeech, setLastMoveSpeech] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [playingAsWhite, setPlayingAsWhite] = useState(true)
  const [gameStarted, setGameStarted] = useState(false)

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
        setStatus('>>> ГОВОРИ СЕЙЧАС! <<<')
      }

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript
        console.log('[Google] Распознал:', transcript)
        handleVoiceCommand(transcript)
      }

      recognitionRef.current.onerror = (event) => {
        console.error('[Микрофон] Ошибка:', event.error)
        setIsListening(false)

        const errorMessages = {
          'not-allowed': 'Доступ к микрофону запрещён. Разрешите в настройках браузера.',
          'no-speech': 'Речь не распознана. Говорите громче и чётче.',
          'network': 'Нет интернета. Web Speech API требует подключение.',
          'aborted': 'Распознавание прервано.',
          'audio-capture': 'Микрофон не найден или занят другим приложением.'
        }

        const message = errorMessages[event.error] || 'Ошибка распознавания. Попробуйте снова.'
        setStatus(message)
      }

      recognitionRef.current.onend = () => {
        console.log('[Микрофон] Запись завершена')
        setIsListening(false)
      }
    } else {
      console.warn('[Web Speech API] Не поддерживается')
      setStatus('Голосовой ввод не поддерживается в этом браузере. Используйте Chrome.')
    }
  }, [])

  const speak = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel() // Останавливаем предыдущую озвучку
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'ru-RU'
      utterance.rate = 0.85
      utterance.pitch = 1.0
      window.speechSynthesis.speak(utterance)
    }
  }

  const startListening = async () => {
    if (!recognitionRef.current) {
      setStatus('Web Speech API не поддерживается')
      return
    }

    if (isListening) {
      return
    }

    // Запрашиваем разрешение микрофона
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
      console.log('[Микрофон] Разрешение получено')
    } catch (error) {
      console.error('[Микрофон] Доступ запрещён:', error)
      setStatus('Доступ к микрофону запрещён. Разрешите в настройках браузера.')
      speak('Доступ к микрофону запрещён')
      return
    }

    setIsListening(true)
    setStatus('Слушаю...')

    try {
      recognitionRef.current.start()
    } catch (error) {
      console.error('[Микрофон] Ошибка запуска:', error)
      setIsListening(false)
      setStatus('Ошибка запуска микрофона')
    }
  }

  const handleVoiceCommand = (text) => {
    console.log('[DEBUG] Обрабатываю команду:', text)

    // Команда "отмена"
    if (text.toLowerCase().includes('отмена')) {
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

    // Парсинг хода
    const legalMoves = game.moves({ verbose: true }).map(m => m.san)
    console.log('[DEBUG] Легальные ходы:', legalMoves)

    const parsedMove = parserRef.current.parseWithContext(text, legalMoves, true)
    console.log('[DEBUG] Распознанный ход:', parsedMove)

    if (parsedMove) {
      makeMove(parsedMove)
    } else {
      setStatus('Не понял ход. Попробуйте снова.')
      speak('Не понял ход, повтори')
    }
  }

  const makeMove = (move) => {
    try {
      const result = game.move(move)
      if (result) {
        setFen(game.fen())
        setLastMove(result.san)
        setStatus(`Ход сделан: ${result.san}`)

        // Проверка окончания игры
        if (game.isGameOver()) {
          if (game.isCheckmate()) {
            setStatus('Мат! Игра окончена.')
            speak('Мат! Игра окончена.')
          } else if (game.isDraw()) {
            setStatus('Ничья!')
            speak('Ничья!')
          }
          return
        }

        // Ход компьютера
        setTimeout(() => makeComputerMove(), 500)
      } else {
        setStatus('Недопустимый ход')
        speak('Недопустимый ход')
      }
    } catch (error) {
      console.error('[Ошибка хода]:', error)
      setStatus('Ошибка хода')
      speak('Ошибка хода')
    }
  }

  const makeComputerMove = () => {
    if (!stockfishRef.current) {
      // Fallback: случайный ход
      const moves = game.moves()
      if (moves.length > 0) {
        const randomMove = moves[Math.floor(Math.random() * moves.length)]
        const result = game.move(randomMove)
        setFen(game.fen())
        setLastMove(result.san)
        setLastMoveSpeech(result.san)
        setStatus(`Компьютер: ${result.san}`)
        speak(`Ходи ${result.san}`)
      }
      return
    }

    setStatus('Компьютер думает...')

    stockfishRef.current.postMessage(`position fen ${game.fen()}`)
    stockfishRef.current.postMessage('go depth 10')

    const handleMessage = (event) => {
      const line = event.data
      if (typeof line === 'string' && line.startsWith('bestmove')) {
        const bestMove = line.split(' ')[1]

        try {
          const result = game.move(bestMove, { sloppy: true })
          setFen(game.fen())
          setLastMove(result.san)
          setLastMoveSpeech(result.san)
          setStatus(`Компьютер: ${result.san}`)
          speak(`Ходи ${result.san}`)

          // Проверка окончания игры
          if (game.isGameOver()) {
            if (game.isCheckmate()) {
              setStatus('Мат! Вы проиграли.')
              speak('Мат! Вы проиграли.')
            } else if (game.isDraw()) {
              setStatus('Ничья!')
              speak('Ничья!')
            }
          }
        } catch (error) {
          console.error('[Stockfish] Ошибка хода:', error)
        }

        stockfishRef.current.removeEventListener('message', handleMessage)
      }
    }

    stockfishRef.current.addEventListener('message', handleMessage)
  }

  const startGame = () => {
    // Разрешение микрофона уже получено в Controls.jsx
    const newGame = new Chess()
    setGame(newGame)
    setFen(newGame.fen())
    setGameStarted(true)
    setLastMove('')
    setLastMoveSpeech('')

    const message = playingAsWhite ? 'Игра началась! Вы играете белыми. Ваш ход.' : 'Игра началась! Вы играете чёрными.'
    setStatus(message)
    speak(message)

    if (!playingAsWhite) {
      setTimeout(() => makeComputerMove(), 1000)
    }
  }

  const undoMove = () => {
    if (game.history().length < 2) {
      setStatus('Нечего отменять')
      speak('Нечего отменять')
      return
    }

    game.undo() // Отменяем ход компьютера
    game.undo() // Отменяем свой ход
    setFen(game.fen())
    setStatus('Ход отменён')
    speak('Ход отменён')
  }

  const restartGame = () => {
    const newGame = new Chess()
    setGame(newGame)
    setFen(newGame.fen())
    setGameStarted(false)
    setLastMove('')
    setLastMoveSpeech('')
    setStatus('Выберите цвет и нажмите "Начать игру"')
  }

  return (
    <div className="app">
      <h1 className="title">ЦИФРОВОЙ СУФЛЁР</h1>

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
            onStartListening={startListening}
            onSideChange={setPlayingAsWhite}
          />
        </div>
      </div>
    </div>
  )
}

export default App

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
  const gameRef = useRef(game)

  // Синхронизируем gameRef с game
  useEffect(() => {
    gameRef.current = game
  }, [game])

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
      recognitionRef.current.maxAlternatives = 1

      recognitionRef.current.onstart = () => {
        console.log('[Микрофон] Слушаю...')
        setStatus('🎤 Слушаю...')
      }

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript
        console.log('[Google] Распознал:', transcript)
        processVoiceCommand(transcript)
      }

      recognitionRef.current.onerror = (event) => {
        console.error('[Микрофон] Ошибка:', event.error)
        // Игнорируем no-speech - это нормально
        if (event.error === 'no-speech') {
          console.log('[Микрофон] Тишина, перезапускаю')
        }
      }

      recognitionRef.current.onend = () => {
        console.log('[Микрофон] Сессия завершена, перезапускаю через 500ms')
        // ВСЕГДА перезапускаем если игра активна
        setTimeout(() => {
          if (isListening && gameStarted && recognitionRef.current) {
            try {
              recognitionRef.current.start()
              console.log('[Микрофон] Перезапущен')
            } catch (e) {
              console.error('[Микрофон] Ошибка перезапуска:', e.message)
            }
          }
        }, 500)
      }
    }
  }, [isListening, gameStarted])

  const speak = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'ru-RU'
      utterance.rate = 0.85
      window.speechSynthesis.speak(utterance)
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
    const legalMoves = gameRef.current.moves()
    const parsedMove = parserRef.current.parseWithContext(text, legalMoves, true)

    console.log('[DEBUG] Легальные ходы:', legalMoves)
    console.log('[DEBUG] Распознанный ход:', parsedMove)

    if (!parsedMove) {
      const anyMove = parserRef.current.parse(text)
      console.log('[DEBUG] Парсер вернул (без контекста):', anyMove)
      if (anyMove) {
        setStatus(`Ход ${anyMove} невозможен`)
        speak(`Ход ${anyMove} невозможен`)
      } else {
        setStatus('Не понял ход')
        speak('Не понял ход, повтори')
      }
      return
    }

    // Обрабатываем ход (как в декстопе: ход противника + твой ход)
    processOpponentMove(parsedMove)
  }

  const processOpponentMove = (opponentMove) => {
    try {
      const currentGame = gameRef.current

      // 1. Делаем ход противника
      const opponentResult = currentGame.move(opponentMove)
      if (!opponentResult) {
        setStatus('Недопустимый ход')
        speak('Недопустимый ход')
        return
      }

      console.log('[DEBUG] Ход противника:', opponentResult.san)
      setGame(new Chess(currentGame.fen()))
      setFen(currentGame.fen())

      // Проверка окончания после хода противника
      if (currentGame.isGameOver()) {
        handleGameOver()
        return
      }

      // 2. Вычисляем ТВОЙ лучший ход
      setStatus('Думаю...')
      calculateBestMoveAndMake(currentGame)
    } catch (error) {
      console.error('[Ошибка]:', error)
      setStatus('Ошибка хода')
    }
  }

  const calculateBestMoveAndMake = (currentGame) => {
    const currentFen = currentGame.fen()

    if (!stockfishRef.current) {
      // Fallback: случайный ход
      const moves = currentGame.moves()
      if (moves.length > 0) {
        const randomMove = moves[Math.floor(Math.random() * moves.length)]
        const moveObj = currentGame.move(randomMove)
        if (moveObj) {
          setGame(new Chess(currentGame.fen()))
          setFen(currentGame.fen())
          const speechText = ttsRef.current.moveToSpeech(moveObj.san)
          setLastMove(moveObj.san)
          setLastMoveSpeech(speechText)
          setStatus(`✓ Ход обработан`)
          speak(`Ходи ${speechText}`)
          console.log('[DEBUG] Мой ход (fallback):', moveObj.san, '-> Речь:', speechText)
        }
      }
      return
    }

    stockfishRef.current.postMessage(`position fen ${currentFen}`)
    stockfishRef.current.postMessage('go movetime 1000')

    const handleMessage = (event) => {
      const line = event.data
      if (typeof line === 'string' && line.startsWith('bestmove')) {
        const bestMoveUCI = line.split(' ')[1]

        // Конвертируем UCI в SAN
        const moveObj = currentGame.move(bestMoveUCI, { sloppy: true })

        if (moveObj) {
          // Обновляем состояние с новой позицией
          setGame(new Chess(currentGame.fen()))
          setFen(currentGame.fen())

          // Конвертируем в речь
          const speechText = ttsRef.current.moveToSpeech(moveObj.san)

          setLastMove(moveObj.san)
          setLastMoveSpeech(speechText)
          setStatus(`✓ Ход обработан`)

          // Озвучиваем
          speak(`Ходи ${speechText}`)

          console.log('[DEBUG] Мой ход:', moveObj.san, '-> Речь:', speechText)

          // Проверка окончания
          if (currentGame.isGameOver()) {
            handleGameOver()
          }
        }

        stockfishRef.current.removeEventListener('message', handleMessage)
      }
    }

    stockfishRef.current.addEventListener('message', handleMessage)
  }

  const makeMyFirstMove = () => {
    const currentGame = gameRef.current
    const currentFen = currentGame.fen()

    setStatus('Думаю над первым ходом...')

    if (!stockfishRef.current) {
      // Fallback
      const moves = currentGame.moves()
      if (moves.length > 0) {
        const randomMove = moves[Math.floor(Math.random() * moves.length)]
        const moveObj = currentGame.move(randomMove)
        if (moveObj) {
          setGame(new Chess(currentGame.fen()))
          setFen(currentGame.fen())
          const speechText = ttsRef.current.moveToSpeech(moveObj.san)
          setLastMove(moveObj.san)
          setLastMoveSpeech(speechText)
          setStatus('✓ Готов')
          speak(`Ходи ${speechText}`)
          console.log('[DEBUG] Первый ход (fallback):', moveObj.san, '-> Речь:', speechText)
        }
      }
      return
    }

    stockfishRef.current.postMessage(`position fen ${currentFen}`)
    stockfishRef.current.postMessage('go movetime 1000')

    const handleMessage = (event) => {
      const line = event.data
      if (typeof line === 'string' && line.startsWith('bestmove')) {
        const bestMoveUCI = line.split(' ')[1]

        const moveObj = currentGame.move(bestMoveUCI, { sloppy: true })

        if (moveObj) {
          setGame(new Chess(currentGame.fen()))
          setFen(currentGame.fen())

          const speechText = ttsRef.current.moveToSpeech(moveObj.san)
          setLastMove(moveObj.san)
          setLastMoveSpeech(speechText)
          setStatus('✓ Готов')

          speak(`Ходи ${speechText}`)
          console.log('[DEBUG] Первый ход:', moveObj.san, '-> Речь:', speechText)
        }

        stockfishRef.current.removeEventListener('message', handleMessage)
      }
    }

    stockfishRef.current.addEventListener('message', handleMessage)
  }

  const handleGameOver = () => {
    setIsListening(false)
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }

    const currentGame = gameRef.current
    if (currentGame.isCheckmate()) {
      setStatus('Мат! Игра окончена.')
      speak('Мат! Игра окончена.')
    } else if (currentGame.isDraw()) {
      setStatus('Ничья!')
      speak('Ничья!')
    }
  }

  const startGame = () => {
    const newGame = new Chess()
    setGame(newGame)
    gameRef.current = newGame
    setFen(newGame.fen())
    setGameStarted(true)
    setLastMove('')
    setLastMoveSpeech('')

    // СРАЗУ запускаем прослушивание
    setIsListening(true)
    setTimeout(() => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start()
        } catch (e) {
          console.log('[Микрофон] Ошибка запуска')
        }
      }
    }, 1500)

    if (playingAsWhite) {
      speak('Партия началась! Вы играете белыми.')
      // Подсказываем первый ход
      setTimeout(() => makeMyFirstMove(), 2000)
    } else {
      speak('Партия началась! Вы играете чёрными. Ждите хода противника.')
    }
  }

  const undoMove = () => {
    const currentGame = gameRef.current
    if (currentGame.history().length < 2) {
      setStatus('Нечего отменять')
      speak('Нечего отменять')
      return
    }

    currentGame.undo() // Твой ход
    currentGame.undo() // Ход противника
    setGame(new Chess(currentGame.fen()))
    setFen(currentGame.fen())
    setStatus('Ход отменён')
    speak('Ход отменён')
  }

  const restartGame = () => {
    setIsListening(false)
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }

    const newGame = new Chess()
    setGame(newGame)
    gameRef.current = newGame
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

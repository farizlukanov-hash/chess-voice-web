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
  const isListeningRef = useRef(false)
  const sessionStartTimeRef = useRef(null)
  const lastMoveSpeechRef = useRef('')
  const lastOpponentMoveSpeechRef = useRef('')

  // Синхронизируем gameRef с game
  useEffect(() => {
    gameRef.current = game
  }, [game])

  // Синхронизируем isListeningRef с isListening
  useEffect(() => {
    isListeningRef.current = isListening
  }, [isListening])

  // Инициализация Stockfish через локальный Worker
  useEffect(() => {
    const initStockfish = () => {
      try {
        // Используем локальный Worker файл
        const worker = new Worker('/stockfish-worker.js')
        stockfishRef.current = worker

        worker.onmessage = (event) => {
          const msg = event.data
          if (msg.includes('Stockfish')) {
            console.log('[Stockfish] Инициализирован:', msg)
          }
        }

        worker.postMessage('uci')
        console.log('[Stockfish] Загружаю через Worker...')
      } catch (error) {
        console.error('[Stockfish] Ошибка загрузки:', error)
      }
    }
    initStockfish()

    // Загружаем голоса для TTS (важно для мобильных устройств)
    if ('speechSynthesis' in window) {
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices()
        console.log('[TTS] Доступные голоса:', voices.length)
        voices.forEach(voice => {
          if (voice.lang.startsWith('ru')) {
            console.log('[TTS] Русский голос:', voice.name, voice.lang)
          }
        })
      }

      // Голоса могут загружаться асинхронно
      if (window.speechSynthesis.getVoices().length > 0) {
        loadVoices()
      } else {
        window.speechSynthesis.onvoiceschanged = loadVoices
      }
    }
  }, [])

  // Инициализация Web Speech API (ОДИН РАЗ)
  useEffect(() => {
    console.log('[Инициализация] Проверяю поддержку Web Speech API...')
    console.log('[Инициализация] webkitSpeechRecognition:', 'webkitSpeechRecognition' in window)
    console.log('[Инициализация] SpeechRecognition:', 'SpeechRecognition' in window)

    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      console.log('[Инициализация] Web Speech API поддерживается!')
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      recognitionRef.current = new SpeechRecognition()
      recognitionRef.current.lang = 'ru-RU'
      recognitionRef.current.continuous = false  // Одна фраза за раз
      recognitionRef.current.interimResults = false
      recognitionRef.current.maxAlternatives = 1

      console.log('[Инициализация] SpeechRecognition создан:', recognitionRef.current)

      recognitionRef.current.onstart = () => {
        console.log('[Микрофон] Слушаю...')
        setStatus('🎤 Слушаю...')
      }

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript
        const confidence = event.results[0][0].confidence
        console.log('[Google] Распознал:', transcript, `(уверенность: ${(confidence * 100).toFixed(0)}%)`)
        processVoiceCommand(transcript)
      }

      recognitionRef.current.onerror = (event) => {
        console.log('[Микрофон] Событие onerror:', event.error)
        // Игнорируем aborted и no-speech - это нормально
        if (event.error === 'aborted' || event.error === 'no-speech') {
          return
        }

        // При network ошибке - автоматически перезапускаем
        if (event.error === 'network') {
          console.log('[Микрофон] Ошибка сети, перезапускаю...')
          setTimeout(() => {
            if (isListeningRef.current && recognitionRef.current) {
              try {
                recognitionRef.current.start()
              } catch (e) {
                console.log('[Микрофон] Не удалось перезапустить после network error')
              }
            }
          }, 500)
          return
        }

        console.error('[Микрофон] Ошибка:', event.error)
        setStatus(`❌ Ошибка микрофона: ${event.error}`)
      }

      recognitionRef.current.onend = () => {
        console.log('[Микрофон] Сессия завершена, перезапускаю сразу')
        // Перезапускаем СРАЗУ без задержки
        if (isListeningRef.current && recognitionRef.current) {
          try {
            recognitionRef.current.start()
            console.log('[Микрофон] Перезапущен')
          } catch (e) {
            console.log('[Микрофон] Не удалось перезапустить:', e.message)
            setStatus(`❌ Не удалось перезапустить: ${e.message}`)
            // Если не удалось - пробуем через 100ms
            setTimeout(() => {
              if (isListeningRef.current && recognitionRef.current) {
                try {
                  recognitionRef.current.start()
                } catch (err) {
                  console.log('[Микрофон] Повторная попытка не удалась')
                  setStatus(`❌ Микрофон не работает: ${err.message}`)
                }
              }
            }, 100)
          }
        }
      }

      console.log('[Инициализация] Все обработчики установлены')
    } else {
      console.error('[Микрофон] Web Speech API не поддерживается')
      setStatus('❌ Ваш браузер не поддерживает распознавание речи')
    }
  }, [])

  const speak = (text) => {
    console.log('[TTS] Попытка озвучить:', text)

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 0.85

      // Пытаемся найти русский голос
      const voices = window.speechSynthesis.getVoices()
      console.log('[TTS] Всего голосов:', voices.length)

      const russianVoice = voices.find(voice => voice.lang.startsWith('ru'))
      if (russianVoice) {
        utterance.voice = russianVoice
        utterance.lang = 'ru-RU'
        console.log('[TTS] Использую голос:', russianVoice.name)
      } else {
        // Используем первый доступный голос (любой язык)
        if (voices.length > 0) {
          utterance.voice = voices[0]
          utterance.lang = voices[0].lang
          console.log('[TTS] Русский голос не найден, использую:', voices[0].name, voices[0].lang)
        } else {
          console.log('[TTS] Голоса не загружены, использую дефолтный')
          utterance.lang = 'en-US' // Английский по умолчанию
        }
      }

      utterance.onstart = () => {
        console.log('[TTS] Озвучка началась')
      }

      utterance.onend = () => {
        console.log('[TTS] Озвучка завершена')
      }

      utterance.onerror = (event) => {
        // Игнорируем "interrupted" - это нормально когда новая озвучка начинается
        if (event.error === 'interrupted') {
          console.log('[TTS] Озвучка прервана (это нормально)')
          return
        }
        console.error('[TTS] Ошибка озвучки:', event.error)
        setStatus(`❌ Ошибка озвучки: ${event.error}`)
      }

      window.speechSynthesis.speak(utterance)
      console.log('[TTS] Команда speak() выполнена')
    } else {
      console.error('[TTS] Speech Synthesis не поддерживается')
      setStatus('❌ Ваш браузер не поддерживает озвучку. Используйте Chrome на Android или Safari на iOS')
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
      if (lastOpponentMoveSpeechRef.current && lastMoveSpeechRef.current) {
        speak(`Враг сходил ${lastOpponentMoveSpeechRef.current}. Ходи ${lastMoveSpeechRef.current}`)
      } else if (lastMoveSpeechRef.current) {
        speak(`Ходи ${lastMoveSpeechRef.current}`)
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

      // Сохраняем и озвучиваем ход противника
      const opponentSpeechText = ttsRef.current.moveToSpeech(opponentResult.san)
      lastOpponentMoveSpeechRef.current = opponentSpeechText
      speak(`Враг сходил ${opponentSpeechText}`)

      // Создаём новый объект для перерендера с той же историей
      const newGame = new Chess()
      const moves = currentGame.history({ verbose: true })
      moves.forEach(move => {
        newGame.move(move)
      })

      setGame(newGame)
      gameRef.current = newGame
      setFen(newGame.fen())

      // Проверка окончания после хода противника
      if (currentGame.isGameOver()) {
        handleGameOver()
        return
      }

      // 2. Вычисляем ТВОЙ лучший ход
      setStatus('Думаю...')

      // Небольшая задержка чтобы успеть озвучить ход противника
      setTimeout(() => {
        calculateBestMoveAndMake(currentGame)
      }, 1500)
    } catch (error) {
      console.error('[Ошибка]:', error)
      setStatus('Ошибка хода')
    }
  }

  const calculateBestMoveAndMake = (currentGame) => {
    const currentFen = currentGame.fen()

    if (!stockfishRef.current) {
      console.log('[Stockfish] НЕ ИНИЦИАЛИЗИРОВАН - используем fallback')
      // Fallback: случайный ход
      const moves = currentGame.moves()
      if (moves.length > 0) {
        const randomMove = moves[Math.floor(Math.random() * moves.length)]
        const moveObj = currentGame.move(randomMove)
        if (moveObj) {
          const newGame = new Chess(currentGame.fen())
          setGame(newGame)
          gameRef.current = newGame
          setFen(currentGame.fen())
          const speechText = ttsRef.current.moveToSpeech(moveObj.san)
          setLastMove(moveObj.san)
          setLastMoveSpeech(speechText)
          lastMoveSpeechRef.current = speechText
          setStatus(`✓ Ход обработан`)
          speak(`Ходи ${speechText}`)
          console.log('[DEBUG] Мой ход (fallback):', moveObj.san, '-> Речь:', speechText)
        }
      }
      return
    }

    console.log('[Stockfish] Отправляю позицию:', currentFen)
    stockfishRef.current.postMessage(`position fen ${currentFen}`)
    stockfishRef.current.postMessage('go movetime 2000')

    let responded = false

    const handleMessage = (event) => {
      const msg = event.data
      console.log('[Stockfish] Ответ:', msg)

      if (typeof msg === 'string' && msg.startsWith('bestmove') && !responded) {
        responded = true
        const bestMoveUCI = msg.split(' ')[1]
        console.log('[Stockfish] Лучший ход UCI:', bestMoveUCI)

        // Конвертируем UCI в SAN
        const moveObj = currentGame.move(bestMoveUCI, { sloppy: true })

        if (moveObj) {
          // Создаём новый объект для перерендера с той же историей
          const newGame = new Chess()
          const moves = currentGame.history({ verbose: true })
          moves.forEach(move => {
            newGame.move(move)
          })

          setGame(newGame)
          gameRef.current = newGame
          setFen(newGame.fen())

          // Конвертируем в речь
          const speechText = ttsRef.current.moveToSpeech(moveObj.san)

          setLastMove(moveObj.san)
          setLastMoveSpeech(speechText)
          lastMoveSpeechRef.current = speechText
          setStatus(`✓ Ход обработан`)

          // Озвучиваем
          speak(`Ходи ${speechText}`)

          console.log('[DEBUG] Мой ход:', moveObj.san, '-> Речь:', speechText)

          // Проверка окончания
          if (currentGame.isGameOver()) {
            handleGameOver()
          }
        }

        stockfishRef.current.onmessage = null
      }
    }

    stockfishRef.current.onmessage = handleMessage

    // Таймаут на случай если Stockfish не ответит
    setTimeout(() => {
      if (!responded) {
        console.log('[Stockfish] ТАЙМАУТ - используем fallback')
        stockfishRef.current.onmessage = null
        const moves = currentGame.moves()
        if (moves.length > 0) {
          const randomMove = moves[Math.floor(Math.random() * moves.length)]
          const moveObj = currentGame.move(randomMove)
          if (moveObj) {
            // Создаём новый объект для перерендера с той же историей
            const newGame = new Chess()
            const movesHistory = currentGame.history({ verbose: true })
            movesHistory.forEach(move => {
              newGame.move(move)
            })

            setGame(newGame)
            gameRef.current = newGame
            setFen(newGame.fen())
            const speechText = ttsRef.current.moveToSpeech(moveObj.san)
            setLastMove(moveObj.san)
            setLastMoveSpeech(speechText)
            lastMoveSpeechRef.current = speechText
            setStatus(`✓ Ход обработан`)
            speak(`Ходи ${speechText}`)
            console.log('[DEBUG] Мой ход (timeout fallback):', moveObj.san, '-> Речь:', speechText)
          }
        }
      }
    }, 5000)
  }

  const makeMyFirstMove = () => {
    const currentGame = gameRef.current
    const currentFen = currentGame.fen()

    setStatus('Думаю над первым ходом...')

    if (!stockfishRef.current) {
      console.log('[Stockfish] НЕ ИНИЦИАЛИЗИРОВАН - используем fallback')
      // Fallback
      const moves = currentGame.moves()
      if (moves.length > 0) {
        const randomMove = moves[Math.floor(Math.random() * moves.length)]
        const moveObj = currentGame.move(randomMove)
        if (moveObj) {
          const newGame = new Chess(currentGame.fen())
          setGame(newGame)
          gameRef.current = newGame
          setFen(currentGame.fen())
          const speechText = ttsRef.current.moveToSpeech(moveObj.san)
          setLastMove(moveObj.san)
          setLastMoveSpeech(speechText)
          lastMoveSpeechRef.current = speechText
          setStatus('✓ Готов')
          speak(`Ходи ${speechText}`)
          console.log('[DEBUG] Первый ход (fallback):', moveObj.san, '-> Речь:', speechText)
        }
      }
      return
    }

    console.log('[Stockfish] Отправляю начальную позицию:', currentFen)
    stockfishRef.current.postMessage(`position fen ${currentFen}`)
    stockfishRef.current.postMessage('go movetime 2000')

    let responded = false

    const handleMessage = (event) => {
      const msg = event.data
      console.log('[Stockfish] Ответ:', msg)

      if (typeof msg === 'string' && msg.startsWith('bestmove') && !responded) {
        responded = true
        const bestMoveUCI = msg.split(' ')[1]
        console.log('[Stockfish] Первый ход UCI:', bestMoveUCI)

        const moveObj = currentGame.move(bestMoveUCI, { sloppy: true })

        if (moveObj) {
          // Создаём новый объект для перерендера с той же историей
          const newGame = new Chess()
          const moves = currentGame.history({ verbose: true })
          moves.forEach(move => {
            newGame.move(move)
          })

          setGame(newGame)
          gameRef.current = newGame
          setFen(newGame.fen())

          const speechText = ttsRef.current.moveToSpeech(moveObj.san)
          setLastMove(moveObj.san)
          setLastMoveSpeech(speechText)
          lastMoveSpeechRef.current = speechText
          setStatus('✓ Готов')

          speak(`Ходи ${speechText}`)
          console.log('[DEBUG] Первый ход:', moveObj.san, '-> Речь:', speechText)
        }

        stockfishRef.current.onmessage = null
      }
    }

    stockfishRef.current.onmessage = handleMessage

    // Таймаут
    setTimeout(() => {
      if (!responded) {
        console.log('[Stockfish] ТАЙМАУТ на первом ходе - используем fallback')
        stockfishRef.current.onmessage = null
        const moves = currentGame.moves()
        if (moves.length > 0) {
          const randomMove = moves[Math.floor(Math.random() * moves.length)]
          const moveObj = currentGame.move(randomMove)
          if (moveObj) {
            // Создаём новый объект для перерендера с той же историей
            const newGame = new Chess()
            const movesHistory = currentGame.history({ verbose: true })
            movesHistory.forEach(move => {
              newGame.move(move)
            })

            setGame(newGame)
            gameRef.current = newGame
            setFen(newGame.fen())
            const speechText = ttsRef.current.moveToSpeech(moveObj.san)
            setLastMove(moveObj.san)
            setLastMoveSpeech(speechText)
            lastMoveSpeechRef.current = speechText
            setStatus('✓ Готов')
            speak(`Ходи ${speechText}`)
            console.log('[DEBUG] Первый ход (timeout fallback):', moveObj.san, '-> Речь:', speechText)
          }
        }
      }
    }, 5000)
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

  const startGame = async () => {
    console.log('[startGame] Начинаю игру...')

    // Явно запрашиваем разрешение на микрофон (важно для мобильных)
    try {
      console.log('[startGame] Запрашиваю разрешение на микрофон...')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      console.log('[Микрофон] Разрешение получено')
      // Останавливаем поток - он нам не нужен, нужно только разрешение
      stream.getTracks().forEach(track => track.stop())
    } catch (error) {
      console.error('[Микрофон] Не удалось получить разрешение:', error)
      setStatus(`❌ Разрешите доступ к микрофону в настройках браузера`)
      speak('Разрешите доступ к микрофону')
      return
    }

    const newGame = new Chess()
    setGame(newGame)
    gameRef.current = newGame
    setFen(newGame.fen())
    setGameStarted(true)
    setLastMove('')
    setLastMoveSpeech('')
    lastMoveSpeechRef.current = ''
    lastOpponentMoveSpeechRef.current = ''

    console.log('[startGame] Игра инициализирована')

    // Тестовая озвучка для активации TTS на мобильных
    speak('Партия началась')

    // СРАЗУ запускаем прослушивание
    console.log('[startGame] Устанавливаю isListening = true')
    setIsListening(true)

    setTimeout(() => {
      console.log('[startGame] Пытаюсь запустить микрофон...')
      console.log('[startGame] recognitionRef.current:', recognitionRef.current)
      console.log('[startGame] isListeningRef.current:', isListeningRef.current)

      if (recognitionRef.current) {
        try {
          console.log('[startGame] Вызываю recognition.start()...')
          recognitionRef.current.start()
          console.log('[Микрофон] Запущен после получения разрешения')
        } catch (e) {
          console.error('[Микрофон] Ошибка запуска:', e)
          console.error('[Микрофон] Ошибка stack:', e.stack)
          setStatus(`❌ Не удалось запустить микрофон: ${e.message}. Проверьте разрешения в браузере.`)
        }
      } else {
        console.error('[startGame] recognitionRef.current is null!')
        setStatus('❌ Микрофон не инициализирован. Перезагрузите страницу.')
      }
    }, 2000)

    if (playingAsWhite) {
      console.log('[startGame] Играю за белых, делаю первый ход...')
      // Подсказываем первый ход
      setTimeout(() => makeMyFirstMove(), 3000)
    } else {
      console.log('[startGame] Играю за чёрных')
      speak('Вы играете чёрными. Ждите хода противника.')
    }
  }

  const undoMove = () => {
    const currentGame = gameRef.current
    const historyLength = currentGame.history().length

    console.log('[DEBUG] Отмена: история содержит', historyLength, 'ходов')
    console.log('[DEBUG] История:', currentGame.history())

    if (historyLength === 0) {
      setStatus('Нечего отменять')
      speak('Нечего отменять')
      return
    }

    // Отменяем последний ход (или два хода если их было два)
    currentGame.undo()
    console.log('[DEBUG] Отменён 1 ход, осталось:', currentGame.history().length)

    if (currentGame.history().length > 0) {
      currentGame.undo()
      console.log('[DEBUG] Отменён 2 ход, осталось:', currentGame.history().length)
    }

    // Создаём новый объект для перерендера, но с той же позицией и историей
    const newGame = new Chess()
    const moves = currentGame.history({ verbose: true })
    moves.forEach(move => {
      newGame.move(move)
    })

    setGame(newGame)
    gameRef.current = newGame
    setFen(newGame.fen())
    setStatus('Ход отменён')
    speak('Ход отменён')

    // Очищаем последние ходы для "ещё раз"
    lastMoveSpeechRef.current = ''
    lastOpponentMoveSpeechRef.current = ''
    setLastMove('')
    setLastMoveSpeech('')

    console.log('[DEBUG] Новая позиция:', newGame.fen())
    console.log('[DEBUG] Новая история:', newGame.history())
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
    lastMoveSpeechRef.current = ''
    lastOpponentMoveSpeechRef.current = ''
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

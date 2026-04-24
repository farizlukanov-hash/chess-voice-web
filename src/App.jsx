import React, { useState, useEffect, useRef } from 'react'
import ChessBoard from './components/ChessBoard'
import Controls from './components/Controls'
import StatusPanel from './components/StatusPanel'
import MicrophoneTest from './components/MicrophoneTest'
import { Chess } from 'chess.js'
import { VoiceParser } from './utils/VoiceParser'
import { TTSEngine } from './utils/TTSEngine'
import { NativeVoiceRecognition } from './utils/NativeVoice'
import { Capacitor } from '@capacitor/core'
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
  const [micStream, setMicStream] = useState(null)
  const [showMicTest, setShowMicTest] = useState(false)

  const recognitionRef = useRef(null)
  const nativeVoiceRef = useRef(null)
  const stockfishRef = useRef(null)
  const parserRef = useRef(new VoiceParser())
  const ttsRef = useRef(new TTSEngine())
  const gameRef = useRef(game)
  const isListeningRef = useRef(false)
  const sessionStartTimeRef = useRef(null)
  const lastMoveSpeechRef = useRef('')
  const lastOpponentMoveSpeechRef = useRef('')
  const isNative = Capacitor.isNativePlatform()

  console.log('[App] Инициализация, isNative:', isNative)
  console.log('[App] Capacitor.isNativePlatform():', Capacitor.isNativePlatform())
  console.log('[App] webkitSpeechRecognition доступен:', 'webkitSpeechRecognition' in window)
  console.log('[App] SpeechRecognition доступен:', 'SpeechRecognition' in window)

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

  // Инициализация нативного распознавания (ОДИН РАЗ)
  useEffect(() => {
    console.log('[Инициализация] Платформа:', isNative ? 'Native' : 'Web')

    if (isNative) {
      console.log('[Инициализация] Использую нативное Android распознавание')
      nativeVoiceRef.current = new NativeVoiceRecognition()
    } else {
      console.log('[Инициализация] Использую Web Speech API для браузера')

      // Инициализируем Web Speech API для браузера
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
        recognitionRef.current = new SpeechRecognition()
        recognitionRef.current.lang = 'ru-RU'
        recognitionRef.current.continuous = false
        recognitionRef.current.interimResults = false
        recognitionRef.current.maxAlternatives = 1

        console.log('[Web Speech] Инициализирован')

        recognitionRef.current.onstart = () => {
          console.log('[Web Speech] onstart - Слушаю...')
          setStatus('🎤 Слушаю...')
        }

        recognitionRef.current.onresult = (event) => {
          const transcript = event.results[0][0].transcript
          const confidence = event.results[0][0].confidence
          console.log('[Web Speech] onresult - Распознано:', transcript, `(${(confidence * 100).toFixed(0)}%)`)
          processVoiceCommand(transcript)
        }

        recognitionRef.current.onerror = (event) => {
          console.log('[Web Speech] onerror - Событие:', event.error)
          console.log('[Web Speech] onerror - Полный event:', event)

          // Игнорируем aborted и no-speech
          if (event.error === 'aborted' || event.error === 'no-speech') {
            console.log('[Web Speech] Игнорирую ошибку:', event.error)
            return
          }

          // При network ошибке - автоматически перезапускаем
          if (event.error === 'network') {
            console.log('[Web Speech] Ошибка сети, перезапускаю через 500мс...')
            setTimeout(() => {
              if (isListeningRef.current && recognitionRef.current) {
                try {
                  recognitionRef.current.start()
                  console.log('[Web Speech] Перезапущен после network error')
                } catch (e) {
                  console.log('[Web Speech] Не удалось перезапустить:', e.message)
                }
              }
            }, 500)
            return
          }

          // not-allowed - показываем пользователю
          if (event.error === 'not-allowed') {
            console.error('[Web Speech] NOT-ALLOWED - доступ запрещён!')
            setStatus('❌ Доступ к микрофону запрещён')
            setIsListening(false)
            alert('Доступ к микрофону запрещён. Проверьте настройки браузера:\n1. Нажмите на иконку замка в адресной строке\n2. Разрешите доступ к микрофону\n3. Перезагрузите страницу')
            return
          }

          console.error('[Web Speech] Ошибка:', event.error)
          setStatus(`❌ Ошибка микрофона: ${event.error}`)
        }

        recognitionRef.current.onend = () => {
          console.log('[Web Speech] onend - Сессия завершена')
          console.log('[Web Speech] isListeningRef.current:', isListeningRef.current)

          if (isListeningRef.current && recognitionRef.current) {
            try {
              console.log('[Web Speech] Перезапускаю...')
              recognitionRef.current.start()
              console.log('[Web Speech] Перезапущен успешно')
            } catch (error) {
              console.log('[Web Speech] Ошибка перезапуска:', error.message)
              if (error.name === 'InvalidStateError') {
                console.log('[Web Speech] Уже запущен, пропускаю')
              }
            }
          } else {
            console.log('[Web Speech] НЕ перезапускаю (isListening=false)')
          }
        }
      } else {
        console.error('[Web Speech] Не поддерживается в этом браузере')
      }
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

  const startListening = async () => {
    console.log('[startListening] Запускаю распознавание...')
    console.log('[startListening] isNative:', isNative)
    console.log('[startListening] window.AndroidVoice:', typeof window.AndroidVoice)

    setIsListening(true)

    // Проверяем наличие AndroidVoice напрямую
    if (typeof window.AndroidVoice !== 'undefined') {
      console.log('[startListening] AndroidVoice найден! Использую его напрямую')

      if (!nativeVoiceRef.current) {
        console.log('[startListening] Создаю NativeVoiceRecognition')
        nativeVoiceRef.current = new NativeVoiceRecognition()
      }

      const success = await nativeVoiceRef.current.start(
        (text) => {
          console.log('[NativeVoice] Распознано:', text)
          processVoiceCommand(text)
        },
        (error) => {
          console.error('[NativeVoice] Ошибка:', error)
          setStatus(`❌ Ошибка микрофона: ${error}`)
        }
      )

      if (success) {
        console.log('[NativeVoice] Распознавание запущено')
        setStatus('🎤 Слушаю...')
      } else {
        console.error('[NativeVoice] Не удалось запустить распознавание')
        setStatus('❌ Не удалось запустить микрофон')
        setIsListening(false)
      }
    } else if (recognitionRef.current) {
      // Используем Web Speech API для браузера
      console.log('[startListening] Использую Web Speech API')

      try {
        // ВАЖНО: Сначала запрашиваем getUserMedia для гарантии разрешения
        console.log('[startListening] Запрашиваю getUserMedia для подтверждения разрешения...')
        setStatus('🎤 Запрашиваю разрешение...')

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        })

        console.log('[startListening] getUserMedia успешно, останавливаю поток')
        stream.getTracks().forEach(track => track.stop())

        // Небольшая задержка перед запуском Web Speech API
        await new Promise(resolve => setTimeout(resolve, 100))

        // Теперь запускаем Web Speech API
        console.log('[startListening] Вызываю recognition.start()...')
        recognitionRef.current.start()
        console.log('[Web Speech] start() вызван')
        setStatus('🎤 Запускаю...')
      } catch (error) {
        console.error('[Web Speech] Ошибка запуска:', error)
        console.error('[Web Speech] Error name:', error.name)
        console.error('[Web Speech] Error message:', error.message)

        if (error.name === 'InvalidStateError') {
          console.log('[Web Speech] Уже запущен')
          setStatus('🎤 Слушаю...')
        } else if (error.name === 'NotAllowedError') {
          setStatus('❌ Доступ к микрофону запрещён')
          setIsListening(false)
          alert('Доступ к микрофону запрещён.\n\nИнструкция:\n1. Нажмите на иконку замка в адресной строке\n2. Найдите "Микрофон"\n3. Выберите "Разрешить"\n4. Перезагрузите страницу\n5. Попробуйте снова')
        } else {
          setStatus(`❌ Ошибка: ${error.message}`)
          setIsListening(false)
          alert(`Ошибка запуска распознавания: ${error.message}`)
        }
      }
    } else {
      console.error('[startListening] Распознавание недоступно')
      console.error('[startListening] recognitionRef.current:', recognitionRef.current)
      setStatus('❌ Распознавание речи не поддерживается в этом браузере. Используйте Chrome или Edge.')
      setIsListening(false)
      alert('Распознавание речи не поддерживается в этом браузере. Используйте Chrome или Edge.')
    }
  }

  const stopListening = async () => {
    console.log('[stopListening] Останавливаю распознавание...')

    setIsListening(false)

    if (nativeVoiceRef.current) {
      await nativeVoiceRef.current.stop()
      console.log('[NativeVoice] Остановлен')
    } else if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
        console.log('[Web Speech] Остановлен')
      } catch (error) {
        console.log('[Web Speech] Ошибка остановки:', error.message)
      }
    }

    setStatus('Прослушивание остановлено')
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
    stopListening()

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

    // НЕ запускаем микрофон автоматически - пользователь должен нажать кнопку
    // Это требование мобильных браузеров для Web Speech API
    console.log('[startGame] Микрофон НЕ запускается автоматически')
    console.log('[startGame] Пользователь должен нажать кнопку "Включить прослушивание"')

    if (playingAsWhite) {
      console.log('[startGame] Играю за белых, делаю первый ход...')
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
    stopListening()

    // Останавливаем микрофон stream если он активен
    if (micStream) {
      micStream.getTracks().forEach(track => track.stop())
      setMicStream(null)
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
            continuousListening={isListening}
            onStartGame={startGame}
            onRestartGame={restartGame}
            onStartListening={startListening}
            onStopListening={stopListening}
            onSideChange={setPlayingAsWhite}
            onOpenMicTest={() => setShowMicTest(true)}
          />
        </div>
      </div>

      {showMicTest && (
        <MicrophoneTest onClose={() => setShowMicTest(false)} />
      )}
    </div>
  )
}

export default App

// VoiceParser - точная копия логики из Python версии
export class VoiceParser {
  constructor() {
    // Словарь фигур (с окончаниями для падежей)
    this.pieces = {
      'пешка': '',
      'пешкой': '',
      'пешку': '',
      'пешки': '',
      'конь': 'N',
      'кони': 'N',
      'коней': 'N',
      'лошадь': 'N',
      'коне': 'N',
      'конём': 'N',
      'конем': 'N',
      'слон': 'B',
      'слоны': 'B',
      'слонов': 'B',
      'слоне': 'B',
      'слоном': 'B',
      'ладья': 'R',
      'ладьи': 'R',
      'ладей': 'R',
      'тура': 'R',
      'ладье': 'R',
      'ладьёй': 'R',
      'ладьей': 'R',
      'ферзь': 'Q',
      'ферзи': 'Q',
      'ферзей': 'Q',
      'королева': 'Q',
      'королеву': 'Q',
      'королевой': 'Q',
      'дама': 'Q',
      'даму': 'Q',
      'дамой': 'Q',
      'ферзе': 'Q',
      'ферзём': 'Q',
      'ферзем': 'Q',
      'король': 'K',
      'королём': 'K',
      'королем': 'K',
      'короля': 'K',
    }

    // Словарь вертикалей
    this.files = {
      'а': 'a', 'a': 'a',
      'бэ': 'b', 'бе': 'b', 'б': 'b', 'be': 'b', 'b': 'b',
      'цэ': 'c', 'це': 'c', 'ц': 'c', 'си': 'c', 'с': 'c', 'c': 'c',
      'дэ': 'd', 'де': 'd', 'д': 'd', 'di': 'd', 'd': 'd',
      'е': 'e', 'э': 'e', 'и': 'e', 'e': 'e',
      'я': 'e', // Частая ошибка: "я" вместо "е"
      'эф': 'f', 'еф': 'f', 'ф': 'f', 'ef': 'f', 'f': 'f',
      'эх': 'f', // Частая ошибка: "эх" вместо "эф"
      'в': 'f', // Частая ошибка: "в" вместо "ф"
      'жэ': 'g', 'же': 'g', 'ж': 'g', 'джи': 'g', 'г': 'g', 'g': 'g',
      'аш': 'h', 'ха': 'h', 'х': 'h', 'эйч': 'h', 'h': 'h',
    }

    // Словарь горизонталей
    this.ranks = {
      'один': '1', 'раз': '1', '1': '1',
      'два': '2', 'двойка': '2', '2': '2',
      'три': '3', 'тройка': '3', '3': '3',
      'четыре': '4', 'четвёрка': '4', '4': '4',
      'пять': '5', 'пятёрка': '5', '5': '5',
      'шесть': '6', 'шестёрка': '6', '6': '6',
      'семь': '7', 'семёрка': '7', '7': '7',
      'восемь': '8', 'восьмёрка': '8', '8': '8',
    }

    // Специальные ходы
    this.specialMoves = {
      'короткая рокировка': 'O-O',
      'рокировка короткая': 'O-O',
      'длинная рокировка': 'O-O-O',
      'рокировка длинная': 'O-O-O',
    }
  }

  parse(text) {
    text = text.toLowerCase().trim()

    // Проверка специальных ходов
    for (const [phrase, move] of Object.entries(this.specialMoves)) {
      if (text.includes(phrase)) {
        return move
      }
    }

    // Удаляем лишние слова
    text = this._cleanText(text)

    // Разбиваем на токены
    const tokens = text.split(/\s+/)

    if (tokens.length < 1) {
      return null
    }

    // СНАЧАЛА ищем паттерн: [фигура] + [поле]
    for (let i = 0; i < tokens.length; i++) {
      const piece = this._parsePiece(tokens[i])

      if (piece !== null) {
        // Нашли фигуру, ищем поле в следующих токенах
        const targetSquare = this._parseSquare(tokens.slice(i + 1))
        if (targetSquare) {
          return piece ? `${piece}${targetSquare}` : targetSquare
        }

        // Проверяем слитный формат: "слоне" + "5" = "слон е5"
        if (i + 1 < tokens.length) {
          const nextToken = tokens[i + 1]
          if (this.ranks[nextToken]) {
            const lastChar = tokens[i][tokens[i].length - 1]
            if (this.files[lastChar]) {
              const fileChar = this.files[lastChar]
              const rankChar = this.ranks[nextToken]
              return piece ? `${piece}${fileChar}${rankChar}` : `${fileChar}${rankChar}`
            }
          }
        }
      }
    }

    // ПОТОМ пробуем найти прямой формат "g5", "nf3"
    const directMove = this._parseDirectMove(text)
    if (directMove) {
      return directMove
    }

    // В конце проверяем может это просто поле (пешка)
    for (let i = 0; i < tokens.length; i++) {
      const targetSquare = this._parseSquare(tokens.slice(i))
      if (targetSquare) {
        return targetSquare
      }
    }

    return null
  }

  _cleanText(text) {
    // Исправляем частые ошибки распознавания
    text = text.replace(/\bконев\s+(\d)/g, 'конь ф $1')
    text = text.replace(/\bладьев\s+(\d)/g, 'ладья ф $1')
    text = text.replace(/\bслонов\s+(\d)/g, 'слон ф $1')
    text = text.replace(/\bферзев\s+(\d)/g, 'ферзь ф $1')

    // Исправляем "в" → "ф" когда рядом цифра (частая ошибка Google)
    text = text.replace(/\bв\s+(\d)/g, 'ф $1')
    text = text.replace(/\b([а-я]+)\s+в\s+(\d)/g, '$1 ф $2')

    // Исправляем "эх" → "эф" (частая ошибка для буквы F)
    text = text.replace(/\bэх\s+(\d)/g, 'эф $1')
    text = text.replace(/\b([а-я]+)\s+эх\s+(\d)/g, '$1 эф $2')

    // Убираем лишние пробелы между буквой и цифрой (Google часто добавляет)
    text = text.replace(/([а-яa-h])\s+(\d)/g, '$1$2')

    // Убираем окончания
    text = text.replace(/пешкой/g, 'пешка')
    text = text.replace(/пешку/g, 'пешка')
    text = text.replace(/пешки/g, 'пешка')
    text = text.replace(/конём/g, 'конь')
    text = text.replace(/конем/g, 'конь')
    text = text.replace(/кони/g, 'конь')
    text = text.replace(/коней/g, 'конь')
    text = text.replace(/слоном/g, 'слон')
    text = text.replace(/слоны/g, 'слон')
    text = text.replace(/слонов/g, 'слон')
    text = text.replace(/ладьёй/g, 'ладья')
    text = text.replace(/ладьей/g, 'ладья')
    text = text.replace(/ладьи/g, 'ладья')
    text = text.replace(/ладей/g, 'ладья')
    text = text.replace(/ферзём/g, 'ферзь')
    text = text.replace(/ферзем/g, 'ферзь')
    text = text.replace(/ферзи/g, 'ферзь')
    text = text.replace(/ферзей/g, 'ферзь')
    text = text.replace(/королём/g, 'король')
    text = text.replace(/королем/g, 'король')
    text = text.replace(/короля/g, 'король')
    text = text.replace(/королеву/g, 'королева')
    text = text.replace(/королевой/g, 'королева')
    text = text.replace(/даму/g, 'дама')
    text = text.replace(/дамой/g, 'дама')

    // Убираем слова-паразиты
    const noiseWords = [
      'ход', 'делаю', 'хожу', 'иду', 'берёт', 'берет', 'бьёт', 'бьет',
      'тааак', 'так', 'хм', 'ну', 'эм', 'ээ', 'ага', 'да', 'нет',
      'он', 'она', 'они', 'сходил', 'сходила', 'пошёл', 'пошла',
      'наверное', 'может', 'давай', 'ладно', 'окей', 'хорошо',
      'походил', 'сделал', 'сделала', 'пошли', 'идёт', 'идет'
    ]

    const words = text.split(/\s+/)
    const filtered = words.filter(w => !noiseWords.includes(w))
    return filtered.join(' ').trim()
  }

  _parseDirectMove(text) {
    // Паттерн: [фигура]буква-цифра
    const pattern = /\b([nbrqk])?([a-h])([1-8])\b/i
    const match = text.match(pattern)

    if (match) {
      const piece = match[1]
      const file = match[2].toLowerCase()
      const rank = match[3]

      if (piece) {
        return `${piece.toUpperCase()}${file}${rank}`
      } else {
        return `${file}${rank}`
      }
    }

    return null
  }

  _parsePiece(token) {
    if (this.pieces[token] !== undefined) {
      return this.pieces[token]
    }
    return null
  }

  _parseSquare(tokens) {
    let fileChar = null
    let rankChar = null

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]

      // Проверяем слитный формат "е5", "a4"
      if (token.length === 2) {
        const firstChar = token[0]
        const secondChar = token[1]

        if (this.files[firstChar] && this.ranks[secondChar]) {
          return `${this.files[firstChar]}${this.ranks[secondChar]}`
        }
      }

      // Ищем вертикаль
      if (this.files[token]) {
        fileChar = this.files[token]
        // Следующий токен должен быть горизонталью
        if (i + 1 < tokens.length) {
          const nextToken = tokens[i + 1]
          if (this.ranks[nextToken]) {
            rankChar = this.ranks[nextToken]
            break
          }
        }
      }
    }

    if (fileChar && rankChar) {
      return `${fileChar}${rankChar}`
    }

    return null
  }

  parseWithContext(text, legalMoves, strictMode = true) {
    const parsed = this.parse(text)

    if (!parsed) {
      // Попытка угадать ход если названа только фигура + цифра (без буквы)
      const textLower = text.toLowerCase()

      // Ищем фигуру в тексте
      let detectedPiece = null
      for (const [pieceName, pieceSymbol] of Object.entries(this.pieces)) {
        if (textLower.includes(pieceName)) {
          detectedPiece = pieceSymbol
          break
        }
      }

      // Ищем цифру (горизонталь)
      let detectedRank = null
      for (const [rankName, rankSymbol] of Object.entries(this.ranks)) {
        if (textLower.includes(rankName)) {
          detectedRank = rankSymbol
          break
        }
      }

      // Ищем букву (вертикаль) - ВАЖНО проверить ДО угадывания
      let detectedFile = null
      for (const [fileName, fileSymbol] of Object.entries(this.files)) {
        if (textLower.includes(fileName)) {
          detectedFile = fileSymbol
          break
        }
      }

      // Если нашли фигуру + вертикаль + горизонталь, пробуем собрать ход
      if (detectedPiece && detectedFile && detectedRank) {
        const constructedMove = detectedPiece ? `${detectedPiece}${detectedFile}${detectedRank}` : `${detectedFile}${detectedRank}`

        // Проверяем что такой ход легален
        for (const move of legalMoves) {
          const cleanMove = move.replace(/[x+#]/g, '')
          if (cleanMove === constructedMove || cleanMove.endsWith(`${detectedFile}${detectedRank}`)) {
            console.log(`[Parser] Собрал ход из частей: ${move} (фигура: ${detectedPiece}, вертикаль: ${detectedFile}, горизонталь: ${detectedRank})`)
            return move
          }
        }
      }

      // Если нашли фигуру + горизонталь БЕЗ вертикали, пробуем найти подходящий ход
      if (detectedPiece && detectedRank && !detectedFile) {
        for (const move of legalMoves) {
          const cleanMove = move.replace(/[x+#]/g, '')

          // Проверяем что ход этой фигуры и на эту горизонталь
          if (cleanMove[0] === detectedPiece && cleanMove[cleanMove.length - 1] === detectedRank) {
            console.log(`[Parser] Угадал ход: ${move} (фигура: ${detectedPiece}, горизонталь: ${detectedRank})`)
            return move
          }
        }
      }

      return null
    }

    // СТРОГИЙ РЕЖИМ: проверяем что фигура была названа
    if (strictMode) {
      const textLower = text.toLowerCase()
      const hasPieceName = Object.keys(this.pieces).some(piece => textLower.includes(piece))

      // Если parsed это ход пешки и не было слова "пешка"
      if (!/^[A-Z]/.test(parsed) && !hasPieceName) {
        return null
      }
    }

    // ВАЖНО: Если parsed это ход пешки, проверяем что указана буква вертикали
    if (!/^[A-Z]/.test(parsed)) {
      // Это ход пешки - должна быть буква + цифра (e4, a6 и т.д.)
      if (parsed.length < 2) {
        // Только цифра без буквы - отклоняем
        return null
      }
    }

    // Проверяем прямое совпадение
    if (legalMoves.includes(parsed)) {
      return parsed
    }

    // Убираем символы взятия и шаха
    const cleanParsed = parsed.replace(/[x+#]/g, '')

    // Ищем похожие ходы
    for (const move of legalMoves) {
      const cleanMove = move.replace(/[x+#]/g, '')

      // Если в parsed есть фигура (заглавная буква)
      if (/^[A-Z]/.test(cleanParsed)) {
        const piece = cleanParsed[0]
        const targetSquare = cleanParsed.slice(-2)

        if (cleanMove[0] === piece && cleanMove.slice(-2) === targetSquare) {
          return move
        }
      } else {
        // Это ход пешки
        if (!/^[A-Z]/.test(cleanMove)) {
          if (cleanMove === cleanParsed) {
            return move
          }
          if (move.includes('x') && cleanMove.endsWith(cleanParsed.slice(-2))) {
            return move
          }
          if (move.includes('=') && cleanMove.startsWith(cleanParsed)) {
            return move
          }
        }
      }
    }

    return null
  }
}

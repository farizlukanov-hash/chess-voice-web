// TTSEngine - преобразование SAN в речь (точная копия из Python)
export class TTSEngine {
  constructor() {
    // Обратный словарь фигур
    this.pieces = {
      'N': 'конь',
      'B': 'слон',
      'R': 'ладья',
      'Q': 'ферзь',
      'K': 'король',
    }

    // Обратный словарь вертикалей
    this.files = {
      'a': 'а',
      'b': 'бэ',
      'c': 'цэ',
      'd': 'дэ',
      'e': 'е',
      'f': 'эф',
      'g': 'жэ',
      'h': 'аш',
    }

    // Обратный словарь горизонталей
    this.ranks = {
      '1': 'один',
      '2': 'два',
      '3': 'три',
      '4': 'четыре',
      '5': 'пять',
      '6': 'шесть',
      '7': 'семь',
      '8': 'восемь',
    }
  }

  moveToSpeech(move) {
    // Рокировки
    if (move === 'O-O' || move === '0-0') {
      return 'короткая рокировка'
    }
    if (move === 'O-O-O' || move === '0-0-0') {
      return 'длинная рокировка'
    }

    // Убираем символы взятия и шаха
    move = move.replace(/[x+#]/g, '')

    // SAN формат (Nc6, e4, Bb5)
    let pieceName = 'пешкой'
    let startIdx = 0

    if (move[0] && move[0] === move[0].toUpperCase() && /[A-Z]/.test(move[0])) {
      pieceName = this.pieces[move[0]] + 'ом'
      startIdx = 1
    }

    // Извлекаем поле назначения (последние 2 символа)
    if (move.length >= startIdx + 2) {
      const fileChar = move[move.length - 2]
      const rankChar = move[move.length - 1]

      const fileName = this.files[fileChar] || fileChar
      const rankName = this.ranks[rankChar] || rankChar

      return `${pieceName} ${fileName} ${rankName}`
    }

    return 'ход сделан'
  }
}

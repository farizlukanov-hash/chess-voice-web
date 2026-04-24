# 📋 ИНСТРУКЦИЯ ПО ДЕПЛОЮ НА VERCEL

## Шаг 1: Проверка проекта локально

1. Открой терминал в папке `chess-voice-web`
2. Запусти:
```bash
npm run dev
```
3. Открой http://localhost:3000 в браузере
4. Проверь, что всё работает (доска, кнопки)
5. Нажми Ctrl+C чтобы остановить

## Шаг 2: Создание GitHub репозитория

1. Зайди на https://github.com
2. Нажми "New repository" (зелёная кнопка)
3. Название: `chess-voice-web`
4. Описание: `Голосовой шахматный помощник`
5. Выбери "Public"
6. НЕ добавляй README, .gitignore (уже есть)
7. Нажми "Create repository"

## Шаг 3: Загрузка кода на GitHub

Выполни команды в терминале (в папке chess-voice-web):

```bash
git init
git add .
git commit -m "initial commit: chess voice web app"
git branch -M main
git remote add origin https://github.com/ВАШ_USERNAME/chess-voice-web.git
git push -u origin main
```

**ВАЖНО:** Замени `ВАШ_USERNAME` на свой GitHub username!

## Шаг 4: Деплой на Vercel

### Вариант A: Через сайт (проще)

1. Зайди на https://vercel.com
2. Нажми "Continue with GitHub"
3. Авторизуйся через GitHub
4. Нажми "Add New..." → "Project"
5. Найди репозиторий `chess-voice-web`
6. Нажми "Import"
7. Настройки оставь по умолчанию (Vercel сам определит Vite)
8. Нажми "Deploy"
9. Жди 2-3 минуты
10. Готово! Получишь ссылку типа `https://chess-voice-web.vercel.app`

### Вариант B: Через CLI (для продвинутых)

```bash
npm install -g vercel
vercel login
vercel
```

Следуй инструкциям в терминале.

## Шаг 5: Тестирование

1. Открой ссылку от Vercel в Chrome на телефоне
2. Нажми "Начать игру"
3. Нажми "🎤 Сказать ход"
4. Разреши доступ к микрофону
5. Скажи "e2 e4"
6. Проверь, что ход сработал

## Шаг 6: Telegram Mini App (опционально)

1. Открой @BotFather в Telegram
2. Создай нового бота или используй существующего
3. Отправь команду `/newapp`
4. Выбери своего бота
5. Введи название: `Цифровой Суфлёр`
6. Введи описание
7. Загрузи иконку (512x512 PNG)
8. Введи URL от Vercel: `https://chess-voice-web.vercel.app`
9. Готово! Теперь можно открыть через Telegram

## Возможные проблемы

### Микрофон не работает
- Проверь, что сайт открыт через HTTPS (на Vercel автоматически)
- Дай разрешение на микрофон в браузере
- Используй Chrome/Edge (лучшая поддержка)

### Stockfish медленный
- Это нормально для веб-версии
- Можно уменьшить глубину поиска в коде (depth 10 → depth 5)

### Голос не распознаётся
- Говори чётко: "е два е четыре"
- Проверь язык распознавания (должен быть русский)
- Попробуй в обычном браузере (не в Telegram)

## Обновление проекта

После изменений в коде:

```bash
git add .
git commit -m "описание изменений"
git push
```

Vercel автоматически задеплоит новую версию!

## Полезные ссылки

- Vercel Dashboard: https://vercel.com/dashboard
- GitHub Repo: https://github.com/ВАШ_USERNAME/chess-voice-web
- Документация Vercel: https://vercel.com/docs

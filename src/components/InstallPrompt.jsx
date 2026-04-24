import React, { useState, useEffect } from 'react'
import './InstallPrompt.css'

function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showInstallButton, setShowInstallButton] = useState(false)

  useEffect(() => {
    // Слушаем событие beforeinstallprompt
    const handler = (e) => {
      console.log('[PWA] beforeinstallprompt событие')
      e.preventDefault()
      setDeferredPrompt(e)
      setShowInstallButton(true)
    }

    window.addEventListener('beforeinstallprompt', handler)

    // Проверяем, уже установлено ли приложение
    if (window.matchMedia('(display-mode: standalone)').matches) {
      console.log('[PWA] Приложение уже установлено')
      setShowInstallButton(false)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      return
    }

    console.log('[PWA] Показываю prompt установки')
    deferredPrompt.prompt()

    const { outcome } = await deferredPrompt.userChoice
    console.log('[PWA] Результат установки:', outcome)

    if (outcome === 'accepted') {
      console.log('[PWA] Пользователь установил приложение')
    } else {
      console.log('[PWA] Пользователь отклонил установку')
    }

    setDeferredPrompt(null)
    setShowInstallButton(false)
  }

  if (!showInstallButton) {
    return null
  }

  return (
    <div className="install-prompt">
      <button onClick={handleInstallClick} className="install-button">
        📱 Установить приложение
      </button>
      <p className="install-hint">
        Установи на домашний экран для лучшей работы микрофона
      </p>
    </div>
  )
}

export default InstallPrompt

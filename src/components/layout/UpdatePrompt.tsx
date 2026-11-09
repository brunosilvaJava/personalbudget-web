import { useEffect } from 'react'
import { toast } from 'sonner'
import { useRegisterSW } from 'virtual:pwa-register/react'

const TOAST_ID = 'pwa-update'
const CHECK_EVERY_MS = 60 * 60 * 1000

/**
 * Registers the service worker and, when a new version of the app is waiting, says so and offers to
 * reload. It never swaps the version by itself: a reload in the middle of a form would lose it.
 * An installed app that stays open is checked once an hour.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      setInterval(() => {
        if (navigator.onLine) void registration.update()
      }, CHECK_EVERY_MS)
    },
    onRegisterError(error) {
      console.error('service worker registration failed', error)
    },
  })

  useEffect(() => {
    if (!needRefresh) return
    toast('Nova versão disponível', {
      id: TOAST_ID,
      description: 'Recarregue para usar a versão nova.',
      duration: Infinity,
      action: { label: 'Recarregar', onClick: () => void updateServiceWorker(true) },
    })
  }, [needRefresh, updateServiceWorker])

  return null
}

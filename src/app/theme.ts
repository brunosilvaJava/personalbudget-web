import { useEffect } from 'react'

const DARK_QUERY = '(prefers-color-scheme: dark)'

/**
 * Keeps the `dark` class on <html> in sync with the system theme. index.html sets it once
 * before the first paint; this follows later changes (e.g. the phone switching at night).
 */
export function useSystemTheme() {
  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY)
    const apply = () => document.documentElement.classList.toggle('dark', media.matches)
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [])
}

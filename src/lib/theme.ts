import { useSyncExternalStore } from 'react'

/**
 * The theme follows the system by default; "Mais" lets the person force light or dark. The choice
 * lives on this device only (localStorage). index.html reads the same key before the first paint.
 */
export type ThemePreference = 'system' | 'light' | 'dark'

export const THEME_STORAGE_KEY = 'personalbudget.theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'
const listeners = new Set<() => void>()

export function readThemePreference(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    // Storage can be off (private mode, some WebViews): follow the system.
    return 'system'
  }
}

export function setThemePreference(choice: ThemePreference): void {
  try {
    if (choice === 'system') localStorage.removeItem(THEME_STORAGE_KEY)
    else localStorage.setItem(THEME_STORAGE_KEY, choice)
  } catch {
    // Not saved, but still applied for this visit.
  }
  current = choice
  applyTheme()
  listeners.forEach((listener) => listener())
}

let current: ThemePreference | null = null

function preference(): ThemePreference {
  current ??= readThemePreference()
  return current
}

/** Puts or removes the `dark` class on <html> for the current preference and system theme. */
export function applyTheme(): void {
  const choice = preference()
  const dark = choice === 'dark' || (choice === 'system' && window.matchMedia(DARK_QUERY).matches)
  document.documentElement.classList.toggle('dark', dark)
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    preference,
    () => 'system',
  )
}

/** Follows the system theme while the preference is "system" (the phone switching at night). */
export function watchSystemTheme(): () => void {
  const media = window.matchMedia(DARK_QUERY)
  media.addEventListener('change', applyTheme)
  return () => media.removeEventListener('change', applyTheme)
}

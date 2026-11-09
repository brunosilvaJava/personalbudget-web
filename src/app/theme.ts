import { useEffect } from 'react'

import { applyTheme, watchSystemTheme } from '@/lib/theme'

/**
 * Keeps the `dark` class on <html> in sync with the chosen theme (system, light or dark).
 * index.html sets it once before the first paint; this follows later changes.
 */
export function useAppTheme() {
  useEffect(() => {
    applyTheme()
    return watchSystemTheme()
  }, [])
}

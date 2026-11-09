/**
 * localStorage that never throws: private mode and some WebViews refuse it. Only for light
 * conveniences of this device (theme, last "Pagou com"); nothing that must survive.
 */
export function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeLocal(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Not remembered this time; nothing else depends on it.
  }
}

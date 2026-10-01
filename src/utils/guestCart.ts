/** Guest cart credentials are issued and signed by the API. */
const STORAGE_PREFIX = 'bfg_guest_cart_token:'
const LEGACY_STORAGE_KEY = 'bfg_guest_cart_session'

export function getGuestCartToken(scope: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + scope)
  } catch {
    return null
  }
}

export function saveGuestCartToken(scope: string, token: unknown): void {
  if (typeof window === 'undefined' || typeof token !== 'string' || !token) return
  try {
    window.localStorage.setItem(STORAGE_PREFIX + scope, token)
  } catch {
    // Cookie-backed carts remain available when storage is blocked.
  }
}

export function clearGuestCartToken(scope: string): void {
  if (typeof window === 'undefined') return
  try { window.localStorage.removeItem(STORAGE_PREFIX + scope) } catch { /* Storage unavailable. */ }
}

/** Forget guest credentials on sign out, including obsolete unsigned keys. */
export function clearGuestCartKey(): void {
  if (typeof window === 'undefined') return
  try {
    const storage = window.localStorage
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index))
    for (const key of keys) {
      if (key && (key.startsWith(STORAGE_PREFIX) || key === LEGACY_STORAGE_KEY)) {
        storage.removeItem(key)
      }
    }
  } catch {
    // Storage may be unavailable in private browsing.
  }
}

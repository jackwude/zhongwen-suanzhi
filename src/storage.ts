const KEY = 'suanzhi.mvp.doc.v1'

export function loadDoc(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function saveDoc(text: string): void {
  try {
    localStorage.setItem(KEY, text)
  } catch {
    // quota / private mode — ignore
  }
}

export function clearDoc(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}

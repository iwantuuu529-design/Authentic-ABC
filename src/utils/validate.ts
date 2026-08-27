export function isValidBDPhone(phone: string): boolean {
  return /^01[3-9][0-9]{8}$/.test(phone.trim())
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

export function isStrongPassword(password: string): boolean {
  // At least 6 chars — kept permissive since target audience may use simple passwords,
  // but recommend 8+ with a number in the UI.
  return typeof password === 'string' && password.length >= 6
}

export function sanitizeText(input: unknown, maxLen = 500): string {
  if (typeof input !== 'string') return ''
  return input.trim().slice(0, maxLen)
}

/** Resolves a dot-notation path like "data.result.name" against an object. */
export function getByPath(obj: any, path: string): any {
  if (!path) return undefined
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj)
}

/** Very small template renderer: replaces {{field}} with values from data. */
export function renderTemplate(template: string, data: Record<string, any>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const val = getByPath(data, key)
    return val === undefined || val === null ? '' : String(val)
  })
}

// Password hashing using Web Crypto PBKDF2 (works natively in Cloudflare Workers — no native bcrypt needed)

const ITERATIONS = 100_000
const HASH_ALGO = 'SHA-256'
const KEY_LENGTH = 32 // bytes

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function hexToBuf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: HASH_ALGO },
    keyMaterial,
    KEY_LENGTH * 8
  )
  return `pbkdf2$${ITERATIONS}$${bufToHex(salt.buffer as ArrayBuffer)}$${bufToHex(derivedBits)}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const parts = stored.split('$')
    if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
    const iterations = parseInt(parts[1], 10)
    const salt = hexToBuf(parts[2])
    const expectedHash = parts[3]

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    )
    const derivedBits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations, hash: HASH_ALGO },
      keyMaterial,
      KEY_LENGTH * 8
    )
    const actualHash = bufToHex(derivedBits)
    // Constant-time-ish compare
    if (actualHash.length !== expectedHash.length) return false
    let diff = 0
    for (let i = 0; i < actualHash.length; i++) {
      diff |= actualHash.charCodeAt(i) ^ expectedHash.charCodeAt(i)
    }
    return diff === 0
  } catch {
    return false
  }
}

export function generateOtp(length = 6): string {
  const digits = '0123456789'
  let otp = ''
  const randomValues = crypto.getRandomValues(new Uint32Array(length))
  for (let i = 0; i < length; i++) {
    otp += digits[randomValues[i] % 10]
  }
  return otp
}

export function generateCode(prefix: string, length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  const randomValues = crypto.getRandomValues(new Uint32Array(length))
  for (let i = 0; i < length; i++) {
    code += chars[randomValues[i] % chars.length]
  }
  return `${prefix}${code}`
}

export function generateOrderNo(): string {
  const date = new Date()
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(
    date.getDate()
  ).padStart(2, '0')}`
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `ORD-${ymd}-${rand}`
}

export function generateRequestNo(): string {
  const date = new Date()
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(
    date.getDate()
  ).padStart(2, '0')}`
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `RCH-${ymd}-${rand}`
}

export function generateTicketNo(): string {
  const rand = Math.floor(10000 + Math.random() * 90000)
  return `TKT-${rand}`
}

export function generateReferralCode(name: string): string {
  const base = name.replace(/[^a-zA-Z]/g, '').toUpperCase().substring(0, 4) || 'USER'
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `${base}${rand}`
}

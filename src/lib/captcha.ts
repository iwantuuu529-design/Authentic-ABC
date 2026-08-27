// Stateless math captcha: the answer is embedded in a signed token so we don't
// need a DB row or KV entry per captcha (keeps everything within the D1 free tier).

async function hmacSign(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function generateCaptcha(secret: string) {
  const a = Math.floor(Math.random() * 20) + 1
  const b = Math.floor(Math.random() * 20) + 1
  const ops = ['+', '-', '×']
  const op = ops[Math.floor(Math.random() * ops.length)]
  let answer: number
  if (op === '+') answer = a + b
  else if (op === '-') answer = a - b
  else answer = a * b

  const expires = Date.now() + 5 * 60 * 1000 // 5 min
  const payload = `${answer}:${expires}`
  const sig = await hmacSign(secret, payload)
  const token = `${payload}:${sig}`

  return {
    question: `${a} ${op} ${b} = ?`,
    token: btoa(token),
  }
}

export async function verifyCaptcha(secret: string, token: string, userAnswer: string | number): Promise<boolean> {
  try {
    const decoded = atob(token)
    const parts = decoded.split(':')
    if (parts.length !== 3) return false
    const [answer, expires, sig] = parts
    const expectedSig = await hmacSign(secret, `${answer}:${expires}`)
    if (expectedSig !== sig) return false
    if (Date.now() > parseInt(expires, 10)) return false
    return String(answer) === String(userAnswer).trim()
  } catch {
    return false
  }
}

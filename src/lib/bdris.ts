// ============================================================
// BDRIS (Birth Registration) two-step lookup client — SkSeba API.
//
// Step 1  POST /captcha  {key, brn, dob}      → {id, captchaUrl}
// Step 2  POST /verify   {key, id, captcha}   → official record data
//
// The captcha image must be solved by a human (the end-user on their
// order page, or an admin), so the order flow is:
//   create order → engine starts step 1 → order waits in 'processing'
//   → user submits captcha code → step 2 → order completed.
// ============================================================

const BDRIS_BASE = 'https://core.skseba.shop/api/v2/bdris'
const FALLBACK_KEY = '2f5b625b1c1864256f418c8c00ad5307'
const TIMEOUT_MS = 25_000

/** Resolve the BDRIS master key: settings.bdris_api_key → env → fallback. */
export async function getBdrisApiKey(db: any, env?: any): Promise<string> {
  try {
    const row = await db.prepare(`SELECT value FROM settings WHERE key = 'bdris_api_key'`).first<any>()
    if (row?.value) return String(row.value)
  } catch {}
  const fromEnv = process.env?.SKSEBA_API_KEY || env?.SKSEBA_API_KEY
  if (fromEnv) return String(fromEnv)
  return FALLBACK_KEY
}

async function postForm(url: string, fields: Record<string, string>): Promise<any> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: 'https://core.skseba.shop',
      },
      body: new URLSearchParams(fields).toString(),
      signal: controller.signal,
    })
    const text = await res.text()
    try {
      return JSON.parse(text)
    } catch {
      return { success: false, message: `Unexpected response (HTTP ${res.status})` }
    }
  } catch (e: any) {
    return { success: false, message: e?.name === 'AbortError' ? 'API টাইমআউট হয়েছে' : 'সার্ভারে পৌঁছানো যায়নি' }
  } finally {
    clearTimeout(timer)
  }
}

export interface BdrisStartResult {
  ok: boolean
  sessionId?: string
  captchaUrl?: string
  error?: string
}

/** Step 1 — request a captcha for a BRN + DOB lookup. */
export async function bdrisStartCaptcha(apiKey: string, brn: string, dob: string): Promise<BdrisStartResult> {
  const json = await postForm(`${BDRIS_BASE}/captcha`, { key: apiKey, brn, dob })
  if (json?.success === true && json?.id) {
    return { ok: true, sessionId: String(json.id), captchaUrl: String(json.captchaUrl || json.captcha_url || '') }
  }
  // Known terminal cases (bad/unknown record, key issues) — surfaced as-is
  return { ok: false, error: json?.message || 'ক্যাপচা শুরু করা যায়নি' }
}

export interface BdrisVerifyResult {
  ok: boolean
  data?: any
  error?: string
  /** true when the failure looks like a wrong/expired captcha (retryable with a fresh one) */
  captchaIssue?: boolean
}

/** Step 2 — submit the solved captcha code and fetch the official record. */
export async function bdrisVerify(apiKey: string, sessionId: string, captchaCode: string): Promise<BdrisVerifyResult> {
  const json = await postForm(`${BDRIS_BASE}/verify`, { key: apiKey, id: sessionId, captcha: captchaCode })
  if (json?.success === true) {
    return { ok: true, data: json }
  }
  const msg: string = json?.message || 'ভেরিফিকেশন ব্যর্থ হয়েছে'
  const lower = msg.toLowerCase()
  const captchaIssue = /captcha|code|expire|invalid/i.test(lower) || /ক্যাপচা|ভুল|মেয়াদ/.test(msg)
  return { ok: false, error: msg, captchaIssue }
}

/** Downloads the remote captcha image bytes so we can serve it from our own origin. */
export async function fetchCaptchaImage(captchaUrl: string): Promise<{ bytes: ArrayBuffer; contentType: string } | null> {
  if (!captchaUrl || !/^https?:\/\//.test(captchaUrl)) return null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(captchaUrl, { signal: controller.signal, headers: { Referer: 'https://core.skseba.shop' } })
    if (!res.ok) return null
    const bytes = await res.arrayBuffer()
    return { bytes, contentType: res.headers.get('content-type') || 'image/png' }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// ============================================================
// UddoktaPay client — official API (uddoktapay.readme.io):
//   create  : POST {base}/api/checkout-v2    (header RT-UDDOKTAPAY-API-KEY)
//   verify  : POST {base}/api/verify-payment {invoice_id}
// ============================================================

const TIMEOUT_MS = 25_000

export interface UddoktaConfig {
  baseUrl: string
  apiKey: string
}

export interface CheckoutResult {
  ok: boolean
  invoiceId?: string
  paymentUrl?: string
  error?: string
}


function normalizeBase(raw: string): string {
  // Tolerate stored values like https://sandbox.uddoktapay.com/api —
  // the endpoint paths below already include the /api prefix.
  return String(raw || '').replace(/\/+$/, '').replace(/\/api$/i, '')
}

export async function uddoktaCreateCheckout(
  cfg: UddoktaConfig,
  payload: {
    amount: number
    fullName: string
    email: string
    phone?: string
    reference: string
    redirectUrl: string
    cancelUrl: string
    webhookUrl?: string
  }
): Promise<CheckoutResult> {
  const base = normalizeBase(cfg.baseUrl)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${base}/api/checkout-v2`, {
      method: 'POST',
      headers: {
        'RT-UDDOKTAPAY-API-KEY': cfg.apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        full_name: payload.fullName,
        email: payload.email,
        amount: String(payload.amount),
        metadata: { reference: payload.reference, phone: payload.phone || '' },
        redirect_url: payload.redirectUrl,
        return_type: 'GET',
        cancel_url: payload.cancelUrl,
        webhook_url: payload.webhookUrl || undefined,
      }),
      signal: controller.signal,
    })
    const text = await res.text()
    let data: any = {}
    try {
      data = JSON.parse(text)
    } catch {}
    if (!res.ok || data?.status === false || data?.error || data?.message?.error) {
      return { ok: false, error: data?.error || data?.message?.error || data?.message || `Gateway HTTP ${res.status}` }
    }
    const paymentUrl = String(data.payment_url || data.checkout_url || data.redirect_url || '')
    // UddoktaPay returns the invoice id as the last path segment of the
    // payment URL (e.g. .../payment/<invoice_id>); newer API versions
    // may also send invoice_id directly.
    const invoiceId = String(data.invoice_id || data.id || paymentUrl.split('/').filter(Boolean).pop() || '')
    if (!invoiceId && !paymentUrl) return { ok: false, error: 'Gateway returned no invoice' }
    return { ok: true, invoiceId, paymentUrl }
  } catch (e: any) {
    return { ok: false, error: e?.name === 'AbortError' ? 'গেটওয়ে টাইমআউট' : 'গেটওয়েতে পৌঁছানো যায়নি' }
  } finally {
    clearTimeout(timer)
  }
}

export interface VerifyResult {
  ok: boolean
  paid: boolean
  data?: any
  error?: string
}

export async function uddoktaVerifyPayment(cfg: UddoktaConfig, invoiceId: string): Promise<VerifyResult> {
  const base = normalizeBase(cfg.baseUrl)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${base}/api/verify-payment`, {
      method: 'POST',
      headers: {
        'RT-UDDOKTAPAY-API-KEY': cfg.apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ invoice_id: invoiceId }),
      signal: controller.signal,
    })
    const text = await res.text()
    let data: any = {}
    try {
      data = JSON.parse(text)
    } catch {}
    if (!res.ok) return { ok: false, paid: false, error: data?.message || `Gateway HTTP ${res.status}` }
    const status = String(data.status || data.payment_status || '').toUpperCase()
    const paid = status === 'PAID' || status === 'SUCCESS' || status === 'COMPLETED' || data.paid === true
    return { ok: true, paid, data }
  } catch (e: any) {
    return { ok: false, paid: false, error: e?.name === 'AbortError' ? 'গেটওয়ে টাইমআউট' : 'গেটওয়েতে পৌঁছানো যায়নি' }
  } finally {
    clearTimeout(timer)
  }
}

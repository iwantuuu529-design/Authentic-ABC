import { getByPath, renderTemplate } from '../utils/validate'

export interface ApiProviderRow {
  id: number
  name: string
  base_url: string
  http_method: string
  auth_type: string
  auth_key_name: string | null
  auth_key_value: string | null
  request_template: string | null
  response_success_path: string | null
  response_success_value: string | null
  response_result_path: string | null
  response_error_path: string | null
  timeout_ms: number | null
  status: string
}

export interface ApiCallResult {
  ok: boolean
  raw: any
  result?: any
  errorMessage?: string
}

/**
 * Generic, admin-configurable API dispatcher.
 * A single engine drives EVERY 3rd-party service integration — admins register
 * a new provider (base URL, auth method, request template, response paths) from
 * the Admin Panel with zero code changes, then attach it to any Service via
 * `field_mapping`. This is what lets "some services be manual and some be via
 * approved API" without redeploying the app.
 */
export async function callApiProvider(
  provider: ApiProviderRow,
  fieldMapping: Record<string, string> | null,
  formData: Record<string, any>
): Promise<ApiCallResult> {
  try {
    // Build request payload: map form field -> API field name using field_mapping,
    // or pass through raw form data if no mapping supplied.
    let payloadData: Record<string, any> = formData
    if (fieldMapping) {
      payloadData = {}
      for (const [formField, apiField] of Object.entries(fieldMapping)) {
        payloadData[apiField] = formData[formField]
      }
    }

    let url = provider.base_url
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    let body: string | undefined

    // Auth strategies
    if (provider.auth_type === 'header' && provider.auth_key_name && provider.auth_key_value) {
      headers[provider.auth_key_name] = provider.auth_key_value
    } else if (provider.auth_type === 'bearer' && provider.auth_key_value) {
      headers['Authorization'] = `Bearer ${provider.auth_key_value}`
    } else if (provider.auth_type === 'basic' && provider.auth_key_value) {
      headers['Authorization'] = `Basic ${provider.auth_key_value}`
    }

    if (provider.http_method === 'GET') {
      const params = new URLSearchParams(
        Object.fromEntries(Object.entries(payloadData).map(([k, v]) => [k, String(v ?? '')]))
      )
      if (provider.auth_type === 'query' && provider.auth_key_name && provider.auth_key_value) {
        params.set(provider.auth_key_name, provider.auth_key_value)
      }
      url = `${url}${url.includes('?') ? '&' : '?'}${params.toString()}`
    } else {
      if (provider.request_template) {
        body = renderTemplate(provider.request_template, payloadData)
      } else {
        const bodyObj = { ...payloadData }
        if (provider.auth_type === 'query' && provider.auth_key_name && provider.auth_key_value) {
          bodyObj[provider.auth_key_name] = provider.auth_key_value
        }
        body = JSON.stringify(bodyObj)
      }
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), provider.timeout_ms || 15000)

    const res = await fetch(url, {
      method: provider.http_method || 'POST',
      headers,
      body: provider.http_method === 'GET' ? undefined : body,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    let raw: any
    const contentType = res.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      raw = await res.json()
    } else {
      raw = await res.text()
    }

    if (!res.ok) {
      const errMsg = provider.response_error_path ? getByPath(raw, provider.response_error_path) : `HTTP ${res.status}`
      return { ok: false, raw, errorMessage: errMsg || `API responded with status ${res.status}` }
    }

    // Determine success using configured path/value, defaulting to HTTP-ok = success
    let isSuccess = true
    if (provider.response_success_path) {
      const actual = getByPath(raw, provider.response_success_path)
      if (provider.response_success_value) {
        isSuccess = String(actual) === String(provider.response_success_value)
      } else {
        isSuccess = Boolean(actual)
      }
    }

    if (!isSuccess) {
      const errMsg = provider.response_error_path ? getByPath(raw, provider.response_error_path) : 'Provider reported failure'
      return { ok: false, raw, errorMessage: errMsg || 'API প্রসেসিং ব্যর্থ হয়েছে' }
    }

    const result = provider.response_result_path ? getByPath(raw, provider.response_result_path) : raw
    return { ok: true, raw, result }
  } catch (err: any) {
    const message = err?.name === 'AbortError' ? 'API রিকোয়েস্ট টাইমআউট হয়েছে' : err?.message || 'অজানা ত্রুটি'
    return { ok: false, raw: null, errorMessage: message }
  }
}

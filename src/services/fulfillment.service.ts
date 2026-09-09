// ============================================================
// FulfillmentService — per-service fulfillment logic registry.
//
// Every catalog service declares HOW it is processed and WHAT
// result it produces, instead of one hardcoded slug check in the
// order engine. Three families:
//
//   1. AUTO_DOCUMENT  (reformatting / generation)
//      User uploads their OWN document/data; the pipeline produces
//      a formatted copy instantly. e.g. NID card from a CMS copy,
//      birth-certificate PDF. These complete 100% automatically.
//
//   2. LOOKUP         (verification / data-fetch)
//      Needs a real, admin-configured data source (govt DB / API).
//      These dispatch to the attached API provider when one is
//      active, and fall back to the manual queue otherwise. We do
//      NOT fabricate results — a lookup only completes with data a
//      legitimate provider returns.
//
//   3. HUMAN          (applications / face-verify / custom)
//      Inherently requires a person; stays in the manual queue with
//      a clean admin workflow.
// ============================================================

/** Which slugs are instant document-generation services. */
export const AUTO_DOCUMENT_SLUGS = new Set<string>([
  'nid-create', // flagship NID card generator (also the migrated nibandan-pdf-create)
  'nibandan-pdf-create', // legacy slug, kept for safety
  'nid-make', // reformat an uploaded NID/CMS copy into a card
])

/** Which slugs are data-lookup services (api-provider driven). */
export const LOOKUP_SLUGS = new Set<string>([
  'birth-certificate-search',
  'birth-ministry-data',
  'nid-server-copy',
  'nid-sign-copy',
  'land-dakhila-finder',
])

/** Human-processed services (manual queue is the correct logic). */
export const HUMAN_SLUGS = new Set<string>([
  'birth-registration-application',
  'nid-user-pass',
  'custom-request',
])

export interface AutoResult {
  resultData: Record<string, any>
  /** note written to order_logs */
  logNote: string
  /** notification title sent to the user */
  notifTitle: string
}

/**
 * Builds the structured `result_data` for an auto-document service.
 * The visual card/PDF is rendered by the client-side designer from
 * this payload; the server's job is to validate, persist and package
 * the submitted (user-provided) data — it never invents data.
 */
export function buildAutoResult(
  service: any,
  formValues: Record<string, any>,
  fileKeys: Record<string, string>
): AutoResult {
  const slug: string = service.slug
  const completed_at = new Date().toISOString()

  // NID card / birth-certificate style documents share the same field set —
  // the Super-Fast designer submits identical keys for all three slugs.
  if (slug === 'nid-create' || slug === 'nibandan-pdf-create' || slug === 'nid-make') {
    return {
      resultData: {
        type: 'nid_card',
        service_slug: slug,
        name_bn: formValues.name_bn || '',
        name_en: formValues.name_en || '',
        registration_no: formValues.registration_no || '',
        book_no: formValues.book_no || '',
        father_name_bn: formValues.father_name_bn || '',
        mother_name_bn: formValues.mother_name_bn || '',
        birth_place: formValues.birth_place || '',
        dob: formValues.dob || '',
        gender_blood: formValues.gender_blood || '',
        issue_date: formValues.issue_date || '',
        address: formValues.address || '',
        photo_file: fileKeys['photo_file'] || formValues['photo_file'] || null,
        sign_file: fileKeys['sign_file'] || formValues['sign_file'] || null,
        source_pdf: fileKeys['pdf_file'] || formValues['pdf_file'] || null,
        completed_at,
      },
      logNote: 'স্বয়ংক্রিয়ভাবে ডকুমেন্ট তৈরি সম্পন্ন হয়েছে',
      notifTitle: 'ডকুমেন্ট তৈরি সম্পন্ন ✅',
    }
  }

  // Generic auto fallback: package whatever the schema collected so the
  // order detail screen can still render a clean key/value result.
  const fields: Record<string, any> = {}
  for (const [k, v] of Object.entries(formValues)) {
    if (fileKeys[k]) continue // file fields are referenced via `files`
    fields[k] = v
  }
  return {
    resultData: {
      type: 'auto_document',
      service_slug: slug,
      fields,
      files: fileKeys,
      completed_at,
    },
    logNote: 'স্বয়ংক্রিয়ভাবে প্রসেস সম্পন্ন হয়েছে',
    notifTitle: 'অর্ডার সম্পন্ন হয়েছে ✅',
  }
}

/** Returns the fulfillment family for a service (auto_document | lookup | human | generic). */
export function serviceFamily(slug: string, fulfillmentMode: string): 'auto_document' | 'lookup' | 'human' | 'generic' {
  if (AUTO_DOCUMENT_SLUGS.has(slug) || fulfillmentMode === 'auto') return 'auto_document'
  if (LOOKUP_SLUGS.has(slug)) return 'lookup'
  if (HUMAN_SLUGS.has(slug)) return 'human'
  return 'generic'
}

/**
 * Human-friendly processing-type label for the UI, so users understand
 * what will happen after they submit (instead of a raw mode string).
 */
export function processingLabel(slug: string, fulfillmentMode: string): string {
  switch (serviceFamily(slug, fulfillmentMode)) {
    case 'auto_document':
      return '⚡ ইনস্ট্যান্ট অটো'
    case 'lookup':
      return fulfillmentMode === 'manual' ? '👤 ম্যানুয়াল যাচাই' : '🔄 অটো + ম্যানুয়াল'
    case 'human':
      return '👤 ম্যানুয়াল'
    default:
      return fulfillmentMode === 'api' ? '⚡ স্বয়ংক্রিয়' : fulfillmentMode === 'hybrid' ? '🔄 হাইব্রিড' : '👤 ম্যানুয়াল'
  }
}

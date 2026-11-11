/**
 * Pure balance helpers: upstream response interpretation, payload shaping and
 * redaction. No cordis context, no I/O — every function here is safe to unit
 * test without a Host.
 *
 * Upstream contract (https://api.deepseek.com/user/balance):
 *   GET, Authorization: Bearer <key>
 *   200 {
 *     is_available: boolean,
 *     balance_infos: [{ currency, total_balance, granted_balance, topped_up_balance }]
 *   }
 * All amounts are decimal strings. An amount we cannot read as a finite number
 * stays `null` — never 0, because 0 means "balance really ran out".
 *
 * @module lib/balance
 */

/** Error codes the browser half renders as a hint under the pill. */
export const CODES = Object.freeze({
  NO_KEY: 'NO_KEY',
  CREDENTIALS_UNAVAILABLE: 'CREDENTIALS_UNAVAILABLE',
  UNAUTHORIZED: 'UNAUTHORIZED',
  RATE_LIMITED: 'RATE_LIMITED',
  HTTP: 'HTTP',
  NETWORK: 'NETWORK',
  TIMEOUT: 'TIMEOUT',
  PARSE: 'PARSE',
  SHAPE: 'SHAPE',
})

const MAX_ERROR_CHARS = 200

/**
 * Parse a decimal amount. `null`/`undefined`/`''` and anything non-finite
 * answer `null`; a numeric 0 answers 0.
 * @param value - upstream field (string, number or anything else).
 * @returns finite number or null.
 */
export function toAmount(value) {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' && value.trim() === '') return null
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/**
 * Pick the wallet to report. The preferred currency wins; otherwise the first
 * entry. Entries whose `total_balance` is unreadable are still eligible (the
 * payload then reports `totalBalance: null`) so the caller can say "the
 * upstream answered, we just could not read it" instead of "no wallet".
 * @param balanceInfos - `balance_infos` array from the upstream response.
 * @param preferredCurrency - currency code from config, e.g. 'CNY'.
 * @returns the chosen entry, or undefined when the array carries none.
 */
export function pickWallet(balanceInfos, preferredCurrency = 'CNY') {
  if (!Array.isArray(balanceInfos) || balanceInfos.length === 0) return undefined
  const want = String(preferredCurrency || '').toUpperCase()
  const match = balanceInfos.find(
    (wallet) => wallet && typeof wallet === 'object' && String(wallet.currency || '').toUpperCase() === want,
  )
  if (match) return match
  const first = balanceInfos.find((wallet) => wallet && typeof wallet === 'object')
  return first
}

/**
 * Turn one successful upstream body into the payload fields the browser reads.
 * Throws a `SHAPE` error when the upstream answered something that is not the
 * documented object.
 * @param body - parsed JSON body.
 * @param preferredCurrency - currency code from config.
 * @returns the balance fields, without transport metadata.
 */
export function readBalance(body, preferredCurrency = 'CNY') {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw balanceError(CODES.SHAPE, '余额接口返回不是对象')
  }
  const wallet = pickWallet(body.balance_infos, preferredCurrency)
  if (wallet === undefined) throw balanceError(CODES.SHAPE, '余额接口没有返回 balance_infos')
  const total = toAmount(wallet.total_balance)
  if (total === null) throw balanceError(CODES.SHAPE, '余额接口的 total_balance 不是有效数字')
  return {
    totalBalance: total,
    rechargeBalance: toAmount(wallet.topped_up_balance),
    bonusBalance: toAmount(wallet.granted_balance),
    currency: String(wallet.currency || preferredCurrency || 'CNY').toUpperCase(),
    isAvailable: typeof body.is_available === 'boolean' ? body.is_available : null,
  }
}

/**
 * An Error carrying one {@link CODES} value and an optional upstream status.
 * @param code - one of {@link CODES}.
 * @param message - human-readable, already free of secrets.
 * @param extra - optional `{ status, transient }` facts for logging/caching.
 * @returns the error instance.
 */
export function balanceError(code, message, extra = {}) {
  const error = new Error(message)
  error.code = code
  if (Number.isInteger(extra.status)) error.status = extra.status
  error.transient = extra.transient === true
  return error
}

/**
 * Classify an upstream HTTP failure. 401/403 mean the key is wrong (no retry),
 * 429 is a rate limit, everything else is a generic HTTP failure the caller may
 * retry once. Messages quote only the status — never the response body, which
 * can echo request details.
 * @param status - HTTP status code.
 * @returns error with `code`, `status` and `transient`.
 */
export function httpError(status) {
  if (status === 401 || status === 403) {
    return balanceError(CODES.UNAUTHORIZED, `DeepSeek 拒绝了该 API Key（HTTP ${status}）`, { status })
  }
  if (status === 429) {
    return balanceError(CODES.RATE_LIMITED, `余额接口限流（HTTP ${status}）`, { status, transient: true })
  }
  return balanceError(CODES.HTTP, `余额接口请求失败（HTTP ${status}）`, { status, transient: status >= 500 })
}

/**
 * Classify a thrown fetch failure (timeout, DNS, TLS, refused connection).
 * @param error - the thrown value.
 * @returns error with `code` and `transient`.
 */
export function transportError(error) {
  const name = error && typeof error === 'object' ? String(error.name || '') : ''
  if (name === 'TimeoutError' || name === 'AbortError') {
    return balanceError(CODES.TIMEOUT, '余额接口请求超时', { transient: true })
  }
  const reason = error && typeof error === 'object' && error.cause && typeof error.cause === 'object'
    ? String(error.cause.code || error.cause.message || '')
    : ''
  const text = reason ? `${String(error.message || '')} (${reason})` : String((error && error.message) || error)
  return balanceError(CODES.NETWORK, `无法连接余额接口：${redact(text)}`, { transient: true })
}

/**
 * Whether a failed resolution means "this build has no credentials service or
 * the file is unreadable" rather than "the user never configured a key".
 * Local credentials resolve to `undefined` when the ref is absent.
 * @param resolved - value returned by `credentials.resolve(ref)`.
 * @returns the trimmed key, or '' when the ref is unset.
 * @throws when the resolved value is not the `{ value }` shape.
 */
export function readCredential(resolved) {
  if (resolved === undefined || resolved === null) return ''
  const value = typeof resolved === 'string' ? resolved : resolved.value
  if (typeof value !== 'string') throw balanceError(CODES.CREDENTIALS_UNAVAILABLE, '凭据服务返回了无法识别的结构')
  return value.trim()
}

/**
 * Strip anything key-shaped and bound the text. Defence in depth: no code path
 * feeds a key into a message, but a proxy error page could echo one.
 * @param text - arbitrary message.
 * @returns redacted, length-bounded text.
 */
export function redact(text) {
  let out = String(text === null || text === undefined ? '' : text)
  out = out.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer <redacted>')
  out = out.replace(/\bsk-[A-Za-z0-9._-]{6,}/g, '<redacted>')
  return out.length > MAX_ERROR_CHARS ? `${out.slice(0, MAX_ERROR_CHARS)}…` : out
}

/**
 * Build the JSON body the browser half consumes. The shape is the plugin's only
 * public contract; adding fields is fine, removing them is a breaking change.
 * @param options - balance fields, source and caching facts.
 * @returns JSON-safe payload.
 */
export function payload(options) {
  const {
    ok, fields, accountTag, stale = false, error, fromCache = false,
    lowBalanceThreshold, refreshMinutes,
    now = Date.now(), fetchedAt = now,
  } = options
  return {
    ok,
    totalBalance: ok ? fields.totalBalance : null,
    rechargeBalance: ok ? fields.rechargeBalance : null,
    bonusBalance: ok ? fields.bonusBalance : null,
    // Lifetime spend as the account summary reports it; null when the source
    // does not carry it (the API-key endpoint does not).
    totalCost: ok && typeof fields.totalCost === 'number' ? fields.totalCost : null,
    account: ok && fields.account ? fields.account : null,
    currency: ok ? fields.currency : 'CNY',
    isAvailable: ok ? fields.isAvailable : null,
    accountTag: accountTag || null,
    source: fromCache ? 'cache' : 'apikey',
    stale,
    updatedAt: new Date(fetchedAt).toISOString(),
    lowBalanceThreshold,
    refreshMinutes,
    // A `stale` success still carries the failure it is masking, so the card can
    // say why the number is old; a fresh success carries neither key.
    ...(error === undefined ? {} : { code: error?.code || CODES.HTTP, error: redact(error?.message || '未知错误') }),
  }
}
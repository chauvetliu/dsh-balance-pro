/**
 * Same-origin admission for the plugin's own routes.
 *
 * Why hand-rolled: the Host's `connection` service can be absent on older
 * lines, and a fence that throws must not fall through to "allowed". Every
 * rejection here is a 403 unless the Host fence itself answers otherwise, and a
 * reading route still refuses cross-site callers because the payload names the
 * account (a tag derived from the key) and its balance.
 *
 * @module lib/request
 */

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * Loopback authority test. Accepts localhost, *.localhost, 127.0.0.0/8 and ::1;
 * the dotted-quad form is validated per octet so `127.0.0.1.evil.com` and
 * `127.0.0.1@evil.com` never pass.
 * @param hostname - URL hostname from the request's Host header.
 * @returns whether the browser treats it as this machine.
 */
export function isLoopbackHostname(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^\[/u, '').replace(/\]$/u, '')
  if (host === '') return false
  if (host === 'localhost' || host.endsWith('.localhost')) return true
  if (host === '::1') return true
  const octets = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/u.exec(host)
  if (octets === null) return false
  if (Number(octets[1]) !== 127) return false
  return [octets[2], octets[3], octets[4]].every((part) => Number(part) <= 255)
}

/**
 * Whether an Origin header value names this machine.
 * @param origin - lowercased Origin value, e.g. 'http://127.0.0.1:57566'.
 * @returns true for a loopback http(s) origin.
 */
function isLoopbackOrigin(origin) {
  try {
    const parsed = new URL(origin)
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && isLoopbackHostname(parsed.hostname)
  } catch {
    /* v8 ignore next -- a malformed origin is not local */
    return false
  }
}

/**
 * Decide whether one request may read the plugin's routes.
 *
 * The order matters: the Host fence is consulted FIRST (it owns the browser
 * cookie and knows `--trusted-host`), and this module only takes over when the
 * fence is unavailable or answers without a rejection.
 * @param req - node:http request (only `method` and `headers` are read).
 * @param options - host fence (`requestRejection`) and trusted non-loopback authorities.
 * @returns `null` when admitted, otherwise the HTTP status to answer.
 */
export function admission(req, options = {}) {
  const { connection, trustedHosts = [] } = options
  const headers = (req && req.headers) || {}
  const method = String((req && req.method) || 'GET').toUpperCase()

  // Writes are not part of this plugin's surface today; refuse them anyway so a
  // future route cannot inherit an accidental write path. OPTIONS passes here
  // only to become a CORS preflight answer; it never reads the balance.
  if (WRITE_METHODS.has(method)) return 405
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') return 405

  // Structural check independent of who the caller is: a *foreign* origin is
  // refused up front. The two cross-origin readers this route serves — the
  // desktop page (`dsh-app://app`) and a loopback page on another port — are
  // vetted by the origin check below, which is also what the CORS headers
  // answer, so they are exempt here.
  const site = String(headers['sec-fetch-site'] || '').toLowerCase()
  const rawOrigin = headers.origin
  const originText = typeof rawOrigin === 'string' ? rawOrigin.toLowerCase() : ''
  const originIsLocal = originText === 'dsh-app://app' || isLoopbackOrigin(originText)
  if (site === 'cross-site' && originText !== '' && originIsLocal === false) return 403

  const hostHeader = String(headers.host || '').trim()
  if (hostHeader === '') return 403
  let authority = ''
  let hostname = ''
  try {
    const parsed = new URL(`http://${hostHeader}`)
    authority = parsed.host.toLowerCase()
    hostname = parsed.hostname.toLowerCase()
  } catch {
    return 403 // malformed Host
  }
  const origin = headers.origin
  if (typeof origin === 'string' && origin !== '' && origin !== 'null') {
    const original = origin.toLowerCase()
    // Cross-origin readers allowed on this host: the desktop page
    // (`dsh-app://app`) and any port on loopback (`dsh web` pages, and the
    // desktop shell served over http, both land there; a different port is what
    // makes an origin foreign). Everything else must match the Host exactly.
    if (original !== 'dsh-app://app' && isLoopbackOrigin(original) === false) {
      let originHost = ''
      try {
        originHost = new URL(origin).host.toLowerCase()
      } catch {
        return 403
      }
      if (originHost !== authority) return 403
    }
  }

  // 1. The Host fence owns the browser-session check when it exists.
  let hostStatus
  if (connection && typeof connection.requestRejection === 'function') {
    try {
      hostStatus = connection.requestRejection(req)
    } catch {
      return 403 // fail closed: a fence that throws is not an admission
    }
  }
  if (hostStatus !== undefined && hostStatus !== null && hostStatus !== false) {
    return Number.isInteger(hostStatus) ? hostStatus : 403
  }

  // 2. No fence verdict: loopback only, plus explicitly trusted authorities.
  //    The hostname is the URL-normalized form (lowercase, IPv6 compressed and
  //    unbracketed), so the same normalization is applied to the list: a bare
  //    `box.lan` or `::1` entry must match what the parser produced.
  if (isLoopbackHostname(hostname)) return null
  const normalizedHosts = trustedHosts.map(normalizeAuthority).filter((entry) => entry !== null)
  const listed = normalizedHosts.some((entry) => (entry.authority.includes(':') ? entry.authority === authority : entry.hostname === hostname))
  return listed ? null : 403
}

/**
 * Normalize one trusted-host entry the way the request's authority is read.
 * @param entry - raw list entry, e.g. 'box.lan', 'Box.LAN:3080' or '[::1]'.
 * @returns `{ authority, hostname }` in request-form, or null when unusable.
 */
function normalizeAuthority(entry) {
  const text = String(entry || '').trim()
  if (text === '') return null
  try {
    const parsed = new URL(`http://${text}`)
    return { authority: parsed.host.toLowerCase(), hostname: parsed.hostname.toLowerCase() }
  } catch {
    /* v8 ignore next -- config text, not input; an unusable entry is ignored */
    return null
  }
}
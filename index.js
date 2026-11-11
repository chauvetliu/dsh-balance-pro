/**
 * dsh-balance-pro — Host half.
 *
 * Serves the DeepSeek account balance to the page and nothing else:
 *
 *   GET /dsh-balance-pro/balance.json   the balance (same-origin only)
 *   GET /dsh-balance-pro/client.js      the browser half (module bundle)
 *
 * The API key never leaves this process: the browser receives amounts and a
 * short hash tag, never the key, the raw upstream body or the request headers.
 *
 * How the browser half reaches the desktop page — the part that took three
 * failed boots to get right:
 * - The desktop shell renders index.html from the installer's static dist, so
 *   `webServer.tapIndex()` never reaches it, and the `webserver/index-inject`
 *   table is collected ONCE at startup with the client-modules rows the shell
 *   consumes. A plugin row appended later never arrives; an inline row that
 *   registers on the pre-boot module facade is dropped when the real module
 *   system replaces that facade.
 * - The path that survives is the module graph: the `dsh.client` declaration
 *   makes client-modules publish a `/plugins/<id>/client.js` row, the page
 *   loads it as a classic script, and the bundle registers itself with
 *   `window.__ModuleLoader__` in that script. Serving the bundle is
 *   client-modules' job; the exact route below only helps a Host that serves
 *   it directly.
 * - `client.js` must always register: a row whose script finishes without
 *   calling `load()` fails the whole page with `1 entry did not activate`.
 *
 * @module dsh-balance-pro
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import {
  CODES, balanceError, httpError, payload, readBalance, readCredential, redact, transportError,
} from './lib/balance.js'
import { admission } from './lib/request.js'
import {
  DEFAULT_PRICING, emptyLedger, foldEvent, normalizePricing, summarize, usageOf,
} from './lib/usage.js'

const PACKAGE_ROOT = path.dirname(fileURLToPath(import.meta.url))

/** Published version of the installed package, read once at load. */
function readPackageVersion() {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'))
    return typeof manifest.version === 'string' ? manifest.version : ''
  } catch {
    return ''
  }
}

const PACKAGE_VERSION = readPackageVersion()

/** Route surface; the browser half hard-codes the same paths. */
const BASE_PATH = '/dsh-balance-pro'
const BALANCE_PATH = `${BASE_PATH}/balance.json`
const CLIENT_PATH = `${BASE_PATH}/client.js`
const USAGE_PATH = `${BASE_PATH}/usage.json`

const DEFAULT_CONFIG = Object.freeze({
  apiKeyEnv: 'DEEPSEEK_API_KEY',
  baseURL: 'https://api.deepseek.com',
  currency: 'CNY',
  refreshMinutes: 10,
  lowBalanceThreshold: 10,
  requestTimeoutMs: 8000,
  pricing: DEFAULT_PRICING,
  usageDays: 7,
  usageTurnLimit: 40,
})

/** Re-read timeout for a cold credentials service (it may still be loading). */
const CREDENTIAL_RETRY_MS = 700
/** How long one read waits for the credentials service to appear at boot. */
const CREDENTIAL_SERVICE_WAIT_MS = 5000
/** Minimum gap between two forced upstream reads (a double-clicked refresh). */
const FORCE_COOLDOWN_MS = 3000
/** How long a failed read is reused before the next request retries upstream. */
const FAILURE_TTL_MS = 30_000

/** Package-file cache keyed by name; see {@link readPackageFile}. */
const fileCache = new Map()

/**
 * Read a plugin file, re-reading only when its mtime moves (edits apply on the
 * next page refresh without restarting the Host).
 * @param name - file name inside the package.
 * @returns file text, or undefined when unreadable.
 */
function readPackageFile(name) {
  const file = path.join(PACKAGE_ROOT, name)
  const stat = fs.statSync(file)
  const hit = fileCache.get(name)
  if (hit !== undefined && hit.mtime === stat.mtimeMs) return hit.text
  const text = fs.readFileSync(file, 'utf8')
  fileCache.set(name, { text, mtime: stat.mtimeMs })
  return text
}

/** The client-modules row URL the desktop page loads this bundle from. */
const PLUGIN_ROW_PATH = '/plugins/dsh-balance-pro/client.js'

/**
 * Write the client bundle with its loopback origin filled in. The shipped file
 * carries a placeholder because the Host's port changes every launch; the
 * template itself is still valid JavaScript (`'{{LOOPBACK_ORIGIN}}'`), so a
 * stale page simply fails its requests instead of failing to parse.
 * @param res - node:http response.
 */
function sendClientBundle(res) {
  let text = ''
  try {
    text = readPackageFile('client.js')
  } catch {
    /* v8 ignore next 3 -- client.js ships with the package */
    sendText(res, 404, 'text/plain; charset=utf-8', 'client.js unavailable')
    return
  }
  const port = Number(globalThis.__dshBalanceProPort || 0)
  const origin = Number.isInteger(port) && port > 0 ? `http://127.0.0.1:${port}` : 'http://127.0.0.1:3080'
  sendText(res, 200, 'application/javascript; charset=utf-8', text.replaceAll('{{LOOPBACK_ORIGIN}}', origin))
}

/**
 * Write one text body.
 * @param res - node:http response.
 * @param status - HTTP status.
 * @param contentType - response media type.
 * @param text - body text.
 */
function sendText(res, status, contentType, text) {
  res.writeHead(status, {
    'content-type': contentType,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'content-length': Buffer.byteLength(text),
  })
  res.end(text)
}


/**
 * Clamp one config field, falling back to the default when unusable.
 * @param value - raw value from the patch layer or a test.
 * @param fallback - default.
 * @param check - validator.
 * @returns the value or the fallback.
 */
function pick(value, fallback, check) {
  try {
    return check(value) ? value : fallback
  } catch {
    /* v8 ignore next -- a throwing check is a programming error, not input */
    return fallback
  }
}

// Arrow-returned primitives are fine, but the lint-blind `pick` call sites below
// read better when these answer booleans explicitly.
function isPositive(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}
function isNonNegative(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}
function isText(value) {
  return typeof value === 'string' && value.trim() !== ''
}

/**
 * Normalize the config object cordis hands to apply().
 * @param input - raw config.
 * @returns complete settings.
 */
export function normalizeConfig(input) {
  const config = input && typeof input === 'object' ? input : {}
  let baseURL = DEFAULT_CONFIG.baseURL
  if (isText(config.baseURL)) {
    try {
      const url = new URL(String(config.baseURL).trim())
      if (url.protocol === 'https:' || url.protocol === 'http:') baseURL = url.origin + url.pathname.replace(/\/+$/u, '')
    } catch {
      /* keep the default */
    }
  }
  return {
    apiKeyEnv: pick(config.apiKeyEnv && String(config.apiKeyEnv).trim(), DEFAULT_CONFIG.apiKeyEnv, isText),
    baseURL,
    currency: String(pick(config.currency, DEFAULT_CONFIG.currency, isText)).toUpperCase(),
    refreshMinutes: Math.min(pick(config.refreshMinutes, DEFAULT_CONFIG.refreshMinutes, isPositive), 24 * 60),
    lowBalanceThreshold: pick(config.lowBalanceThreshold, DEFAULT_CONFIG.lowBalanceThreshold, isNonNegative),
    requestTimeoutMs: Math.min(pick(config.requestTimeoutMs, DEFAULT_CONFIG.requestTimeoutMs, isPositive), 60_000),
    readTotalCosts: config.readTotalCosts !== false,
    // Rate card + peak windows for the usage tab. Unknown models are counted
    // as tokens but never priced, so a wrong table can only under-report.
    pricing: normalizePricing(config.pricing),
    usageDays: Math.min(pick(config.usageDays, DEFAULT_CONFIG.usageDays, isPositive), 90),
    usageTurnLimit: Math.min(pick(config.usageTurnLimit, DEFAULT_CONFIG.usageTurnLimit, isPositive), 200),
    // Test seam and offline deployments: an explicit JSONL path. A directory
    // is invalid and falls back to the DSH home.
    usageStorePath: isText(config.usageStorePath) ? String(config.usageStorePath).trim() : '',
  }
}

/**
 * A short, stable account identifier derived from the key. Enough to tell two
 * keys apart, not enough to verify a guess (24 hex chars of SHA-256).
 * @param key - API key.
 * @returns the tag, or null when there is no key.
 */
function accountTagOf(key) {
  if (!key) return null
  return createHash('sha256').update(key).digest('hex').slice(0, 24)
}

/**
 * The balance service: credential resolution, upstream reads, caching and the
 * payload the browser half consumes. Kept as a class so tests can drive it with
 * a fake credentials service and a fake fetch.
 */
export class BalanceService {
  /**
   * @param options - settings, logger, fetch, clock and credentials accessor.
   */
  constructor(options) {
    this.config = options.config
    this.logger = options.logger
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis)
    this.now = options.now ?? Date.now
    /**
     * Provider accessors, called on every read. A service that is not ready yet
     * (plugins can apply before credentials-local finishes booting) would
     * otherwise freeze into "unavailable" for the lifetime of the fiber.
     */
    this.credentials = options.credentials
    /** Optional DSH account service accessor (read lazily, never injected). */
    this.account = options.account
    /** Last successful read: `{ fields, accountTag, at }`. */
    this.last = null
    /** Cached failure and the moment it stops being reused. */
    this.failure = null
    /** The in-flight read, shared by concurrent callers. */
    this.inflight = null
    /** When the cached failure first appeared; a forced read waits out its TTL. */
    this.failedAt = 0
    this.lastForcedAt = 0
  }

  log(level, message) {
    try {
      if (this.logger && typeof this.logger[level] === 'function') this.logger[level](`dsh-balance-pro: ${message}`)
      /* v8 ignore next -- a logger-less composition (tests) */
      else if (level === 'warn') console.warn(`dsh-balance-pro: ${message}`)
    } catch {
      /* logging must never break a request */
    }
  }

  /**
   * Resolve the API key once, distinguishing "not configured" from "the
   * credentials service is unavailable".
   * @returns the key ('' when unset).
   */
  async resolveKey() {
    const ref = this.config.apiKeyEnv
    let store = this.credentials()
    // The credentials service publishes after some plugins apply; poll briefly
    // rather than declaring the Host broken on the very first read.
    for (let wait = 0; !store && wait < CREDENTIAL_SERVICE_WAIT_MS; wait += 250) {
      await new Promise((resolve) => setTimeout(resolve, 250))
      store = this.credentials()
    }
    if (!store || typeof store.resolve !== 'function') {
      throw balanceError(CODES.CREDENTIALS_UNAVAILABLE, '当前宿主没有可用的凭据服务')
    }
    let lastError
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return readCredential(await store.resolve(ref))
      } catch (error) {
        if (error && error.code === CODES.CREDENTIALS_UNAVAILABLE) throw error
        lastError = error
        /* v8 ignore next -- the retry only matters while the service is still booting */
        if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, CREDENTIAL_RETRY_MS))
      }
    }
    throw balanceError(
      CODES.CREDENTIALS_UNAVAILABLE,
      `凭据读取失败：${redact((lastError && lastError.message) || lastError)}`,
    )
  }

  /**
   * One upstream read with a single retry for transient failures.
   * @param key - API key.
   * @returns the balance fields.
   */
  async readUpstream(key) {
    const url = `${this.config.baseURL}/user/balance`
    let lastError
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await this.fetchImpl(url, {
          method: 'GET',
          headers: {
            authorization: `Bearer ${key}`,
            accept: 'application/json',
          },
          signal: AbortSignal.timeout(this.config.requestTimeoutMs),
        })
        /* v8 ignore next 2 -- a stubbed fetch without ok/status in a test */
        if (!response || typeof response.ok !== 'boolean') throw balanceError(CODES.NETWORK, '余额接口返回了无法识别的响应')
        if (!response.ok) {
          const error = httpError(Number(response.status))
          if (error.transient === true && attempt === 0) {
            lastError = error
            await new Promise((resolve) => setTimeout(resolve, 500))
            continue
          }
          throw error
        }
        let body
        try {
          body = await response.json()
        } catch {
          throw balanceError(CODES.PARSE, '余额接口返回不是合法 JSON')
        }
        return readBalance(body, this.config.currency)
      } catch (error) {
        const normalized = error && typeof error.code === 'string' ? error : transportError(error)
        if (normalized.transient === true && attempt === 0) {
          lastError = normalized
          /* v8 ignore next -- first-attempt branch covered by the retry test */
          continue
        }
        throw normalized
      }
    }
    /* v8 ignore next -- the loop returns or throws on every path */
    throw lastError ?? balanceError(CODES.HTTP, '余额接口请求失败')
  }

  /**
   * Caching wrapper around {@link readUpstream}. Concurrent callers share one
   * read; a stale success is kept as `stale` when the next read fails.
   * @param options - `force` bypasses the success TTL (subject to a cooldown).
   * @returns the JSON payload.
   */
  async get(options = {}) {
    const now = this.now()
    const ttlMs = this.config.refreshMinutes * 60_000
    if (!options.force && this.last && now - this.last.at < ttlMs) return this.payloadOf(this.last, { fromCache: true })
    if (this.inflight !== null) return this.inflight

    // A forced read inside the cooldown is a no-op rather than an upstream
    // read: the cached success is at most FORCE_COOLDOWN_MS older than the
    // caller wanted, and two closed tabs cannot turn into a request storm.
    const force = options.force === true && now - this.lastForcedAt >= FORCE_COOLDOWN_MS
    if (options.force === true && !force && this.last !== null) return this.payloadOf(this.last, { fromCache: true })
    // A forced read still waits out a cached failure: the user pressing refresh
    // must not become a retry loop against an endpoint that just refused.
    if (this.failure && (force ? now - this.failedAt < FAILURE_TTL_MS : now < this.failure.until)) {
      return this.payloadOf(undefined, { error: this.failure.error })
    }
    if (force) this.lastForcedAt = now

    this.inflight = this.read()
      .then((result) => {
        // Remember the settlement time separately: a stale payload must keep
        // the timestamp of the success it is showing, not "now".
        result.settledAt = this.now()
        this.last = result
        this.failure = null
        this.failedAt = 0
        this.log('info', `balance refreshed (${result.fields.currency} ${result.fields.totalBalance})`)
        return this.payloadOf(result, {})
      })
      .catch((error) => {
        const code = (error && error.code) || CODES.HTTP
        this.failedAt = this.now()
        this.failure = { error, until: this.failedAt + FAILURE_TTL_MS }
        this.log(code === CODES.NO_KEY ? 'info' : 'warn', `balance unavailable (${code}): ${redact((error && error.message) || error)}`)
        return this.payloadOf(undefined, { error })
      })
      .finally(() => {
        this.inflight = null
      })
    return this.inflight
  }

  /**
   * Perform one read with credentials.
   * @returns `{ fields, accountTag, at }`.
   */
  async read() {
    let key = ''
    try {
      key = await this.resolveKey()
    } catch (error) {
      // No credentials service: the signed-in account session can still answer.
      if (error && error.code === CODES.CREDENTIALS_UNAVAILABLE && this.accountService() !== undefined) {
        const fields = await this.readAccountBalance()
        return { fields, accountTag: fields.accountTag, at: this.now() }
      }
      throw error
    }
    if (key === '') {
      // No API key: the account session is the other way DSH knows this person.
      // Both facts belong in the message — "no key" alone reads like a setup
      // mistake even when the account path was the one that failed.
      const noKey = `未配置 ${this.config.apiKeyEnv}：在 设置 → 模型 里填入 DeepSeek API Key，或在 ~/.dsh/.credentials.yaml 的 refs 下添加该字段`
      try {
        const fields = await this.readAccountBalance()
        return { fields, accountTag: fields.accountTag, at: this.now() }
      } catch (accountError) {
        throw balanceError(
          (accountError && accountError.code) || CODES.NO_KEY,
          `${noKey}；账号登录路：${(accountError && accountError.message) || accountError}`,
        )
      }
    }
    try {
      const fields = await this.readUpstream(key)
      // The key path carries no identity or lifetime spend; the account session
      // can supply both when the user is signed in.
      const account = await this.readAccountIdentity()
      return { fields: { ...fields, ...account }, accountTag: accountTagOf(key), at: this.now() }
    } catch (error) {
      // A stale or foreign key must not hide a signed-in account's balance;
      // only fall back when the account service can actually answer.
      if (this.accountService() === undefined) throw error
      try {
        const fields = await this.readAccountBalance()
        this.log('info', `balance read through the account session (${error.code || 'key path failed'})`)
        return { fields, accountTag: fields.accountTag, at: this.now() }
      } catch (accountError) {
        throw balanceError(
          error.code || CODES.HTTP,
          `${(error && error.message) || error}；账号登录路：${(accountError && accountError.message) || accountError}`,
        )
      }
    }
  }

  /**
   * Client identity headers' payload, matching what the desktop account card
   * passes: version, locale and timezone offset in seconds.
   * @returns the client value for `getBalance` / `getProfile`.
   */
  clientIdentity() {
    return {
      version: String(process.env.DSH_CLIENT_VERSION || 'unknown'),
      locale: String(process.env.DSH_LOCALE || 'zh_CN'),
      timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60,
    }
  }

  /**
   * The DSH account service, when this Host provides one.
   *
   * Read through `get()`, never declared in `inject`: older Hosts do not have
   * it, and an entry that waits for a missing service never applies at all.
   * @returns the service, or undefined.
   */
  accountService() {
    try {
      const service = this.account?.()
      return service && typeof service.getBalance === 'function' ? service : undefined
    } catch {
      return undefined
    }
  }

  /**
   * Profile and lifetime spend from the account session, for the API-key path
   * that reports neither.
   * @returns `{ account?, totalCost? }`; empty when not signed in.
   */
  async readAccountIdentity() {
    const account = this.accountService()
    if (account === undefined) return {}
    const client = this.clientIdentity()
    const out = {}
    let projected = null
    try {
      if (typeof account.getProfile === 'function') {
        const answer = await account.getProfile(client)
        if (answer && answer.status === 'ready' && answer.value) projected = answer.value
      }
    } catch {
      /* identity is decoration */
    }
    const withEmail = await this.preferEmailContact(account, projected)
    if (withEmail) out.account = withEmail
    try {
      const summary = await account.getBalance(client)
      // The service's parser keeps `normal_wallets` / `bonus_wallets` and drops
      // the lifetime spend, so the platform's own summary is read again here
      // (same token, same headers) to recover `total_costs`.
      void summary
    } catch {
      /* spend is decoration too */
    }
    Object.assign(out, await this.readTotalCosts(account))
    return out
  }

  /**
   * The signed-in account's email.
   *
   * `deepseekAccount.getProfile` projects `mobile || mobileNumber || email`, so
   * a phone number hides the email. The same endpoint's body carries both, and
   * this reads it with the stored grant to prefer the email (the platform masks
   * it: `cha*****iu@163.com`).
   * @param account - the account service.
   * @param fallback - profile the service already projected.
   * @returns the profile with `contact` set to the email when one is readable.
   */
  async preferEmailContact(account, fallback) {
    if (this.config.readTotalCosts !== true) return fallback
    const record = await this.storedAccountGrant()
    if (record === null) return fallback
    let headers
    try {
      headers = typeof account.detailHeaders === 'function'
        ? account.detailHeaders(this.clientIdentity())
        : this.plainAccountHeaders()
    } catch {
      headers = this.plainAccountHeaders()
    }
    try {
      const response = await this.fetchImpl(`${record.issuer}/auth-api/v0/users/current`, {
        method: 'GET',
        headers: { ...headers, 'x-dsh-auth-token': record.token },
        signal: AbortSignal.timeout(this.config.requestTimeoutMs),
      })
      if (!response.ok) return fallback
      const body = await response.json()
      const user = body && body.code === 0 && body.data && body.data.biz_code === 0 ? body.data.biz_data : null
      if (!user || typeof user.email !== 'string' || user.email === '') return fallback
      return {
        id: user.id ?? fallback?.id ?? null,
        avatarUrl: user.id_profile?.picture ?? fallback?.avatarUrl ?? null,
        name: user.id_profile?.name ?? fallback?.name ?? null,
        contact: user.email,
      }
    } catch {
      return fallback
    }
  }

  /**
   * Lifetime spend, which the account service does not project.
   *
   * `deepseekAccount.getBalance` reads `get_user_summary` and keeps only the
   * two wallet lists, dropping `total_costs`. The platform's own summary is
   * therefore read once here with the stored grant, using the exact headers the
   * service builds (issuer + `x-dsh-auth-token` + the five `x-client-*` ones).
   * The grant is read through `credentials.readRecord`; no token is logged and a
   * Host without that record simply shows a dash.
   * @param account - the account service (for its client headers when present).
   * @returns `{ totalCost }`, or {} when the summary cannot be read.
   */
  async readTotalCosts(account) {
    if (this.config.readTotalCosts !== true) return {}
    const record = await this.storedAccountGrant()
    if (record === null) return {}
    let headers
    try {
      headers = typeof account.detailHeaders === 'function'
        ? account.detailHeaders(this.clientIdentity())
        : this.plainAccountHeaders()
    } catch {
      headers = this.plainAccountHeaders()
    }
    try {
      const response = await this.fetchImpl(`${record.issuer}/api/v0/users/get_user_summary`, {
        method: 'GET',
        headers: { ...headers, 'x-dsh-auth-token': record.token },
        signal: AbortSignal.timeout(this.config.requestTimeoutMs),
      })
      if (!response.ok) return {}
      const body = await response.json()
      const costs = body && body.code === 0 && body.data && body.data.biz_code === 0
        && body.data.biz_data && Array.isArray(body.data.biz_data.total_costs)
        ? body.data.biz_data.total_costs
        : []
      const picked = costs.find((entry) => entry && String(entry.currency || '').toUpperCase() === this.config.currency)
        || costs[0]
      const amount = picked && Number(picked.amount)
      return Number.isFinite(amount) ? { totalCost: Number(amount.toFixed(6)) } : {}
    } catch {
      return {}
    }
  }

  /**
   * The stored DeepSeek account grant (`{ token, issuer }`), if this Host has it.
   * @returns the grant, or null.
   */
  async storedAccountGrant() {
    try {
      const store = this.credentials()
      if (!store || typeof store.readRecord !== 'function') return null
      const record = await store.readRecord('deepseek-account-platform/default')
      const payload = record && record.payload
      if (!payload || typeof payload.token !== 'string' || typeof payload.issuer !== 'string') return null
      return { token: payload.token, issuer: payload.issuer.replace(/\/+$/, '') }
    } catch {
      return null
    }
  }

  /** The five client identity headers the platform client sends. */
  plainAccountHeaders() {
    const client = this.clientIdentity()
    return {
      'x-client-bundle-id': '',
      'x-client-platform': 'web',
      'x-client-version': client.version,
      'x-client-locale': client.locale,
      'x-client-timezone-offset': String(client.timezoneOffsetSeconds),
    }
  }

  /**
   * Read the balance through the DSH account session (no API key needed).
   *
   * The platform splits wallets into `value` (topped up) and `bonusWallets`
   * (granted); a fresh account may only have the latter, so both sides count.
   * @returns balance fields, or an error payload when the account path cannot
   *   answer (not signed in, service missing, platform refusal).
   */
  async readAccountBalance() {
    const account = this.accountService()
    if (account === undefined) {
      throw balanceError(CODES.CREDENTIALS_UNAVAILABLE, '当前宿主没有 DeepSeek 账号服务')
    }
    let state = null
    try {
      state = typeof account.getState === 'function' ? account.getState() : null
    } catch {
      state = null
    }
    const accountId = (state && (state.userId || (state.profile && state.profile.userId))) || null
    // The service takes the client identity itself; the card passes the same
    // version / locale / timezone triplet.
    const client = this.clientIdentity()
    let profile = null
    if (typeof account.getProfile === 'function') {
      try {
        const answer = await account.getProfile(client)
        if (answer && answer.status === 'ready' && answer.value) profile = answer.value
      } catch {
        /* the profile is decoration; the balance is the point */
      }
    }
    profile = await this.preferEmailContact(account, profile)
    let result
    try {
      result = await account.getBalance(client)
    } catch (error) {
      throw balanceError(CODES.NETWORK, `账号余额接口调用失败：${redact((error && error.message) || error)}`)
    }
    if (result === null || result === undefined) {
      throw balanceError(CODES.NO_KEY, '未登录 DeepSeek 账号（没有账号凭据）')
    }
    if (result.status !== 'ready') {
      throw balanceError(CODES.HTTP, `账号余额接口未就绪（${String(result.status || 'unknown')}）`)
    }
    const amountOf = (wallet) => {
      const value = Number(wallet && wallet.balance)
      return wallet && Number.isFinite(value) ? value : null
    }
    const usable = (list) => (Array.isArray(list) ? list : []).filter((wallet) => amountOf(wallet) !== null)
    const toppedUp = usable(result.value)
    const granted = usable(result.bonusWallets)
    const all = [...toppedUp, ...granted]
    if (all.length === 0) {
      throw balanceError(CODES.SHAPE, '账号没有可用的余额钱包')
    }
    const currencyOf = (wallet) => String((wallet && wallet.currency) || 'CNY').toUpperCase()
    const nonZero = all.filter((wallet) => Number(wallet.balance) > 0)
    const picked = nonZero.find((wallet) => currencyOf(wallet) === this.config.currency)
      || nonZero[0]
      || all.find((wallet) => currencyOf(wallet) === this.config.currency)
      || all[0]
    const currency = currencyOf(picked)
    const sumOf = (list) => list
      .filter((wallet) => currencyOf(wallet) === currency)
      .reduce((total, wallet) => total + Number(wallet.balance), 0)
    const recharge = sumOf(toppedUp)
    const bonus = sumOf(granted)
    // `total_costs` rides along in the same summary: the account's lifetime
    // spend, in the wallet currency.
    const costs = Array.isArray(result.totalCosts) ? result.totalCosts : []
    const cost = costs.find((entry) => entry && currencyOf({ currency: entry.currency }) === currency)
      || costs[0]
    const direct = cost && Number.isFinite(Number(cost.amount)) ? Number(Number(cost.amount).toFixed(6)) : null
    const totalCost = direct !== null ? direct : (await this.readTotalCosts(account)).totalCost ?? null
    return {
      totalCost,
      totalBalance: Number((recharge + bonus).toFixed(6)),
      rechargeBalance: Number(recharge.toFixed(6)),
      bonusBalance: Number(bonus.toFixed(6)),
      currency,
      isAvailable: recharge + bonus > 0,
      accountTag: createHash('sha256').update(`dsh-account:${accountId === null ? 'default' : String(accountId)}`).digest('hex').slice(0, 24),
      source: 'account',
      account: {
        id: profile?.id ?? accountId ?? null,
        contact: profile?.contact ?? null,
        name: profile?.name ?? null,
        avatarUrl: profile?.avatarUrl ?? null,
      },
    }
  }

  /**
   * One payload from either a successful read or a failure.
   * @param result - successful read, if any.
   * @param extra - source flags and error.
   * @returns the JSON body.
   */
  payloadOf(result, extra) {
    const failed = extra.error !== undefined
    // A failed read after a success keeps the last numbers on screen, marked
    // `stale` — a blank pill would read as "your balance is gone".
    const fallback = failed ? this.last : null
    return payload({
      ok: failed ? fallback !== null : true,
      fields: failed ? fallback?.fields ?? null : result.fields,
      accountTag: failed ? fallback?.accountTag ?? null : result.accountTag,
      stale: fallback !== null,
      error: failed ? extra.error : undefined,
      fromCache: extra.fromCache === true,
      lowBalanceThreshold: this.config.lowBalanceThreshold,
      refreshMinutes: this.config.refreshMinutes,
      fetchedAt: failed ? fallback?.settledAt ?? fallback?.at ?? this.now() : result.at,
    })
  }
}

/**
 * How many turns the on-disk ledger keeps before the oldest are dropped.
 * 20k turns is months of heavy use and a few megabytes of JSONL.
 */
const USAGE_MAX_TURNS = 20_000

/**
 * How many unwritten ledger lines are kept while the store is failing.
 * One line is a few hundred bytes, so this caps the memory cost of a
 * read-only profile at a couple of megabytes.
 */
const USAGE_MAX_PENDING = 2_000

/**
 * The local usage ledger behind the usage tab.
 *
 * The platform bills per wallet, not per day, and exposes no per-call spend;
 * the session feed does carry provider-reported usage for every settlement,
 * so each settled turn is priced here and appended to a JSONL file the plugin
 * owns. Nothing leaves the machine and no token or prompt text is stored —
 * only the last sample per (session, turn), its timestamp, its tier and its
 * token buckets.
 *
 * Every path is defensive: a Host without a home directory, a read-only
 * profile or a malformed line degrades to an empty ledger, never a crash.
 */
export class UsageLedger {
  /**
   * @param options - `{ config, logger, storePath, now }`.
   */
  constructor(options = {}) {
    this.config = options.config ?? { pricing: DEFAULT_PRICING, usageDays: 7, usageTurnLimit: 40 }
    this.logger = options.logger ?? console
    this.now = options.now ?? Date.now
    this.storePath = options.storePath ?? null
    /** In-memory state, loaded once from disk when a store path is known. */
    this.state = null
    /** Pending append, coalesced so one turn does not mean one write. */
    this.flushTimer = null
    this.appendBuffer = []
    this.warned = false
  }

  /**
   * Ledger state, bootstrapping from disk on first use.
   * @returns the state.
   */
  snapshot() {
    if (this.state !== null) return this.state
    this.state = emptyLedger()
    if (this.storePath === null) return this.state
    let text = ''
    try {
      text = fs.readFileSync(this.storePath, 'utf8')
    } catch {
      // No file yet: the first turn creates it.
      return this.state
    }
    for (const line of text.split('\n')) {
      if (line.trim() === '') continue
      let record
      try {
        record = JSON.parse(line)
      } catch {
        continue
      }
      if (!record || typeof record.session !== 'string' || typeof record.line !== 'object') continue
      // The file stores buckets, not the provider's field names; map them back
      // so replay prices exactly what the live fold did.
      const buckets = record.usage || {}
      this.state = foldEvent(this.state, {
        type: 'assistant/message',
        time: record.time,
        data: {
          turn: record.line.turn,
          model: record.line.model,
          provider: record.line.provider,
          usage: {
            inputTokens: buckets.uncachedInput,
            outputTokens: buckets.output,
            cacheReadTokens: buckets.cacheRead,
            cacheWriteTokens: buckets.cacheWrite,
          },
        },
      }, record.session, this.config.pricing)
    }
    return this.state
  }

  /**
   * Fold a batch of committed session events.
   * @param sessionId - session that produced them.
   * @param events - committed events.
   */
  ingest(sessionId, events) {
    if (typeof sessionId !== 'string' || sessionId === '') return
    if (!Array.isArray(events) || events.length === 0) return
    for (const event of events) {
      const before = this.snapshot()
      const after = foldEvent(before, event, sessionId, this.config.pricing)
      if (after === before) continue
      this.state = after
      const usage = usageRecordOf(event)
      if (usage !== null) {
        // Buffer first, then schedule: a scheduled flush always has its line.
        this.appendBuffer.push({ session: sessionId, time: event.time, usage: usage.usage, line: usage.line })
        this.scheduleFlush()
      }
    }
    this.prune()
  }

  /** Coalesce appends: one flush per animation-sized window of turns. */
  scheduleFlush() {
    if (this.storePath === null || this.flushTimer !== null) return
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null
      this.flush()
    }, 400)
    this.flushTimer.unref?.()
  }

  /**
   * Write the buffered lines, newest state already folded in memory.
   *
   * A failed write puts the lines back at the head of the buffer so the next
   * flush retries them; the buffer is capped so an unwritable disk costs
   * bounded memory instead of growing for the rest of the session.
   */
  flush() {
    if (this.storePath === null || this.appendBuffer.length === 0) return
    const lines = this.appendBuffer
    this.appendBuffer = []
    try {
      fs.mkdirSync(path.dirname(this.storePath), { recursive: true })
      fs.appendFileSync(this.storePath, lines.map((line) => JSON.stringify(line)).join('\n') + '\n', 'utf8')
    } catch (error) {
      if (this.appendBuffer.length + lines.length <= USAGE_MAX_PENDING) {
        this.appendBuffer = lines.concat(this.appendBuffer)
      }
      if (!this.warned) {
        this.warned = true
        this.logger.warn?.(`dsh-balance-pro: usage ledger not writable (${redact((error && error.message) || error)})`)
      }
    }
  }

  /**
   * Keep the newest {@link USAGE_MAX_TURNS} turns in memory and on disk.
   *
   * Rewriting is rare (once the cap is crossed) and bounded: the file is
   * replaced atomically through a sibling temp file.
   */
  prune() {
    const state = this.snapshot()
    // Pending lines are not on disk yet: rewriting the file now would drop
    // them, so the cap waits for the next flushed turn.
    if (this.appendBuffer.length > 0) return
    let count = 0
    for (const session of Object.values(state.sessions)) count += Object.keys(session.turns).length
    if (count <= USAGE_MAX_TURNS) return
    const rows = []
    for (const [sessionId, session] of Object.entries(state.sessions)) {
      for (const turn of Object.values(session.turns)) rows.push({ sessionId, turn })
    }
    rows.sort((left, right) => right.turn.at - left.turn.at)
    const kept = new Set(rows.slice(0, USAGE_MAX_TURNS).map((row) => `${row.sessionId}:${row.turn.turn}`))
    const sessions = {}
    for (const row of rows.slice(0, USAGE_MAX_TURNS)) {
      sessions[row.sessionId] = sessions[row.sessionId] || { turns: {} }
      sessions[row.sessionId].turns[row.turn.turn] = row.turn
    }
    this.state = { version: 1, sessions }
    if (this.storePath === null) return
    try {
      const text = rows.filter((row) => kept.has(`${row.sessionId}:${row.turn.turn}`))
        .sort((left, right) => left.turn.at - right.turn.at)
        .map((row) => JSON.stringify({
          session: row.sessionId,
          time: row.turn.at,
          usage: row.turn.tokens,
          line: { turn: row.turn.turn, model: row.turn.model, provider: row.turn.provider },
        }))
        .join('\n')
      const temp = `${this.storePath}.tmp`
      fs.mkdirSync(path.dirname(this.storePath), { recursive: true })
      fs.writeFileSync(temp, text + '\n', 'utf8')
      fs.renameSync(temp, this.storePath)
    } catch (error) {
      if (!this.warned) {
        this.warned = true
        this.logger.warn?.(`dsh-balance-pro: usage ledger prune failed (${redact((error && error.message) || error)})`)
      }
    }
  }

  /**
   * The usage tab payload.
   * @param options - `{ balance }` in yuan, for the runway bar.
   * @returns the summary body.
   */
  summary(options = {}) {
    return summarize(this.snapshot(), {
      now: this.now(),
      balance: options.balance,
      days: this.config.usageDays,
      limit: this.config.usageTurnLimit,
      pricing: this.config.pricing,
    })
  }
}

/**
 * The JSONL record for one settlement, or null when it carries no usage.
 * @param event - committed session event.
 * @returns `{ usage, line }` or null.
 */
function usageRecordOf(event) {
  if (!event || event.type !== 'assistant/message' || !event.data) return null
  const sample = usageOf(event)
  if (sample === null) return null
  return {
    usage: sample.usage,
    line: { turn: Number(event.data.turn) || 0, model: sample.model, provider: sample.provider },
  }
}

/**
 * Write one JSON body.
 * @param res - node:http response.
 * @param status - HTTP status.
 * @param body - JSON-safe value.
 */
function sendJson(res, status, body, extraHeaders = {}) {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'content-length': Buffer.byteLength(text),
    ...extraHeaders,
  })
  res.end(text)
}

/**
 * CORS headers for the balance route.
 *
 * The desktop page runs on `dsh-app://app` and reads the balance from
 * `http://127.0.0.1:<port>`, i.e. cross-origin: without these headers Chrome
 * delivers the request and then discards the response, so the pill could only
 * ever say "cannot reach the balance API". The route is read-only and carries
 * no credential (the key stays in this process), so `*` is the honest answer.
 * @returns response headers.
 */
function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, HEAD, OPTIONS',
    'access-control-allow-headers': 'accept, content-type',
    'access-control-max-age': '600',
  }
}

/**
 * Where the usage ledger lives when the config names no path.
 *
 * `$DSH_HOME` wins (the desktop shell sets it); otherwise `~/.dsh`. A Host
 * without a home directory gets no persistence, only in-memory counts.
 * @returns a JSONL path, or null for memory-only.
 */
export function defaultUsageStorePath() {
  const base = String(process.env.DSH_HOME || '').trim()
  if (base !== '') return path.join(base, 'balance-pro-usage.jsonl')
  try {
    const home = os.homedir()
    return home ? path.join(home, '.dsh', 'balance-pro-usage.jsonl') : null
  } catch {
    return null
  }
}

/**
 * Stable id for the session a `session/event` names.
 * @param session - live session object (or an id, in tests).
 * @returns the id string.
 */
function sessionIdOf(session) {
  if (typeof session === 'string') return session
  if (!session || typeof session !== 'object') return ''
  const candidates = [session.id, session.sessionId, session.address && session.address.sessionId,
    session.snapshot && session.snapshot.id]
  return candidates.find((value) => typeof value === 'string' && value !== '') || ''
}

/**
 * The Host plugin object. `name` must equal the package name so cordis can
 * label the fiber and client-modules can pair the browser row with it.
 */
export default {
  name: 'dsh-balance-pro',
  version: PACKAGE_VERSION,
  apply(root, rawConfig) {
    const config = normalizeConfig(rawConfig)
    const logger = root.logger ?? console
    const service = new BalanceService({
      config,
      logger,
      account: () => {
        try {
          return root.get('deepseekAccount')
        } catch {
          /* v8 ignore next -- a composition without the account service */
          return undefined
        }
      },
      credentials: () => {
        try {
          return root.get('credentials')
        } catch {
          /* v8 ignore next -- a composition without the service lookup */
          return undefined
        }
      },
    })

    // ── local usage ledger ──────────────────────────────────────────────────
    // Listeners stay outside the webServer injection so the ledger keeps
    // counting even in a Host without a page; the route only reads it.
    const ledger = new UsageLedger({
      config,
      logger,
      storePath: typeof config.usageStorePath === 'string' && config.usageStorePath !== ''
        ? config.usageStorePath
        : defaultUsageStorePath(),
    })
    root.effect(() => {
      const off = typeof root.on === 'function'
        ? root.on('session/event', (session, event) => {
          const events = Array.isArray(event) ? event : [event]
          for (const item of events) {
            if (item) ledger.ingest(sessionIdOf(session), [item])
          }
        })
        : () => {}
      return () => {
        typeof off === 'function' ? off() : undefined
        ledger.flush()
      }
    }, 'dsh-balance-pro: usage ledger')

    // ── browser half + API, once a web server exists ────────────────────────
    root.inject(['webServer'], (scoped) => {
      const server = scoped.webServer
      try {
        globalThis.__dshBalanceProPort = Number(server.port) || 0
      } catch {
        /* v8 ignore next -- a server without a bound port keeps the default */
      }
      const trustedHosts = String(process.env.DSHB_TRUSTED_HOSTS || '')
        .split(',')
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean)

      const admit = (req) => {
        let connection
        try {
          connection = scoped.get('connection')
        } catch {
          connection = undefined
        }
        return admission(req, { connection, trustedHosts })
      }

      scoped.effect(() => server.register({
        kind: 'exact',
        path: CLIENT_PATH,
        handler: (req, res) => {
          // The plugin route is the trust boundary; a row URL served below is
          // opportunistic (only `/plugins/...` exact paths are intercepted).
          const rejection = admit(req)
          if (rejection !== null) {
            res.writeHead(rejection, { 'content-type': 'text/plain; charset=utf-8' })
            res.end(rejection === 405 ? 'method not allowed' : 'forbidden')
            return
          }
          sendClientBundle(res)
        },
      }), 'dsh-balance-pro: client script')

      scoped.effect(() => server.register({
        kind: 'exact',
        path: PLUGIN_ROW_PATH,
        handler: (req, res) => sendClientBundle(res),
      }), 'dsh-balance-pro: client-modules row')

      scoped.effect(() => server.register({
        kind: 'prefix',
        path: BASE_PATH,
        handler: async (req, res) => {
          // A cross-origin browser preflight carries no cookies, so it is
          // answered before the fence: it reveals nothing but the CORS policy.
          if (req.method === 'OPTIONS') {
            res.writeHead(204, corsHeaders())
            res.end()
            return
          }
          const rejection = admit(req)
          if (rejection !== null) {
            sendJson(res, rejection, { ok: false, code: 'FORBIDDEN', error: '仅允许本机访问' }, corsHeaders())
            return
          }
          await sumPath(req, res)
        },
      }), 'dsh-balance-pro: api')

      /**
       * Answer the balance route; any other sub-path of the prefix (including
       * an upgrade the web server routes as a normal request) is a 404.
       */
      async function sumPath(req, res) {
        const cors = corsHeaders()
        // The browser preflights a cross-origin read before the real GET.
        if (req.method === 'OPTIONS') {
          res.writeHead(204, cors)
          res.end()
          return
        }
        let target
        try {
          target = new URL(String(req.url || '/'), 'http://local')
        } catch {
          /* v8 ignore next 3 -- node:http always supplies a parseable target */
          sendJson(res, 400, { ok: false, code: 'BAD_REQUEST', error: 'bad request' }, cors)
          return
        }
        const force = target.searchParams.get('force') === '1'
        if (target.pathname !== BALANCE_PATH && target.pathname !== USAGE_PATH) {
          sendJson(res, 404, { ok: false, code: 'NOT_FOUND', error: 'unknown route' }, cors)
          return
        }
        if (req.method === 'HEAD') {
          res.writeHead(200, { ...cors, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
          res.end()
          return
        }
        if (target.pathname === USAGE_PATH) {
          await usageRoute(force, res)
          return
        }
        const body = await service.get({ force })
        sendJson(res, 200, body, cors)
      }

      /**
       * Answer the usage route.
       *
       * The wallet is read from the balance cache (never forced here: the
       * tab's own refresh button forces `balance.json`, and the usage read
       * simply picks up the freshest wallet). The usage numbers themselves
       * come from the local ledger and are always current, so `force` only
       * decides whether the wallet is refreshed first.
       */
      async function usageRoute(force, res) {
        const cors = corsHeaders()
        if (force) await service.get({ force: true }).catch(() => undefined)
        let balance = null
        try {
          const payload = await service.get({})
          balance = payload && payload.ok && typeof payload.totalBalance === 'number' ? payload.totalBalance : null
        } catch {
          balance = null
        }
        ledger.flush()
        const body = ledger.summary({ balance })
        sendJson(res, 200, body, cors)
      }



      // Warm the cache once so the first pill paint usually has data, then
      // refresh on the configured cadence while the Host stays up.
      void service.get({}).catch(() => {})
      scoped.effect(() => {
        const timer = setInterval(() => {
          void service.get({ force: true }).catch(() => {})
        }, config.refreshMinutes * 60_000)
        timer.unref?.()
        return () => clearInterval(timer)
      }, 'dsh-balance-pro: refresh loop')

      // One diagnostic line the user can hand back verbatim: it says whether the
      // failure is the key, the network or the upstream.
      void service.get({ force: true }).then((payload) => {
        logger.info?.(payload.ok
          ? `dsh-balance-pro: balance ok (${payload.currency} ${String(payload.totalBalance)})`
          : `dsh-balance-pro: balance unavailable — ${payload.code}: ${payload.error}`)
      })
      logger.info?.(`dsh-balance-pro: API mounted at ${BASE_PATH}`)
    })
  },
}

// Exported for the test suite; not part of the cordis plugin contract.

export { BALANCE_PATH, CLIENT_PATH, PLUGIN_ROW_PATH, USAGE_PATH }

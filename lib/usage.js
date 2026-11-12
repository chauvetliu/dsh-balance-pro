/**
 * Pure usage accounting: what one model call cost, which pricing tier it
 * landed in, and how a session's turns fold into a local ledger.
 *
 * No cordis context and no I/O — every function here is safe to unit test.
 *
 * Data sources (measured against DSH 0.2.2-rc.1):
 * - The platform's account endpoints expose wallet balances and lifetime
 *   `total_costs` only. There is no per-day or per-call spend, so today's spend
 *   and per-turn spend have to be derived locally.
 * - Every assistant settlement carries provider-reported usage
 *   (`inputTokens`, `outputTokens`, `cacheReadTokens`, `cacheWriteTokens`) and
 *   the model that answered, which is enough to price the call exactly once
 *   the rate card is known.
 *
 * Money is computed in integer *micro-yuan* (µ¥, 1e-6 CNY) per turn and turned
 * into yuan only for display, so a ledger of thousands of turns never drifts.
 *
 * @module lib/usage
 */

/** Money is kept in micro-yuan; one yuan is 1e6 µ¥. */
const MICRO = 1_000_000
/** Beijing time is UTC+8 all year; the rate card is published in that zone. */
export const BEIJING_OFFSET_MINUTES = 8 * 60

/**
 * The published rate card, in yuan per million tokens.
 *
 * DeepSeek halves every input/output rate outside its peak windows; the peak
 * windows below are Beijing time, Monday to Friday, 09:00–12:00 and
 * 14:00–18:00 ("空闲时段价格为高峰时段价格的一半").
 * https://api-docs.deepseek.com/zh-cn/quick_start/pricing
 */
export const DEFAULT_PRICING = Object.freeze({
  currency: 'CNY',
  provider: 'deepseek',
  models: Object.freeze({
    'deepseek-flash': Object.freeze({
      cacheHit: 0.04,
      cacheMiss: 2,
      output: 8,
    }),
    'deepseek-v4-pro': Object.freeze({
      cacheHit: 0.30,
      cacheMiss: 9,
      output: 27,
    }),
  }),
  /**
   * Model-name family → rate card row. First match wins, longest prefix first,
   * and only on a token boundary, so `deepseek-flash-2` matches while
   * `deepseek-flashy` does not.
   *
   * DeepSeek keeps one stable model name per card (`deepseek-flash`,
   * `deepseek-v4-pro`) and retires dated versions behind it — today
   * DeepSeek-V4.1-Flash-1017 and DeepSeek-V4-Pro-0813. DSH reports whatever the
   * configuration used, so every spelling that can reach it is listed:
   * - `deepseek-v4.1-flash` / `deepseek-v4.1-flash-free`: the vendor-prefixed
   *   names an OpenAI-compatible proxy or the DSH free route reports;
   * - `deepseek-v4-flash` / `deepseek-v4-flash-vision-exp`: the retired names
   *   the docs still serve as DeepSeek-V4.1-Flash-1017 at Flash prices.
   */
  aliases: Object.freeze({
    'deepseek-flash': 'deepseek-flash',
    'deepseek-v4.1-flash': 'deepseek-flash',
    'deepseek-v4-flash': 'deepseek-flash',
    'deepseek-chat': 'deepseek-flash',
    'deepseek-reasoner': 'deepseek-flash',
    'deepseek-v3': 'deepseek-flash',
    'deepseek-v4-pro': 'deepseek-v4-pro',
    'deepseek-v4.1-pro': 'deepseek-v4-pro',
    'deepseek-r1': 'deepseek-v4-pro',
  }),
  /**
   * Routes billed on this card, by provider id. DSH reports the provider that
   * answered as `message.source.provider`, so an OpenAI-compatible proxy of
   * DeepSeek models (`deepseek-openai`, say) is still DeepSeek money. A row
   * that lists neither is treated as a DeepSeek route.
   */
  providers: Object.freeze(['deepseek']),
  /** Off-peak multiplier applied to every rate outside the peak windows. */
  offPeakMultiplier: 0.5,
  /** Peak windows, Beijing time, `HH:MM-HH:MM`, inclusive start, exclusive end. */
  peakWindows: Object.freeze(['09:00-12:00', '14:00-18:00']),
  /** A Saturday/Sunday is off-peak all day (weekend). */
  peakWeekdaysOnly: true,
  /**
   * Usage from routes that are *not* on this card (Qwen, GLM, …) is still
   * ledgered; these are the roughest published list prices, in yuan per
   * million tokens, used only to draw their spend. They are labelled as an
   * estimate everywhere they appear.
   */
  catalog: Object.freeze({
    // Longest family name first: `qwen3-max` must win over `qwen3`.
    qwen: Object.freeze({
      label: 'Qwen',
      peakWindowed: false,
      models: Object.freeze({
        'qwen3-max': Object.freeze({ cacheHit: 2.4, cacheMiss: 2.4, output: 12 }),
        'qwen-max': Object.freeze({ cacheHit: 2.4, cacheMiss: 2.4, output: 9.6 }),
        'qwen2.5-max': Object.freeze({ cacheHit: 2.4, cacheMiss: 2.4, output: 9.6 }),
        'qwen-plus': Object.freeze({ cacheHit: 0.8, cacheMiss: 0.8, output: 2 }),
        'qwen3-coder': Object.freeze({ cacheHit: 1, cacheMiss: 4, output: 16 }),
        'qwen2.5-coder': Object.freeze({ cacheHit: 1, cacheMiss: 3, output: 6 }),
        'qwen3-vl': Object.freeze({ cacheHit: 2, cacheMiss: 2, output: 2 }),
        'qwen-turbo': Object.freeze({ cacheHit: 0.3, cacheMiss: 0.3, output: 0.6 }),
        'qwen-long': Object.freeze({ cacheHit: 0.5, cacheMiss: 0.5, output: 2 }),
        'qwen3': Object.freeze({ cacheHit: 0.001, cacheMiss: 0.3, output: 1.2 }),
        'qwen2.5': Object.freeze({ cacheHit: 0.7, cacheMiss: 0.7, output: 1.4 }),
      }),
    }),
    glm: Object.freeze({
      label: 'GLM',
      peakWindowed: false,
      models: Object.freeze({
        'glm-4.6': Object.freeze({ cacheHit: 4, cacheMiss: 4, output: 16 }),
        'glm-4.5': Object.freeze({ cacheHit: 1, cacheMiss: 4, output: 16 }),
        'glm-4-plus': Object.freeze({ cacheHit: 50, cacheMiss: 50, output: 50 }),
      }),
    }),
    moonshot: Object.freeze({
      label: 'Moonshot',
      peakWindowed: false,
      models: Object.freeze({
        // kimi-k2.5, kimi-k2-0905, kimi-k2-thinking… all land on the K2 row.
        'kimi-k2': Object.freeze({ cacheHit: 4, cacheMiss: 4, output: 16 }),
        'kimi-k1.5': Object.freeze({ cacheHit: 4, cacheMiss: 4, output: 16 }),
        'moonshot-v1': Object.freeze({ cacheHit: 12, cacheMiss: 12, output: 12 }),
      }),
    }),
  }),
})

/** Local day windows the summary reports. */
export const DEFAULT_DAY_WINDOWS = 7
/** How many turns the client shows before folding the rest into "earlier". */
export const DEFAULT_TURN_LIMIT = 40

/**
 * The local `YYYY-MM-DD` key of an instant.
 * @param at - epoch ms.
 * @returns the day key.
 */
export function dayKey(at) {
  const date = new Date(at)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/**
 * Beijing wall-clock minute-of-day for an instant.
 * @param at - epoch ms.
 * @returns 0–1439.
 */
export function beijingMinuteOfDay(at) {
  const shifted = new Date(at + BEIJING_OFFSET_MINUTES * 60_000)
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes()
}

/**
 * Beijing weekday, 0 = Sunday .. 6 = Saturday.
 * @param at - epoch ms.
 * @returns 0–6.
 */
export function beijingWeekday(at) {
  return new Date(at + BEIJING_OFFSET_MINUTES * 60_000).getUTCDay()
}

/**
 * Parse `HH:MM-HH:MM` windows into minutes. A window whose end is before its
 * start wraps past midnight.
 * @param windows - window strings.
 * @returns `{ start, end }` tuples in minutes; unparseable entries are skipped.
 */
export function parseWindows(windows) {
  const out = []
  for (const window of Array.isArray(windows) ? windows : []) {
    const match = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/.exec(String(window || '').trim())
    if (!match) continue
    const startHour = Number(match[1])
    const startMinute = Number(match[2])
    const endHour = Number(match[3])
    const endMinute = Number(match[4])
    if (startMinute > 59 || endMinute > 59) continue
    if (startHour > 23 || endHour > 24) continue
    if (endHour === 24 && endMinute !== 0) continue
    const start = startHour * 60 + startMinute
    const end = endHour * 60 + endMinute
    if (start === end && start !== 0) continue
    out.push({ start, end })
  }
  return out
}

/**
 * Is an instant billed at peak rates?
 * @param at - epoch ms.
 * @param pricing - normalized pricing (see {@link normalizePricing}).
 * @returns true when inside a peak window.
 */
export function isPeak(at, pricing = DEFAULT_PRICING) {
  const weekday = beijingWeekday(at)
  if (pricing.peakWeekdaysOnly && (weekday === 0 || weekday === 6)) return false
  const minute = beijingMinuteOfDay(at)
  for (const window of parseWindows(pricing.peakWindows)) {
    if (window.start === window.end) return true
    if (window.start < window.end) {
      if (minute >= window.start && minute < window.end) return true
    } else if (minute >= window.start || minute < window.end) {
      return true
    }
  }
  return false
}

/**
 * Coerce a rate-card row. Unusable rows answer null instead of guessing.
 * @param row - `{ cacheHit, cacheMiss, output }` in yuan per million tokens.
 * @returns the normalized row, or null.
 */
function rateRow(row) {
  if (!row || typeof row !== 'object') return null
  const hit = Number(row.cacheHit)
  const miss = Number(row.cacheMiss)
  const output = Number(row.output)
  if (![hit, miss, output].every((value) => Number.isFinite(value) && value >= 0)) return null
  return { cacheHit: hit, cacheMiss: miss, output }
}

/**
 * Provider ids that bill on the DeepSeek card.
 * @param input - raw config value.
 * @returns the normalized list, defaulting to DeepSeek.
 */
function providerList(input) {
  const list = Array.isArray(input) ? input : null
  const out = []
  for (const entry of list || DEFAULT_PRICING.providers) {
    const value = String(entry || '').trim().toLowerCase()
    if (value !== '' && !out.includes(value)) out.push(value)
  }
  return out.length > 0 ? out : [...DEFAULT_PRICING.providers]
}

/**
 * Normalize the foreign-model catalog onto the defaults.
 *
 * A route name maps to `{ label, peakWindowed, models }`; unknown rows are
 * dropped so a typo cannot invent a price.
 * @param input - raw config value.
 * @returns the catalog, frozen.
 */
function normalizeCatalog(input) {
  const source = input && typeof input === 'object' ? input : {}
  const out = {}
  const routes = Object.keys(DEFAULT_PRICING.catalog)
  for (const route of Object.keys(source)) {
    if (!routes.includes(route)) continue
    const row = source[route]
    if (!row || typeof row !== 'object') continue
    const models = {}
    for (const [name, card] of Object.entries(row.models && typeof row.models === 'object' ? row.models : {})) {
      const normalized = rateRow(card)
      if (normalized !== null) models[String(name)] = normalized
    }
    if (Object.keys(models).length === 0) continue
    out[route] = {
      label: typeof row.label === 'string' && row.label !== '' ? row.label : route,
      peakWindowed: row.peakWindowed === true,
      models,
    }
  }
  for (const route of routes) {
    if (out[route] !== undefined) continue
    const row = DEFAULT_PRICING.catalog[route]
    out[route] = { label: row.label, peakWindowed: row.peakWindowed, models: { ...row.models } }
  }
  return out
}

/**
 * Normalize a user-supplied pricing block onto the defaults.
 *
 * Users only ever need to touch `models`/`peakWindows`; anything unusable keeps
 * the published default rather than silently pricing at zero.
 * @param input - raw config value.
 * @returns a complete, frozen pricing object.
 */
export function normalizePricing(input) {
  const raw = input && typeof input === 'object' ? input : {}
  const models = {}
  const source = raw.models && typeof raw.models === 'object' ? raw.models : {}
  for (const [name, row] of Object.entries(source)) {
    const normalized = rateRow(row)
    if (normalized !== null) models[String(name)] = normalized
  }
  for (const [name, row] of Object.entries(DEFAULT_PRICING.models)) {
    if (models[name] === undefined) models[name] = { ...row }
  }
  const aliases = {}
  const aliasSource = raw.aliases && typeof raw.aliases === 'object' ? raw.aliases : {}
  for (const [alias, target] of Object.entries({ ...DEFAULT_PRICING.aliases, ...aliasSource })) {
    if (typeof target === 'string' && models[target] !== undefined) aliases[String(alias).toLowerCase()] = target
  }
  const windows = Array.isArray(raw.peakWindows) ? raw.peakWindows : DEFAULT_PRICING.peakWindows
  const parsed = parseWindows(windows)
  const offPeak = Number(raw.offPeakMultiplier)
  return Object.freeze({
    currency: typeof raw.currency === 'string' && raw.currency !== '' ? raw.currency.toUpperCase() : DEFAULT_PRICING.currency,
    provider: typeof raw.provider === 'string' && raw.provider !== '' ? raw.provider : DEFAULT_PRICING.provider,
    providers: Object.freeze(providerList(raw.providers)),
    models: Object.freeze(models),
    aliases: Object.freeze(aliases),
    catalog: Object.freeze(normalizeCatalog(raw.catalog)),
    offPeakMultiplier: Number.isFinite(offPeak) && offPeak >= 0 && offPeak <= 1 ? offPeak : DEFAULT_PRICING.offPeakMultiplier,
    peakWindows: Object.freeze(parsed.length === 0
      ? [...DEFAULT_PRICING.peakWindows]
      : parsed.map(({ start, end }) => `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}-${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`)),
    peakWeekdaysOnly: raw.peakWeekdaysOnly === undefined ? DEFAULT_PRICING.peakWeekdaysOnly : raw.peakWeekdaysOnly !== false,
  })
}

/**
 * Which rate-card row prices a model id.
 *
 * Model ids arrive with provider prefixes (`deepseek-account/deepseek-flash`)
 * and dated suffixes; the longest alias prefix wins so `deepseek-v4-pro` is
 * not swallowed by `deepseek-v4-flash`.
 * @param model - model id from the settlement.
 * @param pricing - normalized pricing.
 * @returns the card name, or null when nothing matches.
 */
export function cardForModel(model, pricing = DEFAULT_PRICING) {
  const raw = String(model || '').toLowerCase()
  if (raw === '') return null
  const bare = raw.includes('/') ? raw.slice(raw.lastIndexOf('/') + 1) : raw
  // Prefix match on a token boundary only: `deepseek-flash-preview` and
  // `deepseek-flash-2` are flash, `deepseek-flashy` is not. Mispricing a new
  // model is worse than leaving it unpriced, which the card reports as "—".
  const matches = (name) => bare === name
    || (bare.startsWith(name) && /^[-.:_@\s]/u.test(bare.slice(name.length)))
  const names = Object.keys(pricing.aliases).sort((left, right) => right.length - left.length)
  for (const alias of names) {
    if (matches(alias)) return pricing.aliases[alias]
  }
  const cards = Object.keys(pricing.models).map((card) => card.toLowerCase()).sort((left, right) => right.length - left.length)
  for (const card of cards) {
    if (matches(card)) return pricing.models[card] ? card : null
  }
  return null
}

/**
 * Rough list-price estimate for a route that is not on the DeepSeek card.
 *
 * Only ever used to draw spend for models like Qwen inside the ledger: the
 * result is flagged `estimate` so every surface can say so.
 * @param tokens - counted buckets.
 * @param model - model id.
 * @param pricing - normalized pricing (for the catalog).
 * @returns `{ micro, route, card }`, or null when the model is not in the catalog.
 */
export function estimateUsage(tokens, model, pricing = DEFAULT_PRICING) {
  const catalog = pricing.catalog || DEFAULT_PRICING.catalog
  const bare = String(model || '').toLowerCase()
  const name = bare.includes('/') ? bare.slice(bare.lastIndexOf('/') + 1) : bare
  if (name === '') return null
  for (const [route, row] of Object.entries(catalog)) {
    // Families are matched longest-first so `qwen3-coder` is never read as
    // `qwen3`. Vendors version their names instead of renaming the model, so a
    // dated suffix (`kimi-k2.5-0905`, `glm-4.6-air`) resolves to its family and
    // shares that family's list price — an estimate, labelled as one.
    const names = Object.keys(row.models).sort((left, right) => right.length - left.length)
    for (const candidate of names) {
      const rest = name.slice(candidate.length)
      const matches = name === candidate || (name.startsWith(candidate) && /^[-.:_@\s]/u.test(rest))
      if (!matches) continue
      const rates = row.models[candidate]
      const micro = rates.cacheHit * (tokens.cacheRead + tokens.cacheWrite)
        + rates.cacheMiss * tokens.uncachedInput
        + rates.output * tokens.output
      return { micro: Math.round(micro), route, label: row.label, card: candidate }
    }
  }
  return null
}

/**
 * Price one settlement.
 *
 * Input is split exactly the way the provider bills it: cache hits at the hit
 * rate, the rest at the miss rate, generated tokens at the output rate. Rates
 * on the card are peak rates; off-peak halves them.
 * @param buckets - `{ uncachedInput, cacheRead, cacheWrite, output }` token counts.
 * @param at - settlement time, epoch ms; decides the tier.
 * @param pricing - normalized pricing.
 * @param model - model id.
 * @param provider - provider id (only DeepSeek routes are priced).
 * @returns `{ micro, peak, card, model, tokens }`; `micro` is null when the
 *   model is outside the rate card and the call is counted as unpriced.
 */
export function priceUsage(buckets, at, pricing = DEFAULT_PRICING, model = '', provider = '') {
  const peak = isPeak(at, pricing)
  const tokens = {
    uncachedInput: Math.max(0, Math.round(Number(buckets?.uncachedInput) || 0)),
    cacheRead: Math.max(0, Math.round(Number(buckets?.cacheRead) || 0)),
    cacheWrite: Math.max(0, Math.round(Number(buckets?.cacheWrite) || 0)),
    output: Math.max(0, Math.round(Number(buckets?.output) || 0)),
  }
  const card = cardForModel(model, pricing)
  // Which money this belongs to. DSH names the *provider*, and an
  // OpenAI-compatible proxy of DeepSeek models still bills the same wallet, so
  // the test is "is this provider on the card", not "does it say deepseek".
  const providerId = String(provider || '').toLowerCase()
  const billed = providerId === '' || (pricing.providers || [pricing.provider]).some((entry) => providerId.includes(entry))
  if (!billed) {
    // Off-card route (Qwen, GLM, …): ledgered and charted, never mixed into
    // the DeepSeek wallet math.
    return { micro: null, peak, card: null, model: String(model || ''), tokens, estimate: estimateUsage(tokens, model, pricing) }
  }
  if (card === null) return { micro: null, peak, card: null, model: String(model || ''), tokens }
  const rates = pricing.models[card]
  const factor = peak ? 1 : pricing.offPeakMultiplier
  // yuan-per-million × tokens × 1e-6 ¥/µ¥ × multiplier, all in integers once
  // the token counts are integers: sum of rate × tokens gives yuan×token
  // micro-units directly (1 rate unit = 1e-6 ¥ per token).
  const micro = rates.cacheHit * tokens.cacheRead
    + rates.cacheMiss * (tokens.uncachedInput + tokens.cacheWrite)
    + rates.output * tokens.output
  return { micro: Math.round(micro * factor), peak, card, model: String(model || ''), tokens }
}

/**
 * Usage from one `assistant/message` (or `assistant/attempt`) event.
 * @param event - session event.
 * @returns `{ usage, model }` or null when the event carries no usage.
 */
export function usageOf(event) {
  if (!event || typeof event !== 'object') return null
  const data = event.data
  if (!data || typeof data !== 'object') return null
  let usage = data.usage
  if (usage === undefined && data.stream && Array.isArray(data.stream.chunks)) {
    for (let index = data.stream.chunks.length - 1; index >= 0; index -= 1) {
      const chunk = data.stream.chunks[index]
      if (chunk && chunk.usage !== undefined) {
        usage = chunk.usage
        break
      }
    }
  }
  if (!usage || typeof usage !== 'object') return null
  const buckets = {
    uncachedInput: Number(usage.inputTokens) || 0,
    output: Number(usage.outputTokens) || 0,
    cacheRead: Number(usage.cacheReadTokens) || 0,
    cacheWrite: Number(usage.cacheWriteTokens) || 0,
  }
  if (buckets.uncachedInput + buckets.output + buckets.cacheRead + buckets.cacheWrite === 0) return null
  // The settlement names its route in `message.source` ({ provider, model });
  // older/other shapes may carry it on the settlement or the usage itself.
  const source = data.message && typeof data.message === 'object' && data.message.source
    ? data.message.source
    : null
  return {
    usage: buckets,
    model: String((source && source.model) || data.model || usage.model || ''),
    provider: String((source && source.provider) || data.provider || ''),
  }
}

/**
 * Turn usage records from an event.
 * @param event - session event.
 * @returns the turn number, or 0 when the event names none.
 */
function turnOf(event) {
  const turn = Number(event && event.data && event.data.turn)
  return Number.isInteger(turn) && turn >= 0 ? turn : 0
}

/**
 * The empty ledger state.
 * @returns a fresh state.
 */
export function emptyLedger() {
  return { version: 1, sessions: {} }
}

/**
 * Fold one committed session event into the ledger.
 *
 * Only the last usage sample of a turn survives: a retried attempt replaces
 * the previous sample instead of adding to it, which is how the provider
 * bills it. The fold never mutates the input state.
 * @param state - ledger state.
 * @param event - session event.
 * @param sessionId - owning session.
 * @param pricing - normalized pricing.
 * @returns the next state (the same object when the event changes nothing).
 */
export function foldEvent(state, event, sessionId, pricing = DEFAULT_PRICING) {
  if (!event || event.type !== 'assistant/message') return state
  const sample = usageOf(event)
  if (sample === null) return state
  const at = Number(event.time) || Date.now()
  const turn = turnOf(event)
  const priced = priceUsage(sample.usage, at, pricing, sample.model, sample.provider)
  const session = state.sessions[sessionId] || { turns: {} }
  const previous = session.turns[turn]
  // A retried attempt settles the same turn again: replace, never add.
  const next = {
    turn,
    at,
    day: dayKey(at),
    peak: priced.peak,
    card: priced.card,
    model: priced.model,
    provider: sample.provider,
    micro: priced.micro,
    // Off-card routes still get an estimate so their spend can be drawn; it
    // never enters the DeepSeek totals.
    estimate: priced.estimate ? priced.estimate.micro : null,
    estimateCard: priced.estimate ? priced.estimate.card : null,
    estimateLabel: priced.estimate ? priced.estimate.label : null,
    tokens: priced.tokens,
  }
  if (previous && previous.at === next.at && previous.micro === next.micro
    && previous.peak === next.peak && previous.card === next.card
    && previous.estimate === next.estimate) return state
  return {
    version: 1,
    sessions: { ...state.sessions, [sessionId]: { turns: { ...session.turns, [turn]: next } } },
  }
}

/**
 * Every turn in the ledger, newest first.
 * @param state - ledger state.
 * @returns `{ sessionId, ...turn }` records.
 */
export function allTurns(state) {
  const out = []
  for (const [sessionId, session] of Object.entries(state.sessions || {})) {
    for (const turn of Object.values(session.turns || {})) out.push({ sessionId, ...turn })
  }
  out.sort((left, right) => right.at - left.at || right.turn - left.turn)
  return out
}

/**
 * The last `days` local day keys, oldest first, ending today.
 * @param now - epoch ms.
 * @param days - window size.
 * @returns day keys.
 */
export function dayWindow(now, days = DEFAULT_DAY_WINDOWS) {
  const keys = []
  const today = new Date(now)
  // Walk local calendar days through noon so a DST shift can never skip or
  // repeat a key; the keys themselves are what the UI labels.
  for (let back = days - 1; back >= 0; back -= 1) {
    keys.push(dayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - back, 12).getTime()))
  }
  return keys
}

/**
 * How many days the current wallet covers at today's burn rate.
 *
 * Today's spend is projected across the whole day when the day is still young
 * (spend so far ÷ elapsed fraction), because a 09:00 reading of ¥2 is not a
 * ¥2-一天 reading. The fraction is capped so the first minutes of a day cannot
 * extrapolate into absurd numbers.
 * @param todayMicro - today's spend so far, µ¥.
 * @param balance - wallet total in yuan; NaN/null when no balance is readable.
 * @param now - epoch ms.
 * @returns `{ days, progress, burnYuan, basis }` or null when it cannot be known.
 */
export function runwayOf(todayMicro, balance, now) {
  if (!(todayMicro > 0) || !(balance > 0)) return null
  const date = new Date(now)
  const elapsed = (date.getHours() * 60 + date.getMinutes() + 1) / (24 * 60)
  const fraction = Math.min(1, Math.max(elapsed, 0.25))
  const dayMicro = todayMicro / fraction
  const days = balance * MICRO / dayMicro
  const progress = Math.min(1, dayMicro / (balance * MICRO))
  return {
    days: Number(days.toFixed(1)),
    progress: Number(progress.toFixed(4)),
    burnYuan: roundYuan(dayMicro),
  }
}

/**
 * Summarize the ledger for the usage tab.
 *
 * Today's spend is the sum of today's turns *actually priced*. The one
 * progress bar is the runway (see {@link runwayOf}) and it only appears when
 * both a wallet and today's spend are known — nothing is configured by hand.
 * @param state - ledger state.
 * @param options - `{ now, days, limit, budget, pricing }`.
 * @returns the usage payload body.
 */
export function summarize(state, options = {}) {
  const now = Number(options.now) || Date.now()
  const days = Math.max(1, Math.min(Number(options.days) || DEFAULT_DAY_WINDOWS, 90))
  const limit = Math.max(1, Math.min(Number(options.limit) || DEFAULT_TURN_LIMIT, 500))
  const pricing = options.pricing || DEFAULT_PRICING
  const turns = allTurns(state)

  const todayKey = dayKey(now)
  const priced = turns.filter((turn) => typeof turn.micro === 'number' && Number.isFinite(turn.micro))
  const unpriced = turns.length - priced.length

  const sumOf = (list) => list.reduce((total, turn) => total + turn.micro, 0)
  const tokensOf = (list) => list.reduce((total, turn) => total + sumTokens(turn.tokens), 0)

  const today = priced.filter((turn) => turn.day === todayKey)
  const todayPeak = today.filter((turn) => turn.peak === true)
  const todayOffPeak = today.filter((turn) => turn.peak !== true)
  const todayUnpriced = turns.filter((turn) => turn.day === todayKey && typeof turn.micro !== 'number')

  const buckets = {}
  for (const key of dayWindow(now, days)) buckets[key] = { micro: 0, estimate: 0, tokens: 0, turns: 0, unpriced: 0, estimated: 0 }
  for (const turn of turns) {
    const bucket = buckets[turn.day]
    if (!bucket) continue
    bucket.turns += 1
    bucket.tokens += sumTokens(turn.tokens)
    if (typeof turn.micro === 'number') bucket.micro += turn.micro
    else if (typeof turn.estimate === 'number') { bucket.estimate += turn.estimate; bucket.estimated += 1 }
    else bucket.unpriced += 1
  }
  const series = Object.entries(buckets).map(([day, value]) => ({
    day,
    yuan: roundYuan(value.micro),
    // Off-card routes: drawn by the chart, never added to the wallet totals.
    estimateYuan: roundYuan(value.estimate),
    estimatedTurns: value.estimated,
    tokens: value.tokens,
    turns: value.turns,
    unpriced: value.unpriced,
  }))

  const todayMicro = sumOf(today)
  const nowPeak = isPeak(now, pricing)
  const windows = parseWindows(pricing.peakWindows).map((window) => ({
    start: formatMinute(window.start),
    end: formatMinute(window.end),
  }))
  const nextChange = nextWindowChange(now, pricing)

  // What today would have cost if every turn had run at the other tier: the
  // practical answer to "would running this later be cheaper?".
  const switchFactor = pricing.offPeakMultiplier > 0 ? 1 / pricing.offPeakMultiplier : 1
  const ifAllPeak = sumOf(todayPeak) + Math.round(sumOf(todayOffPeak) * switchFactor)
  const ifAllOffPeak = Math.round(sumOf(todayPeak) * pricing.offPeakMultiplier) + sumOf(todayOffPeak)
  const savedMicro = Math.max(0, ifAllPeak - todayMicro)

  return {
    ok: true,
    currency: pricing.currency,
    timezone: 'Asia/Shanghai',
    today: {
      day: todayKey,
      yuan: roundYuan(todayMicro),
      turns: today.length,
      tokens: tokensOf(today),
      unpricedTurns: todayUnpriced.length,
      peakYuan: roundYuan(sumOf(todayPeak)),
      offPeakYuan: roundYuan(sumOf(todayOffPeak)),
      savedYuan: roundYuan(savedMicro),
      ifAllOffPeakYuan: roundYuan(ifAllOffPeak),
      // Turns settled today that have no price: an unknown model, or a route
      // that is not DeepSeek. The card says so instead of showing ¥0.00.
      unpricedAll: todayUnpriced.length,
    },
    // The only figure that is a real *fraction* of something: the wallet over
    // what a day costs. Nothing is configured; it appears once there is spend
    // to divide by and a balance to divide into.
    runway: runwayOf(todayMicro, Number(options.balance), now),
    peak: {
      now: nowPeak,
      windows,
      weekdayOnly: pricing.peakWeekdaysOnly === true,
      offPeakMultiplier: pricing.offPeakMultiplier,
      nextChange,
    },
    series,
    turns: {
      total: turns.length,
      unpriced,
      recent: turns.slice(0, limit).map(publicTurn),
      hasMore: turns.length > limit,
    },
  }
}

/** Split one priced turn back into yuan for the payload. */
function publicTurn(turn) {
  return {
    session: String(turn.sessionId || '').slice(0, 12),
    turn: turn.turn,
    at: new Date(turn.at).toISOString(),
    day: turn.day,
    peak: turn.peak === true,
    card: turn.card,
    model: turn.model || '',
    yuan: typeof turn.micro === 'number' ? roundYuan(turn.micro) : null,
    tokens: turn.tokens,
  }
}

/** Total tokens a turn consumed. */
function sumTokens(tokens) {
  if (!tokens || typeof tokens !== 'object') return 0
  return (Number(tokens.uncachedInput) || 0)
    + (Number(tokens.cacheRead) || 0)
    + (Number(tokens.cacheWrite) || 0)
    + (Number(tokens.output) || 0)
}

/** µ¥ → yuan, rounded to six decimals so JSON stays readable. */
function roundYuan(micro) {
  return Number((Math.round(micro) / MICRO).toFixed(6))
}

/** Minute-of-day → `HH:MM`. */
function formatMinute(minute) {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
}

/**
 * When the current tier flips next, in Beijing wall-clock time.
 * @param now - epoch ms.
 * @param pricing - normalized pricing.
 * @returns `{ inMinutes, at }`, or null when no window applies.
 */
export function nextWindowChange(now, pricing = DEFAULT_PRICING) {
  const windows = parseWindows(pricing.peakWindows)
  if (windows.length === 0) return null
  const edges = []
  for (const window of windows) edges.push(window.start, window.end)
  const minute = beijingMinuteOfDay(now)
  const today = [...edges].sort((left, right) => left - right).find((edge) => edge > minute)
  if (today !== undefined) {
    const delta = today - minute
    return { inMinutes: delta, at: formatMinute(today) }
  }
  const tomorrow = Math.min(...edges) + 24 * 60 - minute
  return { inMinutes: tomorrow, at: formatMinute(Math.min(...edges)) }
}

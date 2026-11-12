import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DEFAULT_PRICING,
  cardForModel,
  dayKey,
  dayWindow,
  emptyLedger,
  estimateUsage,
  foldEvent,
  isPeak,
  nextWindowChange,
  normalizePricing,
  parseWindows,
  priceUsage,
  summarize,
  usageOf,
} from '../lib/usage.js'

/** Beijing wall-clock instant as epoch ms (UTC+8, no DST). */
function beijing(year, month, day, hour, minute = 0) {
  return Date.UTC(year, month - 1, day, hour - 8, minute)
}

const WED_PEAK = beijing(2026, 11, 11, 10, 0)
const WED_LUNCH = beijing(2026, 11, 11, 12, 30)
const WED_NIGHT = beijing(2026, 11, 11, 23, 0)
const SATURDAY_NOON = beijing(2026, 11, 14, 12, 0)

const pricing = normalizePricing({})

/** One assistant settlement carrying provider usage. */
function settlement(turn, time, model, usage, provider = 'deepseek-account') {
  return { type: 'assistant/message', time, data: { turn, step: 1, model, provider, usage } }
}

test('the default pricing keeps the published cards and windows', () => {
  assert.deepEqual(pricing.models['deepseek-flash'], { cacheHit: 0.04, cacheMiss: 2, output: 8 })
  assert.deepEqual(pricing.models['deepseek-v4-pro'], { cacheHit: 0.30, cacheMiss: 9, output: 27 })
  assert.deepEqual(pricing.peakWindows, ['09:00-12:00', '14:00-18:00'])
  assert.equal(pricing.offPeakMultiplier, 0.5)
  assert.equal(pricing.peakWeekdaysOnly, true)
  assert.equal(DEFAULT_PRICING.currency, 'CNY')
})

test('a user pricing block overrides one card and keeps the other', () => {
  const custom = normalizePricing({
    models: { 'deepseek-flash': { cacheHit: 0.01, cacheMiss: 1, output: 4 } },
    peakWindows: ['08:00-10:00'],
  })
  assert.deepEqual(custom.models['deepseek-flash'], { cacheHit: 0.01, cacheMiss: 1, output: 4 })
  assert.deepEqual(custom.models['deepseek-v4-pro'], { cacheHit: 0.30, cacheMiss: 9, output: 27 })
  assert.deepEqual(custom.peakWindows, ['08:00-10:00'])
})

test('unusable pricing values fall back instead of pricing at zero', () => {
  const custom = normalizePricing({
    models: { 'deepseek-flash': { cacheHit: 'x', cacheMiss: -1, output: 8 } },
    offPeakMultiplier: 5,
    peakWindows: ['nonsense'],
  })
  assert.deepEqual(custom.models['deepseek-flash'], DEFAULT_PRICING.models['deepseek-flash'])
  assert.equal(custom.offPeakMultiplier, 0.5)
  assert.deepEqual(custom.peakWindows, ['09:00-12:00', '14:00-18:00'])
})

test('peak is Beijing working hours on weekdays only', () => {
  assert.equal(isPeak(WED_PEAK, pricing), true)
  assert.equal(isPeak(beijing(2026, 11, 11, 14, 30), pricing), true)
  assert.equal(isPeak(WED_LUNCH, pricing), false, 'lunch break is off-peak')
  assert.equal(isPeak(beijing(2026, 11, 11, 11, 59), pricing), true)
  assert.equal(isPeak(beijing(2026, 11, 11, 12, 0), pricing), false)
  assert.equal(isPeak(WED_NIGHT, pricing), false)
  assert.equal(isPeak(SATURDAY_NOON, pricing), false, 'weekends are off-peak all day')
})

test('a malformed clock in a window is rejected, not misread', () => {
  // "25:90" used to parse as 25*60+90 = alternates; "07:75" silently became
  // 08:15. Both now fail closed and keep the default schedule.
  assert.deepEqual(parseWindows(['25:90-30:00', '07:75-09:00', '07:00-24:00']), [{ start: 420, end: 1440 }])
  // A start-equals-end window is the documented "all day" spelling.
  assert.deepEqual(normalizePricing({ peakWindows: ['0:00-0:00'] }).peakWindows, ['00:00-00:00'])
})

test('a look-alike model id is not priced by a shorter card name', () => {
  // "deepseek-flashy" is not DeepSeek Flash; mispricing it is worse than the
  // honest "—".
  assert.equal(cardForModel('deepseek-flashy', pricing), null)
  assert.equal(cardForModel('deepseek-flash-preview', pricing), 'deepseek-flash')
  assert.equal(cardForModel('deepseek-v4-pro:free', pricing), 'deepseek-v4-pro')
})

test('windows wrap past midnight and parse defensively', () => {
  const wrapped = normalizePricing({ peakWindows: ['22:00-02:00'] })
  assert.equal(isPeak(beijing(2026, 11, 11, 23, 30), wrapped), true)
  assert.equal(isPeak(beijing(2026, 11, 11, 1, 30), wrapped), true)
  assert.equal(isPeak(beijing(2026, 11, 11, 12, 0), wrapped), false)
  assert.deepEqual(parseWindows(['07:30-09:00', 'bad', '24:30-25:00']), [{ start: 450, end: 540 }])
})

test('the next tier change is the next window edge in Beijing time', () => {
  assert.deepEqual(nextWindowChange(WED_NIGHT, pricing), { inMinutes: 600, at: '09:00' })
  assert.deepEqual(nextWindowChange(beijing(2026, 11, 11, 8, 30), pricing), { inMinutes: 30, at: '09:00' })
  assert.deepEqual(nextWindowChange(WED_LUNCH, pricing), { inMinutes: 90, at: '14:00' })
})

test('model ids resolve to a card with the longest prefix first', () => {
  assert.equal(cardForModel('deepseek-flash', pricing), 'deepseek-flash')
  assert.equal(cardForModel('deepseek-account/deepseek-flash', pricing), 'deepseek-flash')
  assert.equal(cardForModel('deepseek-v4-flash', pricing), 'deepseek-flash')
  assert.equal(cardForModel('deepseek-chat', pricing), 'deepseek-flash')
  assert.equal(cardForModel('deepseek-v4-pro', pricing), 'deepseek-v4-pro')
  assert.equal(cardForModel('deepseek-v4-pro-0813', pricing), 'deepseek-v4-pro')
  assert.equal(cardForModel('gpt-5', pricing), null)
  assert.equal(cardForModel('', pricing), null)
})

test('one call is priced from cache hit, cache miss and output tokens', () => {
  const tokens = { uncachedInput: 1_000_000, cacheRead: 1_000_000, cacheWrite: 0, output: 1_000_000 }
  // Peak flash: 2 + 0.04 + 8 = 10.04 yuan.
  const peak = priceUsage(tokens, WED_PEAK, pricing, 'deepseek-flash', 'deepseek-account')
  assert.equal(peak.micro, 10_040_000)
  assert.equal(peak.peak, true)
  // Off-peak halves every rate: 5.02 yuan.
  const off = priceUsage(tokens, WED_NIGHT, pricing, 'deepseek-flash', 'deepseek-account')
  assert.equal(off.micro, 5_020_000)
  assert.equal(off.peak, false)
  // Pro: 9 + 0.30 + 27 = 36.30 yuan at peak.
  assert.equal(priceUsage(tokens, WED_PEAK, pricing, 'deepseek-v4-pro', 'deepseek').micro, 36_300_000)
})

test('cache writes bill at the miss rate and foreign routes stay unpriced', () => {
  const tokens = { uncachedInput: 0, cacheRead: 0, cacheWrite: 1_000_000, output: 0 }
  assert.equal(priceUsage(tokens, WED_PEAK, pricing, 'deepseek-flash', 'deepseek').micro, 2_000_000)
  const foreign = priceUsage({ ...tokens, uncachedInput: 1000 }, WED_PEAK, pricing, 'gpt-5', 'openai')
  assert.equal(foreign.micro, null)
  assert.equal(foreign.card, null)
  const unpriced = priceUsage(tokens, WED_PEAK, pricing, 'unknown-model', 'deepseek')
  assert.equal(unpriced.micro, null)
})

test('the model and provider come from the settlement source', () => {
  const sample = usageOf({
    type: 'assistant/message',
    data: {
      turn: 3,
      usage: { inputTokens: 100, outputTokens: 20 },
      message: { content: [], source: { provider: 'deepseek-account', model: 'deepseek-flash' } },
    },
  })
  assert.equal(sample.model, 'deepseek-flash')
  assert.equal(sample.provider, 'deepseek-account')
  const topLevel = usageOf({ type: 'assistant/message', data: { model: 'deepseek-v4-pro', usage: { inputTokens: 1 } } })
  assert.equal(topLevel.model, 'deepseek-v4-pro')
})

test('usage is read from a settlement or its last stream chunk', () => {
  const direct = usageOf({ type: 'assistant/message', data: { usage: { inputTokens: 10, outputTokens: 5 } } })
  assert.deepEqual(direct.usage, { uncachedInput: 10, output: 5, cacheRead: 0, cacheWrite: 0 })
  const streamed = usageOf({
    type: 'assistant/message',
    data: { stream: { chunks: [{ usage: { inputTokens: 1 } }, { usage: { inputTokens: 20, outputTokens: 7, cacheReadTokens: 3 } }] } },
  })
  assert.deepEqual(streamed.usage, { uncachedInput: 20, output: 7, cacheRead: 3, cacheWrite: 0 })
  assert.equal(usageOf({ type: 'assistant/message', data: {} }), null)
  assert.equal(usageOf({ type: 'assistant/message', data: { usage: { inputTokens: 0, outputTokens: 0 } } }), null)
  assert.equal(usageOf(null), null)
})

test('a turn folds once and a retried settlement replaces it', () => {
  let state = emptyLedger()
  const first = settlement(1, WED_PEAK, 'deepseek-flash', { inputTokens: 1000, outputTokens: 500 })
  state = foldEvent(state, first, 's1', pricing)
  const afterFirst = state
  const retry = settlement(1, WED_PEAK + 4000, 'deepseek-flash', { inputTokens: 1200, outputTokens: 800 })
  state = foldEvent(state, retry, 's1', pricing)
  assert.equal(state.sessions.s1.turns[1].tokens.uncachedInput, 1200, 'the retry replaced the sample')
  assert.equal(state.sessions.s1.turns[1].tokens.output, 800)
  assert.notEqual(state, afterFirst)
  const summary = summarize(state, { now: WED_PEAK, pricing })
  assert.equal(summary.turns.total, 1, 'one turn, not two')
  // 1200 × 2 + 800 × 8 = 8800 µ¥.
  assert.equal(summary.today.yuan, 0.0088)
})

test('a turn is never double counted when the same settlement arrives twice', () => {
  let state = emptyLedger()
  const event = settlement(3, WED_PEAK, 'deepseek-flash', { inputTokens: 100, outputTokens: 10 })
  state = foldEvent(state, event, 's1', pricing)
  const once = state
  state = foldEvent(state, event, 's1', pricing)
  assert.equal(state, once, 'an idempotent event returns the same state object')
})

test('events without usage or of another type leave the ledger alone', () => {
  let state = emptyLedger()
  assert.equal(foldEvent(state, { type: 'user/message', data: { turn: 1 } }, 's1', pricing), state)
  assert.equal(foldEvent(state, settlement(1, WED_PEAK, 'deepseek-flash', {}), 's1', pricing), state)
  assert.equal(foldEvent(state, null, 's1', pricing), state)
})

test('today mixes priced and unpriced turns without inventing money', () => {
  let state = emptyLedger()
  state = foldEvent(state, settlement(1, WED_PEAK, 'deepseek-flash', { inputTokens: 1_000_000, outputTokens: 0 }), 's1', pricing)
  state = foldEvent(state, settlement(2, WED_PEAK, 'llama-3', { inputTokens: 500, outputTokens: 500 }), 's2', pricing)
  const summary = summarize(state, { now: WED_PEAK + 60_000, pricing })
  assert.equal(summary.today.turns, 1, 'the unpriced turn is not a priced turn')
  assert.equal(summary.today.unpricedTurns, 1)
  assert.equal(summary.today.yuan, 2)
  assert.equal(summary.turns.total, 2)
  assert.equal(summary.turns.unpriced, 1)
  const unpricedTurn = summary.turns.recent.find((turn) => turn.card === null)
  assert.equal(unpricedTurn.yuan, null)
})

test('the runway bar appears only when both a balance and spend are known', () => {
  let state = emptyLedger()
  // 06:00 Beijing: 2 yuan spent at the peak rate so far, before a quarter of
  // the day has elapsed; the 25% floor projects that to 8 yuan for the day.
  state = foldEvent(state, settlement(1, beijing(2026, 11, 11, 6, 0), 'deepseek-flash', { inputTokens: 2_000_000 }), 's1', pricing)
  const at10 = beijing(2026, 11, 11, 2, 30)

  const none = summarize(state, { now: at10, pricing })
  assert.equal(none.runway, null, 'no wallet, no fraction to draw')

  const withBalance = summarize(state, { now: at10, balance: 48, pricing })
  assert.ok(withBalance.runway, 'a wallet plus spend makes a real fraction')
  assert.equal(withBalance.runway.progress, 0.1667, 'an 8 yuan day against a 48 yuan wallet')
  assert.equal(withBalance.runway.days, 6, '48 yuan over an 8 yuan day')
  assert.equal(withBalance.runway.burnYuan, 8, 'today is projected across the whole day')

  const broke = summarize(state, { now: at10, balance: 0, pricing })
  assert.equal(broke.runway, null)

  const quiet = summarize(emptyLedger(), { now: at10, balance: 48, pricing })
  assert.equal(quiet.runway, null, 'no spend means no burn rate to divide by')
})

test('the series always carries the requested number of days, oldest first', () => {
  let state = emptyLedger()
  state = foldEvent(state, settlement(1, WED_PEAK, 'deepseek-flash', { inputTokens: 1000, outputTokens: 100 }), 's1', pricing)
  const summary = summarize(state, { now: WED_PEAK, days: 7, pricing })
  assert.equal(summary.series.length, 7)
  assert.equal(summary.series[6].day, dayKey(WED_PEAK))
  assert.equal(summary.series[6].yuan, 0.0028)
  assert.equal(summary.series[6].turns, 1)
  assert.equal(summary.series[0].turns, 0)
  const days = dayWindow(WED_PEAK, 3)
  assert.equal(days.length, 3)
  assert.equal(days[2], '2026-11-11')
  assert.equal(days[0], '2026-11-09')
})

test('peak and off-peak spend are reported separately with the saving', () => {
  let state = emptyLedger()
  // 1M uncached input at peak: 2 yuan.
  state = foldEvent(state, settlement(1, WED_PEAK, 'deepseek-flash', { inputTokens: 1_000_000 }), 's1', pricing)
  // The same work off-peak: 1 yuan.
  state = foldEvent(state, settlement(2, WED_NIGHT, 'deepseek-flash', { inputTokens: 1_000_000 }), 's1', pricing)
  const summary = summarize(state, { now: WED_NIGHT, pricing })
  assert.equal(summary.today.peakYuan, 2)
  assert.equal(summary.today.offPeakYuan, 1)
  assert.equal(summary.today.savedYuan, 1, 'the peak turn would have cost 1 less at night')
  assert.equal(summary.today.ifAllOffPeakYuan, 2)
  assert.equal(summary.peak.now, false)
  assert.deepEqual(summary.peak.windows, [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '18:00' }])
})

test('recent turns are newest first and limited', () => {
  let state = emptyLedger()
  for (let turn = 1; turn <= 5; turn += 1) {
    state = foldEvent(state, settlement(turn, WED_PEAK + turn * 60_000, 'deepseek-flash', { inputTokens: 1000, outputTokens: 100 }), `s${turn}`, pricing)
  }
  const summary = summarize(state, { now: WED_PEAK + 600_000, limit: 3, pricing })
  assert.equal(summary.turns.recent.length, 3)
  assert.equal(summary.turns.recent[0].turn, 5)
  assert.equal(summary.turns.hasMore, true)
  assert.equal(summary.turns.total, 5)
  assert.equal(summary.turns.recent[0].peak, true)
  assert.match(summary.turns.recent[0].at, /T/)
})

test('a malformed day key never becomes an epoch zero', () => {
  assert.equal(dayKey(Number.NaN), 'NaN-NaN-NaN')
  assert.equal(dayKey(new Date(2026, 10, 11).getTime()), '2026-11-11')
})
test('a DeepSeek model behind another provider is still DeepSeek money', () => {
  // An OpenAI-compatible proxy of DeepSeek models bills the same wallet: the
  // provider is not literally "deepseek", but it is on the card.
  const at = Date.parse('2026-11-11T10:00:00+08:00')
  const tokens = { uncachedInput: 1000, cacheRead: 50000, cacheWrite: 0, output: 2000 }
  const proxied = priceUsage(tokens, at, pricing, 'deepseek-flash', 'deepseek-openai')
  assert.equal(proxied.card, 'deepseek-flash')
  assert.equal(typeof proxied.micro, 'number')
})

test('an off-card route is counted and estimated, never added to the wallet', () => {
  const at = Date.parse('2026-11-11T10:00:00+08:00')
  const tokens = { uncachedInput: 1000, cacheRead: 0, cacheWrite: 0, output: 2000 }
  const qwen = priceUsage(tokens, at, pricing, 'qwen3-max', 'qwen-token-plan-cn')
  assert.equal(qwen.micro, null, 'not DeepSeek money')
  assert.equal(qwen.card, null)
  assert.equal(qwen.estimate.route, 'qwen')
  assert.equal(qwen.estimate.micro, 2.4 * 1000 + 12 * 2000, 'roughest list price, 1e-6 yuan units')

  const free = priceUsage(tokens, at, pricing, 'our-local-model', 'our-free-model')
  assert.equal(free.micro, null)
  assert.equal(free.estimate, null, 'an unknown model gets no invented price')
})

test('the stable DeepSeek name and every dated version share one card', () => {
  // The API keeps one model name per card and retires dated versions behind it:
  // both must price as that card, or a version bump silently loses the money.
  for (const name of ['deepseek-flash', 'deepseek-v4.1-flash', 'deepseek-v4.1-flash-free',
    'DeepSeek-V4.1-Flash-1017', 'deepseek-v4-flash', 'deepseek-v4-flash-vision-exp']) {
    assert.equal(cardForModel(name, pricing), 'deepseek-flash', name)
  }
  for (const name of ['deepseek-v4-pro', 'deepseek-v4.1-pro', 'DeepSeek-V4-Pro-0813']) {
    assert.equal(cardForModel(name, pricing), 'deepseek-v4-pro', name)
  }
  // A longer name that is not a version of the card still gets no price.
  assert.equal(cardForModel('deepseek-flashy', pricing), null)
})

test('vendor models resolve to their family, versions and dated builds included', () => {
  // Vendors version their names rather than renaming the model; a dated suffix
  // shares the family's list price, and the longest family wins.
  const oneMillion = { uncachedInput: 1_000_000, cacheRead: 0, cacheWrite: 0, output: 0 }
  assert.equal(estimateUsage(oneMillion, 'qwen3-max-2025-09-23', pricing).card, 'qwen3-max')
  assert.equal(estimateUsage(oneMillion, 'qwen3-coder-plus', pricing).card, 'qwen3-coder')
  assert.equal(estimateUsage(oneMillion, 'kimi-k2.5-0905', pricing).card, 'kimi-k2')
  assert.equal(estimateUsage(oneMillion, 'glm-4.6-air', pricing).card, 'glm-4.6')
  assert.equal(estimateUsage(oneMillion, 'deepseek-v4.1-flash', pricing), null, 'DeepSeek is carded, not catalogued')
  assert.equal(estimateUsage(oneMillion, 'gpt-5', pricing), null)
})

test('the summary keeps estimates out of today and draws them per day', () => {
  const now = Date.parse('2026-11-11T20:00:00+08:00')
  const qwenTurn = {
    type: 'assistant/message',
    time: Date.parse('2026-11-11T10:00:00+08:00'),
    data: {
      turn: 1,
      message: { content: [], source: { provider: 'qwen-token-plan-cn', model: 'qwen3-max' } },
      usage: { inputTokens: 1000, outputTokens: 2000, cacheReadTokens: 0, cacheWriteTokens: 0 },
    },
  }
  const deepseekTurn = {
    type: 'assistant/message',
    time: Date.parse('2026-11-11T10:05:00+08:00'),
    data: {
      turn: 2,
      message: { content: [], source: { provider: 'deepseek-account', model: 'deepseek-flash' } },
      usage: { inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
    },
  }
  let state = emptyLedger()
  state = foldEvent(state, qwenTurn, 's', pricing)
  state = foldEvent(state, deepseekTurn, 's', pricing)
  const summary = summarize(state, { now, days: 7, pricing, balance: 10 })
  assert.equal(summary.today.yuan, 2, 'peak flash: 1M uncached input costs ¥2')
  const day = summary.series.find((row) => row.day === '2026-11-11')
  assert.equal(day.yuan, 2)
  assert.ok(day.estimateYuan > 0, 'the Qwen day is drawn')
  assert.equal(day.estimatedTurns, 1)
  // One Qwen turn + no DeepSeek turns left unaccounted: the count is the turns
  // the wallet figure does not include.
  assert.equal(summary.today.unpricedAll, 1, 'the card can explain the gap')
  assert.equal(summary.today.yuan, 2)
})

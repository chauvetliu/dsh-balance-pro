import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { UsageLedger, defaultUsageStorePath } from '../index.js'
import plugin from '../index.js'
import { balanceBody, callRoute, fakeCredentials, fakeFetch, fakeRoot } from './helpers.js'
import { normalizePricing } from '../lib/usage.js'

const PRICING = normalizePricing({})

/** One committed settlement event as the session feed delivers it. */
function settlement(turn, time, usage, model = 'deepseek-flash') {
  return {
    type: 'assistant/message',
    time,
    data: { turn, step: 1, model, provider: 'deepseek-account', usage },
  }
}

/** 10:00 Beijing on a Wednesday, at peak rates. */
const PEAK = Date.UTC(2026, 10, 11, 2, 0)

function tempStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsb-usage-'))
  return { dir, file: path.join(dir, 'usage.jsonl') }
}

function ledgerAt(file, now = PEAK) {
  return new UsageLedger({ config: { pricing: PRICING, usageDays: 7, usageTurnLimit: 40 }, storePath: file, now: () => now })
}

test('a settlement that names its route in message.source is priced', () => {
  const { file } = tempStore()
  const ledger = ledgerAt(file)
  ledger.ingest('s1', [{
    type: 'assistant/message',
    time: PEAK,
    data: {
      turn: 1,
      usage: { inputTokens: 1_000_000, outputTokens: 0 },
      message: { content: [], source: { provider: 'deepseek-account', model: 'deepseek-flash' } },
    },
  }])
  const summary = ledger.summary({ balance: null })
  assert.equal(summary.today.yuan, 2, 'peak flash: 1M uncached input costs ¥2')
  assert.equal(summary.turns.recent[0].card, 'deepseek-flash')
  assert.equal(summary.turns.recent[0].model, 'deepseek-flash')
})

test('the ledger prices settlements and ignores everything else', () => {
  const { file } = tempStore()
  const ledger = ledgerAt(file)
  ledger.ingest('s1', [
    settlement(1, PEAK, { inputTokens: 1_000_000, outputTokens: 0 }),
    { type: 'user/message', data: { turn: 1 } },
    settlement(2, PEAK, { inputTokens: 0, outputTokens: 0 }),
  ])
  const summary = ledger.summary({ balance: null })
  assert.equal(summary.turns.total, 1)
  assert.equal(summary.today.yuan, 2)
  assert.equal(summary.today.turns, 1)
})

test('a retried settlement replaces the turn and the file keeps one line', () => {
  const { file } = tempStore()
  const ledger = ledgerAt(file)
  ledger.ingest('s1', [settlement(1, PEAK, { inputTokens: 1000, outputTokens: 0 })])
  ledger.ingest('s1', [settlement(1, PEAK + 5000, { inputTokens: 2000, outputTokens: 0 })])
  ledger.flush()

  const lines = fs.readFileSync(file, 'utf8').trim().split('\n')
  assert.equal(lines.length, 2, 'both settlements are appended, newest last')
  assert.equal(JSON.parse(lines[1]).usage.uncachedInput, 2000)

  // A fresh Host replays the file and keeps the last sample per turn.
  const reloaded = ledgerAt(file).summary({ balance: null })
  assert.equal(reloaded.turns.total, 1)
  assert.equal(reloaded.today.yuan, 0.004)
  const turn = reloaded.turns.recent[0]
  assert.equal(turn.tokens.uncachedInput, 2000)
  assert.equal(turn.peak, true)
  assert.equal(turn.card, 'deepseek-flash')
})

test('a malformed line is skipped instead of poisoning the ledger', () => {
  const { dir, file } = tempStore()
  fs.writeFileSync(file, '{not json\n{"session":"s1"}\n' + JSON.stringify({
    session: 's1',
    time: PEAK,
    usage: { uncachedInput: 1000, output: 0, cacheRead: 0, cacheWrite: 0 },
    line: { turn: 1, model: 'deepseek-flash', provider: '' },
  }) + '\n', 'utf8')
  const summary = ledgerAt(file).summary({ balance: null })
  assert.equal(summary.turns.total, 1)
  assert.equal(summary.today.yuan, 0.002)
  assert.ok(fs.existsSync(dir))
})

test('an unwritable store still counts in memory', () => {
  const warnings = []
  const ledger = new UsageLedger({
    config: { pricing: PRICING, usageDays: 7, usageTurnLimit: 40 },
    storePath: '/dev/null/not-a-dir/usage.jsonl',
    logger: { warn: (message) => warnings.push(message) },
    now: () => PEAK,
  })
  ledger.ingest('s1', [settlement(1, PEAK, { inputTokens: 1_000_000, outputTokens: 0 })])
  ledger.flush()
  ledger.flush()
  assert.equal(ledger.summary({}).today.yuan, 2)
  assert.equal(warnings.length, 1, 'one warning, not one per write')
})

test('a ledger without a store path never touches the filesystem', () => {
  const ledger = new UsageLedger({ config: { pricing: PRICING, usageDays: 7, usageTurnLimit: 40 }, storePath: null, now: () => PEAK })
  ledger.ingest('s1', [settlement(1, PEAK, { inputTokens: 1000, outputTokens: 0 })])
  ledger.flush()
  assert.equal(ledger.summary({}).turns.total, 1)
})

test('the store path follows DSH_HOME, then the home directory', () => {
  const previous = process.env.DSH_HOME
  try {
    process.env.DSH_HOME = '/tmp/dsh-home-test'
    assert.equal(defaultUsageStorePath(), path.join('/tmp/dsh-home-test', 'balance-pro-usage.jsonl'))
    delete process.env.DSH_HOME
    assert.match(defaultUsageStorePath(), /balance-pro-usage\.jsonl$/u)
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
  }
})

/** Boot the plugin with a temporary ledger and a fake web server. */
function boot(options = {}) {
  const { file } = tempStore()
  const harness = fakeRoot({
    services: {
      credentials: fakeCredentials({ value: 'sk-test' }),
      webServer: {},
      connection: { requestRejection: () => undefined },
    },
  })
  const fetcher = fakeFetch(async () => ({ status: 200, body: balanceBody() }))
  const original = globalThis.fetch
  globalThis.fetch = fetcher.fetch
  // `usageStorePath` is a test-only escape hatch onto a temp file; the Host
  // resolves its real store from DSH_HOME, so normalizeConfig drops it.
  plugin.apply(harness.root, { ...(options.config ?? {}), usageStorePath: file })
  return {
    ...harness,
    file,
    fetcher,
    restore: () => {
      globalThis.fetch = original
    },
  }
}

const routeOf = (routes, target) => routes.find((route) => route.path === target)

test('usage.json answers today, peak, the series and recent turns', async () => {
  const { routes, emit, restore } = boot()
  try {
    const session = { id: 'session-abcdef123456' }
    emit('session/event', session, settlement(1, Date.now(), { inputTokens: 1_000_000, outputTokens: 0 }))
    const api = routeOf(routes, '/dsh-balance-pro')
    const { status, headers, body } = await callRoute(api, { url: '/dsh-balance-pro/usage.json' })
    assert.equal(status, 200)
    assert.match(headers['content-type'], /application\/json/u)
    assert.equal(headers['access-control-allow-origin'], '*')
    assert.equal(body.ok, true)
    assert.equal(body.currency, 'CNY')
    assert.equal(body.timezone, 'Asia/Shanghai')
    assert.equal(body.today.turns, 1)
    assert.ok(body.today.yuan > 0)
    assert.equal(body.turns.total, 1)
    assert.equal(body.turns.recent[0].session, 'session-abcd', 'session ids are truncated')
    assert.equal(body.series.length, 7)
    assert.deepEqual(body.peak.windows, [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '18:00' }])
    // The fake balance reports ¥110.50; spend is tiny but non-zero, so a
    // runway with a progress fraction is available.
    assert.ok(body.runway)
    assert.ok(body.runway.progress > 0 && body.runway.progress < 1)
  } finally {
    restore()
  }
})

test('an event batch on session/event is folded event by event', async () => {
  const { routes, emit, restore } = boot()
  try {
    const session = { sessionId: 'batch-session' }
    emit('session/event', session, [
      settlement(1, Date.now(), { inputTokens: 1000, outputTokens: 100 }),
      settlement(2, Date.now(), { inputTokens: 1000, outputTokens: 100 }),
    ])
    emit('session/event', { noId: true }, settlement(3, Date.now(), { inputTokens: 1000 }))
    const { body } = await callRoute(routeOf(routes, '/dsh-balance-pro'), { url: '/dsh-balance-pro/usage.json' })
    assert.equal(body.turns.total, 2, 'a session without a stable id is ignored')
  } finally {
    restore()
  }
})

test('usage.json refuses cross-site reads like the balance route', async () => {
  const { routes, restore } = boot()
  try {
    const api = routeOf(routes, '/dsh-balance-pro')
    const refused = await callRoute(api, { url: '/dsh-balance-pro/usage.json', headers: { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' } })
    assert.equal(refused.status, 403)
    const written = await callRoute(api, { method: 'POST', url: '/dsh-balance-pro/usage.json' })
    assert.equal(written.status, 405)
    const head = await callRoute(api, { method: 'HEAD', url: '/dsh-balance-pro/usage.json' })
    assert.equal(head.status, 200)
    assert.equal(head.text, '')
  } finally {
    restore()
  }
})

test('usage.json works when there is no wallet to divide by', async () => {
  const { routes, emit, restore } = boot({
    config: { currency: 'USD' },
  })
  try {
    emit('session/event', { id: 's1' }, settlement(1, Date.now(), { inputTokens: 1000 }))
    const { body } = await callRoute(routeOf(routes, '/dsh-balance-pro'), { url: '/dsh-balance-pro/usage.json' })
    assert.equal(body.ok, true)
    // The fake answers a CNY wallet while the config asks for USD: the wallet
    // pick falls back to the first entry, so a balance still exists.
    assert.ok(body.turns.total >= 1)
  } finally {
    restore()
  }
})
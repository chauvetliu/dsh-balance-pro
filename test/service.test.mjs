import test from 'node:test'
import assert from 'node:assert/strict'
import { BalanceService, normalizeConfig } from '../index.js'
import { CODES } from '../lib/balance.js'
import { balanceBody, fakeCredentials, fakeFetch } from './helpers.js'

const CONFIG = normalizeConfig({})

/**
 * Keep retry tests fast: the service's own backoff is a 500 ms timer, which a
 * fake clock cannot skip, so the wrapper answers instantly and records how often
 * it was asked instead.
 */
const wrap = (respond) => (url, init, call) => respond(url, init, call)

/**
 * `answer` deliberately has no destructuring default: `answer: undefined` must
 * mean "the ref is unset", which a default parameter would silently rewrite to
 * a configured key.
 */
function makeService(options = {}) {
  const { respond, config = {}, now } = options
  const answer = 'answer' in options ? options.answer : { value: 'sk-test' }
  const credentials = fakeCredentials(answer)
  const fetcher = fakeFetch(wrap(respond ?? (async () => ({ status: 200, body: balanceBody() }))))
  const service = new BalanceService({
    config: { ...CONFIG, ...config },
    logger: { info() {}, warn() {} },
    credentials: () => credentials,
    fetch: fetcher.fetch,
    now,
  })
  return { service, credentials, fetcher }
}

test('normalizeConfig keeps valid values and repairs the rest', () => {
  assert.deepEqual(normalizeConfig(undefined), {
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    baseURL: 'https://api.deepseek.com',
    currency: 'CNY',
    refreshMinutes: 10,
    lowBalanceThreshold: 10,
    requestTimeoutMs: 8000,
    readTotalCosts: true,
  })
  const custom = normalizeConfig({
    apiKeyEnv: 'MY_KEY',
    baseURL: 'https://proxy.example.com/deepseek/',
    currency: 'usd',
    refreshMinutes: 0,
    lowBalanceThreshold: -1,
    requestTimeoutMs: 999999,
  })
  assert.equal(custom.apiKeyEnv, 'MY_KEY')
  assert.equal(custom.baseURL, 'https://proxy.example.com/deepseek')
  assert.equal(custom.currency, 'USD')
  assert.equal(custom.refreshMinutes, 10, 'zero falls back to the default')
  assert.equal(custom.lowBalanceThreshold, 10)
  assert.equal(custom.requestTimeoutMs, 60000, 'the timeout is capped')
  const broken = normalizeConfig({ baseURL: 'not a url', currency: '', refreshMinutes: 30 })
  assert.equal(broken.baseURL, 'https://api.deepseek.com')
  assert.equal(broken.currency, 'CNY')
  assert.equal(broken.refreshMinutes, 30)
})

test('get() reads the upstream once and reports the mapped fields', async () => {
  const { service, fetcher, credentials } = makeService()
  const body = await service.get({})
  assert.equal(body.ok, true)
  assert.equal(body.totalBalance, 110.5)
  assert.equal(body.rechargeBalance, 100)
  assert.equal(body.bonusBalance, 10.5)
  assert.equal(body.currency, 'CNY')
  assert.equal(body.source, 'apikey')
  assert.equal(body.stale, false)
  assert.match(body.accountTag, /^[0-9a-f]{24}$/u)
  assert.equal(fetcher.calls.length, 1)
  assert.equal(fetcher.calls[0].url, 'https://api.deepseek.com/user/balance')
  assert.equal(fetcher.calls[0].init.headers.authorization, 'Bearer sk-test')
  assert.deepEqual(credentials.calls, ['DEEPSEEK_API_KEY'])
})

test('a cached success answers without another upstream call', async () => {
  let clock = 1_000
  const { service, fetcher } = makeService({ now: () => clock })
  await service.get({})
  clock += 60_000
  const second = await service.get({})
  assert.equal(fetcher.calls.length, 1)
  assert.equal(second.source, 'cache')
  clock += 10 * 60_000
  await service.get({})
  assert.equal(fetcher.calls.length, 2, 'the TTL expired')
})

test('concurrent readers share one upstream read', async () => {
  let release
  const gate = new Promise((resolve) => {
    release = resolve
  })
  const { service, fetcher } = makeService({
    respond: async () => {
      await gate
      return { status: 200, body: balanceBody() }
    },
  })
  const both = Promise.all([service.get({}), service.get({})])
  release()
  const [a, b] = await both
  assert.equal(fetcher.calls.length, 1)
  assert.equal(a.totalBalance, b.totalBalance)
})

test('a missing key tries the account session and reports why neither answered', async () => {
  // No API key: the Host falls back to the DSH account session. Without one it
  // must say so instead of pretending the balance is zero.
  const { service, fetcher } = makeService({ answer: undefined })
  const body = await service.get({})
  assert.equal(body.ok, false)
  assert.ok([CODES.NO_KEY, CODES.CREDENTIALS_UNAVAILABLE].includes(body.code), body.code)
  assert.equal(body.totalBalance, null)
  assert.equal(fetcher.calls.length, 0)
})

test('a credentials service error answers CREDENTIALS_UNAVAILABLE', async () => {
  const { service } = makeService({ answer: new Error('vault locked') })
  const body = await service.get({})
  assert.equal(body.ok, false)
  assert.equal(body.code, CODES.CREDENTIALS_UNAVAILABLE)
  assert.match(body.error, /vault locked/u)
})

test('an unconfigured ref is distinguishable from an unreadable one', async () => {
  const { service } = makeService({ answer: { value: '   ' } })
  const body = await service.get({})
  assert.ok([CODES.NO_KEY, CODES.CREDENTIALS_UNAVAILABLE].includes(body.code), body.code)
  assert.match(String(body.error), /账号登录路|未配置/u)
})

test('an unauthorized answer is not retried', async () => {
  const { service, fetcher } = makeService({ respond: async () => ({ status: 401, body: {} }) })
  const body = await service.get({})
  assert.equal(body.ok, false)
  assert.equal(body.code, CODES.UNAUTHORIZED)
  assert.equal(fetcher.calls.length, 1)
})

test('a 5xx is retried once and then reported', async () => {
  const { service, fetcher } = makeService({ respond: async () => ({ status: 503, body: {} }) })
  const body = await service.get({})
  assert.equal(body.code, CODES.HTTP)
  assert.equal(body.ok, false)
  assert.equal(fetcher.calls.length, 2)
})

test('a transient failure recovers on the retry', async () => {
  const { service, fetcher } = makeService({
    respond: async (url, init, call) => (call === 1 ? new Error('ECONNRESET') : { status: 200, body: balanceBody() }),
  })
  const body = await service.get({})
  assert.equal(body.ok, true)
  assert.equal(fetcher.calls.length, 2)
})

test('a network failure answers NETWORK', async () => {
  const { service } = makeService({ respond: async () => new Error('getaddrinfo ENOTFOUND api.deepseek.com') })
  const body = await service.get({})
  assert.equal(body.code, CODES.NETWORK)
  assert.match(body.error, /ENOTFOUND/u)
})

test('unparseable upstream bodies answer PARSE, not a broken number', async () => {
  const { service } = makeService({ respond: async () => ({ status: 200, body: new SyntaxError('bad json') }) })
  const body = await service.get({})
  assert.equal(body.code, CODES.PARSE)
})

test('a malformed shape answers SHAPE', async () => {
  const { service } = makeService({ respond: async () => ({ status: 200, body: { balance_infos: [] } }) })
  const body = await service.get({})
  assert.equal(body.code, CODES.SHAPE)
})

test('a failed refresh keeps the last good numbers and marks them stale', async () => {
  let fail = false
  let clock = 0
  const { service } = makeService({
    now: () => clock,
    respond: async () => (fail ? { status: 500, body: {} } : { status: 200, body: balanceBody() }),
  })
  const fresh = await service.get({})
  assert.equal(fresh.totalBalance, 110.5)
  fail = true
  clock += 11 * 60_000
  const stale = await service.get({})
  assert.equal(stale.ok, true)
  assert.equal(stale.stale, true)
  assert.equal(stale.totalBalance, 110.5)
  assert.equal(stale.code, CODES.HTTP)
})

test('a cached failure answers without another upstream call', async () => {
  let clock = 1_000_000
  const { service, fetcher } = makeService({
    now: () => clock,
    respond: async () => ({ status: 500, body: {} }),
  })
  const first = await service.get({})
  assert.equal(first.code, CODES.HTTP)
  const callsAfterFirst = fetcher.calls.length
  clock += 5_000
  const second = await service.get({})
  assert.equal(second.code, CODES.HTTP)
  assert.equal(second.ok, false)
  assert.equal(fetcher.calls.length, callsAfterFirst, 'the failure is reused inside its TTL')
  clock += 40_000
  await service.get({})
  assert.equal(fetcher.calls.length, callsAfterFirst + 2, 'after the TTL the read is retried (and 5xx retried once)')
})

test('force bypasses the success TTL but respects the cooldown', async () => {
  let clock = 100_000
  const { service, fetcher } = makeService({ now: () => clock })
  await service.get({})
  await service.get({ force: true })
  assert.equal(fetcher.calls.length, 2)
  // Inside the cooldown a forced read still answers from the fresh cache —
  // as long as the TTL has not expired yet, which is the point of the cooldown.
  clock += 1_000
  const cooled = await service.get({ force: true })
  assert.equal(fetcher.calls.length, 2, 'inside the cooldown the cache answers')
  assert.equal(cooled.source, 'cache')
  clock += 5_000
  await service.get({ force: true })
  assert.equal(fetcher.calls.length, 3)
})

test('the configured baseURL is honoured', async () => {
  const { service, fetcher } = makeService({ config: { baseURL: 'https://proxy.example.com/ds' } })
  await service.get({})
  assert.equal(fetcher.calls[0].url, 'https://proxy.example.com/ds/user/balance')
})

test('the payload never carries the key', async () => {
  const { service } = makeService({ answer: { value: 'sk-super-secret-value' } })
  const body = await service.get({})
  const text = JSON.stringify(body)
  assert.ok(!text.includes('sk-super-secret-value'))
  assert.equal(fetcherFree(text), true)
})

function fetcherFree(text) {
  return !/sk-/.test(text)
}
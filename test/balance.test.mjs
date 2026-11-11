import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CODES, balanceError, httpError, payload, pickWallet, readBalance, readCredential, redact, toAmount, transportError,
} from '../lib/balance.js'

test('toAmount reads decimal strings and rejects everything unreadable', () => {
  assert.equal(toAmount('110.50'), 110.5)
  assert.equal(toAmount('0'), 0)
  assert.equal(toAmount(0), 0)
  assert.equal(toAmount('-1.25'), -1.25)
  assert.equal(toAmount(''), null)
  assert.equal(toAmount('   '), null)
  assert.equal(toAmount(null), null)
  assert.equal(toAmount(undefined), null)
  assert.equal(toAmount('abc'), null)
  assert.equal(toAmount('Infinity'), null)
  assert.equal(toAmount({}), null)
  assert.equal(toAmount(true), null)
})

test('pickWallet prefers the configured currency, then the first entry', () => {
  const wallets = [
    { currency: 'USD', total_balance: '1' },
    { currency: 'CNY', total_balance: '2' },
  ]
  assert.equal(pickWallet(wallets, 'CNY').total_balance, '2')
  assert.equal(pickWallet(wallets, 'cny').total_balance, '2')
  assert.equal(pickWallet(wallets, 'EUR').total_balance, '1')
  assert.equal(pickWallet([], 'CNY'), undefined)
  assert.equal(pickWallet(undefined, 'CNY'), undefined)
  assert.equal(pickWallet(['nope', { currency: 'JPY', total_balance: '3' }], 'CNY').currency, 'JPY')
})

test('readBalance maps the documented upstream shape', () => {
  const fields = readBalance({
    is_available: true,
    balance_infos: [{ currency: 'CNY', total_balance: '110.50', granted_balance: '10.50', topped_up_balance: '100.00' }],
  })
  assert.deepEqual(fields, {
    totalBalance: 110.5,
    rechargeBalance: 100,
    bonusBalance: 10.5,
    currency: 'CNY',
    isAvailable: true,
  })
})

test('readBalance keeps unreadable components as null instead of inventing 0', () => {
  const fields = readBalance({
    balance_infos: [{ currency: 'cny', total_balance: '5', granted_balance: 'n/a' }],
  })
  assert.equal(fields.rechargeBalance, null)
  assert.equal(fields.bonusBalance, null)
  assert.equal(fields.currency, 'CNY')
  assert.equal(fields.isAvailable, null)
})

test('readBalance rejects malformed bodies with SHAPE', () => {
  for (const body of [null, [], 'text', 42, {}, { balance_infos: [] }, { balance_infos: [{ total_balance: 'x' }] }]) {
    assert.throws(() => readBalance(body), (error) => error.code === CODES.SHAPE, `body ${JSON.stringify(body)}`)
  }
})

test('httpError separates auth, rate limit and retryable failures', () => {
  const unauthorized = httpError(401)
  assert.equal(unauthorized.code, CODES.UNAUTHORIZED)
  assert.equal(unauthorized.status, 401)
  assert.equal(unauthorized.transient, false)
  assert.equal(httpError(403).code, CODES.UNAUTHORIZED)
  assert.equal(httpError(429).code, CODES.RATE_LIMITED)
  assert.equal(httpError(429).transient, true)
  assert.equal(httpError(503).code, CODES.HTTP)
  assert.equal(httpError(503).transient, true)
  assert.equal(httpError(400).transient, false)
})

test('transportError names timeouts and network failures', () => {
  const timeout = transportError(Object.assign(new Error('timed out'), { name: 'TimeoutError' }))
  assert.equal(timeout.code, CODES.TIMEOUT)
  assert.equal(timeout.transient, true)
  const error = new Error('fetch failed')
  error.cause = { code: 'ENOTFOUND' }
  const network = transportError(error)
  assert.equal(network.code, CODES.NETWORK)
  assert.match(network.message, /ENOTFOUND/u)
})

test('readCredential distinguishes unset from a service that answered', () => {
  assert.equal(readCredential(undefined), '')
  assert.equal(readCredential(null), '')
  assert.equal(readCredential({ value: '  sk-abc  ' }), 'sk-abc')
  assert.equal(readCredential({ value: '' }), '')
  assert.equal(readCredential('sk-raw'), 'sk-raw')
  assert.throws(() => readCredential({ value: 42 }), (error) => error.code === CODES.CREDENTIALS_UNAVAILABLE)
})

test('redact never lets a key or a Bearer phrase through', () => {
  const text = redact('failed with Authorization: Bearer sk-1234567890abcdef because sk-abcdef123456 expired')
  assert.ok(!text.includes('sk-1234567890abcdef'))
  assert.ok(!text.includes('sk-abcdef123456'))
  assert.match(text, /Bearer <redacted>/u)
  assert.ok(redact('x'.repeat(500)).length <= 201)
})

test('payload drops balance fields on failure and keeps the contract keys', () => {
  const ok = payload({
    ok: true,
    fields: { totalBalance: 1.5, rechargeBalance: 1, bonusBalance: 0.5, currency: 'CNY', isAvailable: true },
    accountTag: 'abc',
    lowBalanceThreshold: 10,
    refreshMinutes: 10,
    fetchedAt: 0,
  })
  assert.equal(ok.ok, true)
  assert.equal(ok.totalBalance, 1.5)
  assert.equal(ok.source, 'apikey')
  assert.equal(ok.updatedAt, new Date(0).toISOString())
  assert.equal('code' in ok, false)

  const failed = payload({
    ok: false,
    fields: null,
    error: balanceError(CODES.NO_KEY, 'no key'),
    lowBalanceThreshold: 10,
    refreshMinutes: 10,
  })
  assert.equal(failed.ok, false)
  assert.equal(failed.totalBalance, null)
  assert.equal(failed.code, CODES.NO_KEY)
  assert.equal(failed.error, 'no key')
})
import test from 'node:test'
import assert from 'node:assert/strict'
import { admission, isLoopbackHostname } from '../lib/request.js'

// Spread headers last: a top-level spread after `headers` would replace the
// whole object, not merge into it.
const req = (overrides = {}) => ({
  ...overrides,
  method: overrides.method ?? 'GET',
  headers: { host: '127.0.0.1:58148', ...overrides.headers },
})

test('isLoopbackHostname accepts only this machine', () => {
  for (const host of ['127.0.0.1', '127.5.6.7', 'localhost', 'app.localhost', '::1', '[::1]']) {
    assert.equal(isLoopbackHostname(host), true, host)
  }
  for (const host of ['', 'example.com', '127.0.0.1.evil.com', '128.0.0.1', 'localhost.evil.com.evil.org', '10.0.0.1', '[::2]']) {
    assert.equal(isLoopbackHostname(host), false, host)
  }
})

test('admission admits a same-origin loopback GET', () => {
  assert.equal(admission(req()), null)
  assert.equal(admission(req({ headers: { host: 'localhost:58148', 'sec-fetch-site': 'same-origin', origin: 'http://localhost:58148' } })), null)
})

test('admission refuses cross-site origins, foreign origins and non-loopback hosts', () => {
  assert.equal(admission(req({ headers: { 'sec-fetch-site': 'cross-site', origin: 'https://evil.example' } })), 403)
  assert.equal(admission(req({ headers: { 'sec-fetch-site': 'cross-site', origin: 'null' } })), 403)
  assert.equal(admission(req({ headers: { origin: 'null' } })), null, 'an opaque origin alone is not compared')
  // No Origin at all: a local tool or the desktop shell's own script.
  assert.equal(admission(req({ headers: { 'sec-fetch-site': 'cross-site' } })), null)
  assert.equal(admission(req({ headers: { host: '' } })), 403)
  assert.equal(admission(req({ headers: { host: '0.0.0.0:58148' } })), 403)
  assert.equal(admission(req({ headers: { host: '192.168.1.20:58148' } })), 403)
})

test('cross-origin readers admitted are the desktop page and loopback pages', () => {
  // dsh-app://app is the shell's own page; a loopback page on another port is a
  // dsh web window or the desktop shell served over http. Both are this machine.
  assert.equal(admission(req({ headers: { origin: 'dsh-app://app', 'sec-fetch-site': 'cross-site' } })), null)
  assert.equal(admission(req({ headers: { origin: 'http://127.0.0.1:57566', 'sec-fetch-site': 'same-site' } })), null)
  assert.equal(admission(req({ headers: { origin: 'http://localhost:3000' } })), null)
  // Everything else stays out, whatever the fetch metadata says.
  assert.equal(admission(req({ headers: { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' } })), 403)
  assert.equal(admission(req({ headers: { origin: 'https://evil.example' } })), 403)
  assert.equal(admission(req({ headers: { origin: 'http://192.168.1.20:8080' } })), 403)
})

test('admission trusts explicitly listed authorities only when the Host fence is absent', () => {
  const remote = req({ headers: { host: 'box.lan:58148' } })
  assert.equal(admission(remote, { trustedHosts: ['box.lan'] }), null)
  assert.equal(admission(remote, { trustedHosts: ['box.lan:58148'] }), null)
  assert.equal(admission(remote, { trustedHosts: ['other.lan'] }), 403)
  // With a fence present the authority does not bypass it: the fence has seen no
  // trusted-host declaration, so it rejects and this module honours the verdict.
  const fence = { requestRejection: () => 401 }
  assert.equal(admission(remote, { connection: fence, trustedHosts: ['box.lan'] }), 401)
})

test('admission honours the Host fence and fails closed when it throws', () => {
  const allow = { requestRejection: () => undefined }
  assert.equal(admission(req(), { connection: allow }), null)
  const deny = { requestRejection: () => 401 }
  assert.equal(admission(req(), { connection: deny }), 401)
  const throwing = {
    requestRejection: () => {
      throw new Error('boom')
    },
  }
  assert.equal(admission(req(), { connection: throwing }), 403)
})

test('admission refuses writes and unsupported methods', () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    assert.equal(admission(req({ method })), 405, method)
  }
  assert.equal(admission(req({ method: 'HEAD' })), null)
  // OPTIONS reaches the route only to become a CORS preflight answer; the route
  // never reads the balance for it (the handler answers 204 first).
  assert.equal(admission(req({ method: 'OPTIONS' })), null)
})
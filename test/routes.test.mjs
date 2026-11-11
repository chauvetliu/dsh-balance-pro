import test from 'node:test'
import assert from 'node:assert/strict'
import { callRoute, fakeCredentials, fakeFetch, fakeRoot, balanceBody } from './helpers.js'
import plugin from '../index.js'
import { CODES } from '../lib/balance.js'

const SERVICES = () => ({
  credentials: fakeCredentials({ value: 'sk-test' }),
  webServer: {},
  connection: { requestRejection: () => undefined },
})

/** Apply the plugin against the doubles; the fetch double stays installed. */
function boot(options = {}) {
  return bootWithFetch(options)
}

/** Apply with the fetch double kept installed for the lifetime of the routes. */
function bootWithFetch(options = {}) {
  const harness = fakeRoot({ services: { ...SERVICES(), ...(options.services ?? {}) } })
  const fetcher = fakeFetch(options.respond ?? (async () => ({ status: 200, body: balanceBody() })))
  const original = globalThis.fetch
  globalThis.fetch = fetcher.fetch
  plugin.apply(harness.root, options.config)
  return {
    ...harness,
    fetcher,
    restore: () => {
      globalThis.fetch = original
    },
  }
}

const routeOf = (routes, path) => routes.find((route) => route.path === path)

test('the desktop index row table is left untouched (the module graph owns delivery)', () => {
  // An injected row would load the module bundle a second time as a classic
  // script; in the desktop page the graph row is the only delivery path that
  // survives (see index.js), so the plugin contributes no row at all.
  const { emit } = boot()
  const table = []
  emit('webserver/index-inject', table)
  assert.deepEqual(table, [])
})

test('the exact script route serves client.js (styles travel in the bundle)', async () => {
  const { routes } = boot()
  const script = await callRoute(routeOf(routes, '/dsh-balance-pro/client.js'), { url: '/dsh-balance-pro/client.js' })
  assert.equal(script.status, 200)
  assert.match(script.headers['content-type'], /application\/javascript/u)
  assert.equal(script.headers['cache-control'], 'no-store')
  assert.match(script.text, /__ModuleLoader__/u)

  // No stylesheet route: the pill injects its own <style> from the bundle.
  assert.equal(routeOf(routes, '/dsh-balance-pro/client.css'), undefined)
  assert.match(script.text, /\.dsb-pill/u, 'the bundle carries the styles')
})

test('the static routes refuse cross-site and write requests', async () => {
  const { routes } = boot()
  const route = routeOf(routes, '/dsh-balance-pro/client.js')
  const cross = await callRoute(route, { headers: { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' } })
  assert.equal(cross.status, 403)
  const write = await callRoute(route, { method: 'POST' })
  assert.equal(write.status, 405)
})

test('balance.json answers the mapped payload', async () => {
  const { routes, restore, fetcher } = bootWithFetch()
  try {
    const api = routeOf(routes, '/dsh-balance-pro')
    assert.equal(api.kind, 'prefix')
    const { status, body, headers } = await callRoute(api, { url: '/dsh-balance-pro/balance.json' })
    assert.equal(status, 200)
    assert.equal(headers['cache-control'], 'no-store')
    assert.equal(body.ok, true)
    assert.equal(body.totalBalance, 110.5)
    assert.equal(body.lowBalanceThreshold, 10)
    assert.ok(!JSON.stringify(body).includes('sk-test'))
    assert.ok(fetcher.calls.length >= 1)
  } finally {
    restore()
  }
})

test('balance.json reports a missing key as a 200 with a code', async () => {
  const { routes, restore } = bootWithFetch({
    services: { credentials: fakeCredentials(undefined) },
  })
  try {
    const api = routeOf(routes, '/dsh-balance-pro')
    const { status, body } = await callRoute(api, { url: '/dsh-balance-pro/balance.json' })
    assert.equal(status, 200)
    assert.equal(body.ok, false)
    // No key on this Host: the answer names the key and the account session.
    assert.ok([CODES.NO_KEY, CODES.CREDENTIALS_UNAVAILABLE].includes(body.code), body.code)
  } finally {
    restore()
  }
})

test('the balance route is CORS-readable from the desktop page origin', async () => {
  // dsh-app://app reads 127.0.0.1:<port>: without Access-Control-Allow-Origin
  // Chrome delivers the request and discards the response.
  const { routes, restore } = bootWithFetch()
  try {
    const api = routeOf(routes, '/dsh-balance-pro')
    const preflight = await callRoute(api, { method: 'OPTIONS', url: '/dsh-balance-pro/balance.json', headers: { origin: 'dsh-app://app' } })
    assert.equal(preflight.status, 204)
    assert.equal(preflight.headers['access-control-allow-origin'], '*')
    assert.match(preflight.headers['access-control-allow-methods'], /GET/u)

    const read = await callRoute(api, { url: '/dsh-balance-pro/balance.json', headers: { origin: 'dsh-app://app' } })
    assert.equal(read.status, 200)
    assert.equal(read.headers['access-control-allow-origin'], '*')
    assert.equal(read.body.ok, true)
  } finally {
    restore()
  }
})

test('unknown sub-paths answer 404 and HEAD answers headers only', async () => {
  const { routes, restore } = bootWithFetch()
  try {
    const api = routeOf(routes, '/dsh-balance-pro')
    const missing = await callRoute(api, { url: '/dsh-balance-pro/nope' })
    assert.equal(missing.status, 404)
    assert.equal(missing.body.code, 'NOT_FOUND')
    const head = await callRoute(api, { url: '/dsh-balance-pro/balance.json?x=1', method: 'HEAD' })
    assert.equal(head.status, 200)
    assert.equal(head.text, '')
  } finally {
    restore()
  }
})

test('force=1 reaches the service and a cooldown keeps the next click on the cache', async () => {
  const { routes, restore, fetcher } = bootWithFetch()
  try {
    const api = routeOf(routes, '/dsh-balance-pro')
    await callRoute(api, { url: '/dsh-balance-pro/balance.json' })
    const afterFirst = fetcher.calls.length
    const forced = await callRoute(api, { url: '/dsh-balance-pro/balance.json?force=1' })
    assert.equal(forced.body.ok, true)
    // The forced read happened unless the clock says the cooldown is still warm.
    assert.ok(fetcher.calls.length >= afterFirst)
    const again = await callRoute(api, { url: '/dsh-balance-pro/balance.json?force=1' })
    assert.equal(again.body.source, 'cache')
  } finally {
    restore()
  }
})

test('a request from a foreign origin never reaches the balance', async () => {
  const { routes, restore, fetcher } = bootWithFetch()
  try {
    const api = routeOf(routes, '/dsh-balance-pro')
    const bounded = await callRoute(api, { url: '/dsh-balance-pro/balance.json' })
    assert.equal(bounded.status, 200)
    const before = fetcher.calls.length
    const cross = await callRoute(api, {
      url: '/dsh-balance-pro/balance.json',
      headers: { origin: 'https://evil.example' },
    })
    assert.equal(cross.status, 403)
    assert.equal(cross.body.code, 'FORBIDDEN')
    assert.equal(fetcher.calls.length, before, 'a refused request must not touch the upstream')
  } finally {
    restore()
  }
})

test('a composition without a connection fence still serves loopback requests', async () => {
  const { routes, restore } = bootWithFetch({ services: { connection: undefined } })
  try {
    const api = routeOf(routes, '/dsh-balance-pro')
    const ok = await callRoute(api, { url: '/dsh-balance-pro/balance.json' })
    assert.equal(ok.status, 200)
    const remote = await callRoute(api, {
      url: '/dsh-balance-pro/balance.json',
      headers: { host: '192.168.1.9:58148' },
    })
    assert.equal(remote.status, 403)
  } finally {
    restore()
  }
})

test('a Host fence verdict wins over the plugin fallback', async () => {
  const { routes, restore } = bootWithFetch({
    services: { connection: { requestRejection: () => 401 } },
  })
  try {
    const api = routeOf(routes, '/dsh-balance-pro')
    const answer = await callRoute(api, { url: '/dsh-balance-pro/balance.json' })
    assert.equal(answer.status, 401)
  } finally {
    restore()
  }
})

test('the plugin exports the shape cordis needs and mounts its routes', () => {
  assert.equal(plugin.name, 'dsh-balance-pro')
  assert.equal(typeof plugin.apply, 'function')
  const { routes, injected } = boot()
  assert.deepEqual(injected.map((entry) => entry.deps), [['webServer']])
  assert.deepEqual(routes.map((route) => route.path).sort(), [
    '/dsh-balance-pro',
    '/dsh-balance-pro/client.js',
    // The client-modules row URL: the desktop page fetches the bundle from
    // here, and this exact route fills in the Host's loopback origin.
    '/plugins/dsh-balance-pro/client.js',
  ])
})

test('the config patch layer is applied (currency, threshold, refresh)', async () => {
  const { routes, restore } = bootWithFetch({
    config: { currency: 'usd', lowBalanceThreshold: 0.5, refreshMinutes: 3 },
    respond: async () => ({
      status: 200,
      body: {
        is_available: true,
        balance_infos: [
          { currency: 'USD', total_balance: '0.25', granted_balance: '0.25', topped_up_balance: '0' },
        ],
      },
    }),
  })
  try {
    const api = routeOf(routes, '/dsh-balance-pro')
    const { body } = await callRoute(api, { url: '/dsh-balance-pro/balance.json' })
    assert.equal(body.currency, 'USD')
    assert.equal(body.totalBalance, 0.25)
    assert.equal(body.lowBalanceThreshold, 0.5)
    assert.equal(body.refreshMinutes, 3)
  } finally {
    restore()
  }
})
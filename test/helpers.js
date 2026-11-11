/**
 * Test doubles for the Host half: a fake credentials service, a fake fetch that
 * records calls, and an in-memory cordis context that records route handlers so
 * the tests can drive them with plain `{ method, url, headers }` objects.
 */

/** A `credentials` service whose resolve() answers what the test asks. */
export function fakeCredentials(answer, options = {}) {
  const calls = []
  return {
    calls,
    resolve(ref) {
      calls.push(ref)
      if (answer instanceof Error) return Promise.reject(answer)
      if (typeof answer === 'function') return Promise.resolve(answer(ref))
      return Promise.resolve(answer)
    },
  }
}

/** A fetch double; `respond(url, init)` answers `{ status, body }` or throws. */
export function fakeFetch(respond) {
  const calls = []
  const fetch = async (url, init) => {
    calls.push({ url, init })
    const answer = await respond(url, init, calls.length)
    if (answer instanceof Error) throw answer
    if (answer.raw !== undefined) return answer.raw
    return {
      ok: answer.status >= 200 && answer.status < 300,
      status: answer.status,
      async json() {
        if (answer.body instanceof Error) throw answer.body
        if (typeof answer.body === 'string') return JSON.parse(answer.body)
        return answer.body
      },
    }
  }
  return { fetch, calls }
}

/** A balance body shaped like the DeepSeek endpoint's. */
export function balanceBody(overrides = {}) {
  return {
    is_available: true,
    balance_infos: [
      {
        currency: 'CNY',
        total_balance: '110.50',
        granted_balance: '10.50',
        topped_up_balance: '100.00',
      },
    ],
    ...overrides,
  }
}

/** Cords the plugin's apply() sees: effect/on/inject/get, recording everything. */
export function fakeRoot(options = {}) {
  const listeners = new Map()
  const effects = []
  const injected = []
  const services = new Map(Object.entries(options.services ?? {}))
  const routes = []
  const logs = []
  const root = {
    logger: {
      info: (message) => logs.push(['info', message]),
      warn: (message) => logs.push(['warn', message]),
      error: (message) => logs.push(['error', message]),
    },
    on(name, listener) {
      const list = listeners.get(name) ?? []
      list.push(listener)
      listeners.set(name, list)
      return () => {
        const at = list.indexOf(listener)
        if (at !== -1) list.splice(at, 1)
      }
    },
    effect(factory, label) {
      effects.push({ dispose: factory(), label })
      return () => {}
    },
    inject(deps, callback) {
      injected.push({ deps, callback })
      // Run immediately with the services the test supplied.
      callback(makeScopedContext(services, routes))
    },
    get(name) {
      return services.get(name)
    },
  }
  return {
    root,
    logs,
    routes,
    injected,
    effects,
    emit(name, ...args) {
      for (const listener of listeners.get(name) ?? []) listener(...args)
    },
    listeners,
  }
}

function makeScopedContext(services, routes) {
  const scope = {
    get: (name) => services.get(name),
    effect(factory) {
      factory()
      return () => {}
    },
    webServer: {
      register(route) {
        routes.push(route)
        return () => {
          const at = routes.indexOf(route)
          if (at !== -1) routes.splice(at, 1)
        }
      },
    },
  }
  return scope
}

/**
 * Drive one recorded route handler with a fake exchange.
 * @param route - the registered route.
 * @param request - `{ method, url, headers }`; defaults to a loopback browser GET.
 * @returns `{ status, headers, body }` with the body parsed as JSON when possible.
 */
export async function callRoute(route, request = {}) {
  const req = {
    method: request.method ?? 'GET',
    url: request.url ?? '/',
    headers: { host: '127.0.0.1:58148', 'sec-fetch-site': 'same-origin', ...request.headers },
  }
  let status = 0
  let headers = {}
  let text = ''
  const res = {
    headersSent: false,
    writeHead(code, extra = {}) {
      status = code
      headers = extra
      this.headersSent = true
    },
    end(body) {
      if (body !== undefined && body !== null) text += String(body)
    },
  }
  await route.handler(req, res)
  let body = text
  try {
    body = JSON.parse(text)
  } catch {
    /* not JSON (script, css, plain text) */
  }
  return { status, headers, body, text }
}

/** A promise-flattening sleep stand-in for the service's internal backoff. */
export const noWait = () => Promise.resolve()
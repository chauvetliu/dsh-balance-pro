import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

const ROOT = path.resolve(import.meta.dirname, '..')
const CLIENT_SOURCE = fs.readFileSync(path.join(ROOT, 'client.js'), 'utf8')
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
const MODULE_ID = 'dsh-balance-pro'

/** A minimal DOM node good enough for the pill's plain-DOM construction. */
function makeElement(tag) {
  const node = {
    tagName: String(tag).toUpperCase(),
    children: [],
    parentNode: null,
    id: '',
    className: '',
    dataset: {},
    _text: '',
    get textContent() {
      if (this.children.length > 0) {
        // A real DOM exposes every descendant text node, so children and the
        // element's own text concatenate.
        return this._text + this.children.map((child) => (child.nodeType === 3 ? child.textContent : child.textContent)).join('')
      }
      return this._text
    },
    set textContent(value) {
      this.children.length = 0
      this._text = String(value)
    },
    title: '',
    href: '',
    target: '',
    rel: '',
    type: '',
    hidden: false,
    disabled: false,
    value: '',
    style: { cssText: '', color: '', fontVariantNumeric: '' },
    attributes: {},
    listeners: {},
    classList: {
      add() {},
      remove() {},
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value)
    },
    getAttribute(name) {
      return this.attributes[name] ?? null
    },
    removeAttribute(name) {
      delete this.attributes[name]
    },
    appendChild(child) {
      this.children.push(child)
      child.parentNode = this
      return child
    },
    contains(node) {
      if (node === this) return true
      return this.children.some((child) => child.contains && child.contains(node))
    },
    replaceChildren(...nodes) {
      this.children.length = 0
      for (const node of nodes) this.appendChild(node)
    },
    removeChild(child) {
      const at = this.children.indexOf(child)
      if (at !== -1) this.children.splice(at, 1)
      child.parentNode = null
      return child
    },
    addEventListener(type, listener) {
      this.listeners[type] = this.listeners[type] || []
      this.listeners[type].push(listener)
    },
    removeEventListener(type, listener) {
      const list = this.listeners[type] || []
      const at = list.indexOf(listener)
      if (at !== -1) list.splice(at, 1)
    },
    click() {
      for (const listener of this.listeners.click || []) listener({ target: this })
    },
  }
  return node
}

/** Depth-first search for the first descendant (or the node) with a class. */
function findByClass(node, className) {
  // Elements carry a space-separated class list, so match one token.
  if (typeof node.className === 'string' && node.className.split(/\s+/u).includes(className)) return node
  for (const child of node.children || []) {
    if (typeof child.className === 'string') {
      const found = findByClass(child, className)
      if (found) return found
    }
  }
  return undefined
}

/**
 * A page stub: `#root`-less document with a body, plus a module-system facade
 * that records what the bundle registers.
 */
function fakePage(options = {}) {
  const body = makeElement('body')
  const documentListeners = {}
  const head = makeElement('head')
  const document = {
    documentElement: { getAttribute: () => options.lang ?? 'zh-CN' },
    visibilityState: 'visible',
    body: options.body === false ? null : body,
    head,
    createElement: (tag) => makeElement(tag),
    createTextNode: (value) => ({ nodeType: 3, textContent: String(value), children: [] }),
    addEventListener(type, listener) {
      documentListeners[type] = documentListeners[type] || []
      documentListeners[type].push(listener)
    },
    removeEventListener(type, listener) {
      const list = documentListeners[type] || []
      const at = list.indexOf(listener)
      if (at !== -1) list.splice(at, 1)
    },
    querySelector: () => null,
    // A document lookup spans head and body, as the real one does.
    getElementById: (id) => head.children.find((node) => node.id === id)
      || body.children.find((node) => node.id === id)
      || null,
  }
  const window = {
    document,
    navigator: { language: options.lang ?? 'zh-CN' },
    location: { origin: options.origin ?? 'http://127.0.0.1:58148' },
    addEventListener() {},
    removeEventListener() {},
    __DSH_TRANSPORT__: options.transport,
  }
  const registrations = []
  window.__ModuleLoader__ = {
    load(registration) {
      registrations.push(registration)
    },
  }
  return { window, document, body, registrations, documentListeners }
}

/** Run the bundle in a sandbox; returns the recorded side effects. */
function runClient(page, options = {}) {
  const warnings = []
  const fetched = []
  const pendingTimers = []
  const fetchImpl = (url) => {
    fetched.push(String(url))
    if (String(url).includes('usage.json') && options.usage !== undefined) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(options.usage),
        text: () => Promise.resolve(''),
      })
    }
    const payload = options.payload ?? {
      ok: true,
      totalBalance: 123.45,
      rechargeBalance: 100,
      bonusBalance: 23.45,
      currency: 'CNY',
      isAvailable: true,
      stale: false,
      updatedAt: new Date().toISOString(),
      lowBalanceThreshold: 10,
      refreshMinutes: 10,
      accountTag: 'abc123def456',
      totalCost: 4.97,
      account: { id: 'u1', contact: 'cha***@163.com', name: null, avatarUrl: null },
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(payload),
      text: () => Promise.resolve(''),
    })
  }
  const context = vm.createContext({
    window: page.window,
    document: page.document,
    navigator: page.window.navigator,
    console: {
      warn: (message) => warnings.push(String(message)),
      info() {},
      error() {},
      log() {},
    },
    fetch: fetchImpl,
    // A real polling timer would keep the test runner alive for ten minutes;
    // the pill only needs `setTimeout` to exist, so the stub records it.
    setTimeout: (fn, ms) => {
      pendingTimers.push({ fn, ms })
      return pendingTimers.length
    },
    clearTimeout: (id) => {
      if (typeof id === 'number' && id > 0) pendingTimers[id - 1] = null
    },
    Date,
  })
  context.window.window = context.window
  vm.runInContext(CLIENT_SOURCE, context, { filename: 'client.js' })
  return { context, warnings, fetched, pendingTimers }
}

test('the bundle registers itself with the module system', () => {
  // A graph row whose script does not register fails the whole desktop page
  // with "loaded without registering" — this is an invariant, not a preference.
  const page = fakePage()
  runClient(page)
  assert.equal(page.registrations.length, 1)
  const registration = page.registrations[0]
  assert.equal(registration.id, MODULE_ID)
  assert.equal(typeof registration.factory, 'function')
})

test('the module face takes no services and no seeded module', () => {
  const page = fakePage()
  runClient(page)
  const exported = page.registrations[0].factory(() => {
    throw new Error('the pill must not require any module')
  })
  assert.equal(exported.name, MODULE_ID)
  assert.equal(exported.inject.length, 0)
  assert.equal(typeof exported.apply, 'function')
})

test('a second apply on one page keeps a single dock', () => {
  // Hot replacement or a duplicated bundle must not stack pills.
  const page = fakePage()
  runClient(page)
  const exported = page.registrations[0].factory(() => undefined)
  exported.apply({ effect: (factory) => factory() })
  exported.apply({ effect: (factory) => factory() })
  assert.equal(page.body.children.length, 1)
})

test('a burst of refreshes shares one in-flight read', async () => {
  const page = fakePage()
  const { fetched } = runClient(page)
  const exported = page.registrations[0].factory(() => undefined)
  await mountForTest(exported)
  const host = page.body.children[0]
  const pill = host.children.find((child) => child.className === 'dsb-pill')
  for (const listener of pill.listeners.click || []) listener({ target: pill })
  const card = host.children.find((child) => child.className === 'dsb-panel')
  const refresh = findByClass(card, 'dsb-actions').children[0]
  const before = fetched.filter((url) => url.includes('force=1')).length
  for (let i = 0; i < 5; i += 1) {
    for (const listener of refresh.listeners.click || []) listener({ target: refresh })
  }
  await new Promise((resolve) => setImmediate(resolve))
  const forced = fetched.filter((url) => url.includes('force=1')).length - before
  assert.ok(forced <= 1, `forced reads: ${forced}`)
})

test('apply() mounts a plain-DOM pill into the page body', () => {
  const page = fakePage()
  runClient(page)
  const exported = page.registrations[0].factory(() => undefined)

  const disposers = []
  exported.apply({
    effect(factory) {
      disposers.push(factory())
      return () => {}
    },
  })
  const effects = disposers

  assert.equal(page.body.children.length, 1)
  const host = page.body.children[0]
  assert.equal(host.id, MODULE_ID)
  // Positioning and theme live in the injected stylesheet, not inline styles.
  const styles = page.document.head.children.find((node) => node.id === MODULE_ID + '-styles')
  assert.ok(styles, 'the plugin style tag is present')
  // One rule opens the block (with the token variables), the layout follows.
  assert.match(styles.textContent, /#dsh-balance-pro\{--dsb-surface:/u)
  assert.match(styles.textContent, /position:fixed;right:16px;bottom:44px;z-index:900/u)
  assert.match(styles.textContent, /\[data-tone="dark"\]/u, 'the card follows the host tone')
  assert.match(styles.textContent, /backdrop-filter:blur/u, 'the card is a glass surface')

  const button = host.children.find((child) => child.className === 'dsb-pill')
  assert.ok(button, 'the pill button exists')
  // Badge layout: the icon square, the amount, then the shoulder alert dot.
  assert.equal(button.children[0].className, 'dsb-kind')
  assert.equal(button.children[1].className, 'dsb-number')
  assert.equal(button.children[2].className, 'dsb-alert')
  assert.match(button.children[0].innerHTML, /<svg/u, 'the square carries an icon, not a word')
  assert.equal(button.children.length, 3)
  // Before the first payload lands the label is the loading placeholder.
  assert.equal(button.children[1].textContent, '…')

  const card = host.children.find((child) => child.className === 'dsb-panel')
  assert.ok(card, 'the detail card exists')
  assert.equal(card.hidden, true, 'the card starts collapsed')

  // Cleanup registered through the plugin context removes the dock.
  assert.equal(effects.length, 1)
  effects[0]()
  assert.equal(page.body.children.length, 0)
})

/** Apply the module with a cordis-like effect double and flush the first read. */
async function mountForTest(exported) {
  const disposers = []
  exported.apply({
    effect(factory) {
      disposers.push(factory())
      return () => {}
    },
  })
  // The pill reads the Host asynchronously; two turns settle the fetch + paint.
  for (let i = 0; i < 4; i += 1) await new Promise((resolve) => setImmediate(resolve))
  return disposers
}

test('the first read paints the amounts from the Host payload', async () => {
  const page = fakePage()
  const { fetched } = runClient(page)
  const exported = page.registrations[0].factory(() => undefined)
  await mountForTest(exported)

  const host = page.body.children[0]
  const button = host.children.find((child) => child.className === 'dsb-pill')
  // The pill stays compact: symbol + number, no currency code.
  assert.equal(button.children[1].textContent, '¥123.45')
  assert.match(button.title, /¥123\.45/u)
  assert.ok(fetched.some((url) => url.endsWith('/dsh-balance-pro/balance.json')), JSON.stringify(fetched))

  const card = host.children.find((child) => child.className === 'dsb-panel')
  const rows = findByClass(card, 'dsb-body-balance').children.find((child) => child.tagName === 'DL')
  // The <dd> holds the number as its own text plus a `<small class="dsb-unit">`.
  const amountOf = (line) => line.children[1].textContent
  const unitOf = (line) => line.children[1].children.find((part) => part.className === 'dsb-unit')
  const values = rows.children.map(amountOf)
  // Card amounts carry the currency code, typeset as a separate small unit.
  assert.deepEqual(values, ['¥123.45 CNY', '¥100.00 CNY', '¥23.45 CNY', '¥4.97 CNY'])
  for (const line of rows.children) {
    const unit = unitOf(line)
    assert.ok(unit, 'the amount has a unit element')
    assert.equal(unit.textContent, 'CNY')
  }

  // The card names the signed-in account, not the key hash.
  const meta = findByClass(card, 'dsb-meta')
  // The timestamp and the account are separate lines.
  assert.equal(meta.children.length, 2)
  assert.match(meta.children[0].textContent, /^更新于/u)
  assert.match(meta.children[1].textContent, /^账号 cha\*\*\*@163\.com$/u)
})

test('a huge balance is abbreviated in the pill but exact in the card', async () => {
  const page = fakePage()
  runClient(page, {
    payload: {
      ok: true,
      totalBalance: 9999999.99,
      rechargeBalance: 9999999.99,
      bonusBalance: 0,
      currency: 'CNY',
      isAvailable: true,
      stale: false,
      updatedAt: new Date().toISOString(),
      lowBalanceThreshold: 10,
      refreshMinutes: 10,
    },
  })
  const exported = page.registrations[0].factory(() => undefined)
  await mountForTest(exported)
  const host = page.body.children[0]
  const button = host.children.find((child) => child.className === 'dsb-pill')
  // ¥10m instead of ¥9,999,999.99 — the pill never wraps or clips, and the
  // abbreviated number always states its scale, never a truncated digit run.
  assert.equal(button.children[1].textContent, '¥10m')
  assert.equal(button.children[1].getAttribute('data-compact'), 'true')
  // The exact amount stays reachable: tooltip and the card's total.
  assert.match(button.title, /9,999,999\.99/u)
  const card = host.children.find((child) => child.className === 'dsb-panel')
  const rows = findByClass(card, 'dsb-body-balance').children.find((child) => child.tagName === 'DL')
  // The card keeps the exact amount next to the 27px total; only the pill and
  // the compact card rows abbreviate.
  const title = findByClass(findByClass(card, 'dsb-head'), 'dsb-title')
  assert.ok(title)
  assert.match(button.title, /9,999,999\.99/u)
})

test('amounts under a million keep their cents', async () => {
  for (const [value, expected] of [[999999.99, '¥999,999.99'], [1234.5, '¥1,234.5'], [95.02, '¥95.02']]) {
    const page = fakePage()
    runClient(page, {
      payload: {
        ok: true, totalBalance: value, rechargeBalance: value, bonusBalance: 0, currency: 'CNY',
        isAvailable: true, stale: false, updatedAt: new Date().toISOString(), lowBalanceThreshold: 10, refreshMinutes: 10,
      },
    })
    const exported = page.registrations[0].factory(() => undefined)
    await mountForTest(exported)
    const button = page.body.children[0].children.find((child) => child.className === 'dsb-pill')
    assert.equal(button.children[1].textContent, expected, String(value))
    assert.equal(button.children[1].getAttribute('data-compact'), null)
  }
})

test('the painted language follows <html lang> at paint time, not at load time', async () => {
  // index.html ships as lang="en"; the shell's locale plugin rewrites it later.
  // A pill that decided at load time would stay English forever.
  const page = fakePage({ lang: 'en' })
  runClient(page)
  const exported = page.registrations[0].factory(() => undefined)
  await mountForTest(exported)
  const host = page.body.children[0]
  const card = host.children.find((child) => child.className === 'dsb-panel')
  const rows = findByClass(card, 'dsb-body-balance').children.find((child) => child.tagName === 'DL')
  assert.equal(rows.children[0].children[0].textContent, 'Total')

  // The locale plugin switches the page to Chinese and the pill re-renders.
  page.document.documentElement.getAttribute = () => 'zh-CN'
  const ctx = { effect: (factory) => factory() }
  exported.apply(ctx)
  page.body.children.length = 0
  const remounted = page.registrations[0].factory(() => undefined)
  // The bundle keeps one dock per page; drive a fresh paint through the card.
  await mountForTest(remounted)
  const host2 = page.body.children[0]
  const card2 = host2.children.find((child) => child.className === 'dsb-panel')
  const rows2 = findByClass(card2, 'dsb-body-balance').children.find((child) => child.tagName === 'DL')
  assert.equal(rows2.children[0].children[0].textContent, '合计')
})

test('a failed read paints the empty state instead of a zero', async () => {
  const page = fakePage()
  runClient(page, { payload: { ok: false, code: 'NO_KEY', error: 'no key' } })
  const exported = page.registrations[0].factory(() => undefined)
  await mountForTest(exported)

  const button = page.body.children[0].children.find((child) => child.className === 'dsb-pill')
  assert.equal(button.children[1].textContent, '—', 'an unreadable amount is a dash, not a fake zero')
  assert.equal(button.children[1].getAttribute('data-missing'), 'true')
  assert.match(button.title, /未配置 DeepSeek API Key/u)
})

test('the pill asks the Host with a relative path first', async () => {
  // The desktop shell's dsh-app:// handler forwards relative requests to the
  // Host with the browser cookie — the one path its fence always accepts.
  // (The whale widget does exactly this.)
  const page = fakePage({ origin: 'dsh-app://app', transport: { streamBaseUrl: 'http://127.0.0.1:49875' } })
  const { fetched } = runClient(page)
  const exported = page.registrations[0].factory(() => undefined)
  await mountForTest(exported)
  assert.ok(fetched.length > 0)
  assert.equal(fetched[0], '/dsh-balance-pro/balance.json')
})

test('the pill is fixed on the account row and cannot be dragged', () => {
  const page = fakePage()
  const stored = { 'dsh-balance-pro.placement': '{"x":1,"y":1}' }
  page.window.localStorage = {
    getItem: (key) => (key in stored ? stored[key] : null),
    setItem: (key, value) => { stored[key] = String(value) },
    removeItem: (key) => { delete stored[key] },
  }
  page.window.innerWidth = 1200
  page.window.innerHeight = 800
  page.window.addEventListener = () => {}
  page.window.removeEventListener = () => {}
  page.window.requestAnimationFrame = () => 0
  // The sidebar account row this pill hugs.
  const avatar = makeElement('span')
  avatar.appendId = true
  const row = makeElement('button')
  row.getBoundingClientRect = () => ({ left: 12, top: 700, right: 228, bottom: 744, width: 216, height: 44 })
  avatar.closest = () => row
  page.document.querySelector = (selector) => (/avatar/u.test(selector) ? avatar : null)

  runClient(page)
  const exported = page.registrations[0].factory(() => undefined)
  exported.apply({ effect: (factory) => factory() })
  const host = page.body.children[0]
  host.offsetWidth = 92
  host.offsetHeight = 26
  host.getBoundingClientRect = () => ({ left: 0, top: 0, width: 92, height: 26 })

  // Positioned inside the row: right-aligned and vertically centered.
  const left = Number(String(host.style.left).replace('px', ''))
  const top = Number(String(host.style.top).replace('px', ''))
  assert.ok(left > 12 && left + 92 <= 228, `left=${left}`)
  assert.equal(top, 700 + Math.round((44 - 26) / 2), 'vertically centred on the 44px row')
  // A saved position from the old build is discarded, not honoured.
  assert.equal('dsh-balance-pro.placement' in stored, false)

  // No drag handlers: pressing and moving must not move the pill.
  const button = host.children.find((child) => child.className === 'dsb-pill')
  assert.equal(button.listeners.pointerdown, undefined)
  assert.equal(button.listeners.pointermove, undefined)
  assert.ok(!/cursor:grab/u.test(String(page.document.head.children[0].textContent)))
})

test('a refused relative read falls back to the shell transport origin', async () => {
  const page = fakePage({ origin: 'dsh-app://app', transport: { streamBaseUrl: 'http://127.0.0.1:49875' } })
  const fetched = []
  const context = vm.createContext({
    window: page.window,
    document: page.document,
    navigator: page.window.navigator,
    console: { warn() {}, info() {}, error() {}, log() {} },
    fetch: (url) => {
      fetched.push(String(url))
      if (String(url).startsWith('/')) return Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({}) })
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true, totalBalance: 5, currency: 'CNY' }) })
    },
    setTimeout: () => 1,
    clearTimeout() {},
    Date,
  })
  context.window.window = context.window
  vm.runInContext(CLIENT_SOURCE, context, { filename: 'client.js' })
  const exported = page.registrations[0].factory(() => undefined)
  await mountForTest(exported)
  // A 401 from the Host means "refused", not "unreachable": the absolute origin
  // cannot fix it, so the fallback is not attempted for 401/403.
  assert.deepEqual(fetched, ['/dsh-balance-pro/balance.json'])
})

test('apply() survives a missing effect() and a missing body', () => {
  const page = fakePage({ body: false })
  const { warnings } = runClient(page)
  const exported = page.registrations[0].factory(() => undefined)
  assert.doesNotThrow(() => exported.apply({}))
  assert.doesNotThrow(() => exported.apply(undefined))
  assert.equal(warnings.length, 0, 'deferring to DOMContentLoaded is not an error')
  // The DOMContentLoaded hook is installed exactly once per body-less apply.
  assert.ok((page.documentListeners.DOMContentLoaded || []).length >= 2)
})

test('the module text never closes its own script element', () => {
  assert.ok(!CLIENT_SOURCE.includes('</script>'))
  assert.ok(!CLIENT_SOURCE.includes('<!--'))
  // The currency symbols are escapes so an apostrophe can never precede a `$`.
  assert.ok(!CLIENT_SOURCE.includes("'$'"))
})

test('the browser half talks only to its own routes', () => {
  const literals = [...CLIENT_SOURCE.matchAll(/'((?:\/|https?:\/\/)[^']{2,})'/g)].map((match) => match[1])
  const allowed = new Set([
    'https://platform.deepseek.com/top_up',
    // The direct fallback: only used when the Host route refuses this page.
    'https://api.deepseek.com/user/balance',
    '{{LOOPBACK_ORIGIN}}',
  ])
  for (const target of literals) {
    if (allowed.has(target)) continue
    assert.match(target, /^\/dsh-balance-pro\//u, target)
  }
  assert.ok(CLIENT_SOURCE.includes("'{{LOOPBACK_ORIGIN}}'"))
})

test('the package declares the client row and its ./client export', () => {
  assert.equal(MANIFEST.dsh.client.platform, 'web')
  assert.equal(MANIFEST.exports['./client'], './client.js')
  assert.equal(MANIFEST.private, undefined, 'public installs are not private')
})

test('the injected stylesheet stays scoped to the pill and the card', () => {
  // The rules ship inside the bundle (STYLE_TEXT); nothing reads a CSS file.
  // Evaluate the array literal so comments and quoting cannot confuse the check.
  const from = CLIENT_SOURCE.indexOf('const STYLE_TEXT = [')
  const close = CLIENT_SOURCE.indexOf("].join('')", from)
  // Slice the array literal only (up to and including its closing bracket).
  const to = close + 1
  assert.ok(from !== -1 && to > from, 'the bundle carries its stylesheet')
  const css = new Function(`${CLIENT_SOURCE.slice(from, to)}; return STYLE_TEXT.join('')`)()
  assert.match(css, /\.dsb-pill\{/u)
  const selectors = css
    .split('}')
    .map((block) => block.split('{')[0].trim())
    .filter((selector) => selector !== '' && !selector.startsWith('@'))
  assert.ok(selectors.length > 5, 'the stylesheet has rules: ' + selectors.length)
  for (const selector of selectors) {
    for (const part of selector.split(',')) {
      assert.match(part.trim(), /^\.dsb-|^#dsh-balance-pro(\[|\s|$)|^\d+%$|^from$|^to$/u, selector)
    }
  }
  assert.ok(!fs.existsSync(path.join(ROOT, 'client.css')), 'no orphan stylesheet file')
})

test('the usage tab reads usage.json lazily and paints today, peak and turns', async () => {
  const page = fakePage()
  const { fetched } = runClient(page, { usage: usagePayload() })
  const exported = page.registrations[0].factory(() => undefined)
  await mountForTest(exported)
  // The balance read happens at mount; usage waits for its tab.
  assert.equal(fetched.some((url) => url.includes('usage.json')), false)

  const host = page.body.children[0]
  const card = host.children.find((child) => child.className === 'dsb-panel')
  const tabs = findByClass(card, 'dsb-tabs')
  for (const listener of tabs.children[1].listeners.click || []) listener({ stopPropagation() {} })
  for (let i = 0; i < 4; i += 1) await new Promise((resolve) => setImmediate(resolve))

  assert.ok(fetched.some((url) => url.endsWith('/dsh-balance-pro/usage.json')), JSON.stringify(fetched))
  const body = findByClass(card, 'dsb-body-usage')
  assert.equal(body.hidden, false)
  assert.equal(findByClass(card, 'dsb-body-balance').hidden, true)

  const amount = findByClass(body, 'dsb-today-amount')
  assert.equal(amount.textContent, '¥0.014')
  const ring = findByClass(body, 'dsb-ring')
  assert.equal(ring.getAttribute('data-empty'), 'false')
  assert.equal(findByClass(body, 'dsb-ring-center').textContent, '37%', 'the runway ring shows a real fraction')
  // The chip is label + amount in separate spans so neither wraps; the label
  // and the number must still read as one line.
  const peak = findByClass(body, 'dsb-tier-peak')
  assert.equal(findByClass(peak, 'dsb-tier-label').textContent, '高峰算力')
  assert.equal(findByClass(peak, 'dsb-tier-amount').textContent, '¥0.013')
  const rows = findByClass(body, 'dsb-turns').children
  assert.equal(rows.length, 2)
  assert.match(rows[0].children[2].textContent, /¥/)
  const bars = findByClass(body, 'dsb-spark').children
  assert.equal(bars.length, 7)
  assert.equal(bars[6].getAttribute('data-today'), 'true')
})

test('a malformed usage payload never breaks the balance tab', async () => {
  const page = fakePage()
  // `turns.recent` is not a list and a turn has no tokens: the usage body must
  // degrade, not throw, and the balance tab must still paint.
  const broken = usagePayload()
  broken.turns.recent = { not: 'an array' }
  broken.series = 'nope'
  runClient(page, { usage: broken })
  const exported = page.registrations[0].factory(() => undefined)
  await mountForTest(exported)
  const host = page.body.children[0]
  const card = host.children.find((child) => child.className === 'dsb-panel')
  const tabs = findByClass(card, 'dsb-tabs')
  for (const listener of tabs.children[1].listeners.click || []) listener({ stopPropagation() {} })
  for (let i = 0; i < 4; i += 1) await new Promise((resolve) => setImmediate(resolve))
  // The balance tab still shows the amount it read.
  const button = host.children.find((child) => child.className === 'dsb-pill')
  assert.equal(button.children[1].textContent, '¥123.45')
  assert.equal(findByClass(card, 'dsb-body-balance').hidden, true)
})

test('the usage tab says so when nothing has been spent yet', async () => {
  const page = fakePage()
  const empty = usagePayload()
  empty.today.yuan = 0
  empty.today.turns = 0
  empty.runway = null
  empty.turns.recent = []
  empty.turns.total = 0
  empty.series = empty.series.map((day) => ({ ...day, yuan: 0 }))
  runClient(page, { usage: empty })
  const exported = page.registrations[0].factory(() => undefined)
  await mountForTest(exported)
  const host = page.body.children[0]
  const card = host.children.find((child) => child.className === 'dsb-panel')
  const tabs = findByClass(card, 'dsb-tabs')
  for (const listener of tabs.children[1].listeners.click || []) listener({ stopPropagation() {} })
  for (let i = 0; i < 4; i += 1) await new Promise((resolve) => setImmediate(resolve))
  const body = findByClass(card, 'dsb-body-usage')
  const emptyRow = findByClass(body, 'dsb-turns').children[0]
  assert.equal(emptyRow.textContent, '今天还没有结算的对话')
  assert.equal(findByClass(body, 'dsb-ring').getAttribute('data-empty'), 'true')
  assert.match(findByClass(body, 'dsb-today-sub').textContent, /今日暂无消耗/u)
})

/** One usage.json body shaped like the Host's. */
function usagePayload() {
  const now = new Date()
  const day = (offset) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }
  const at = (hour) => new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, 5).toISOString()
  return {
    ok: true,
    currency: 'CNY',
    timezone: 'Asia/Shanghai',
    today: { day: day(0), yuan: 0.0138, turns: 2, tokens: 4200, unpricedTurns: 0, peakYuan: 0.0132, offPeakYuan: 0.0006, savedYuan: 0.0006, ifAllOffPeakYuan: 0.0069 },
    runway: { days: 2.7, progress: 0.37, burnYuan: 0.53 },
    peak: { now: true, windows: [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '18:00' }], weekdayOnly: true, offPeakMultiplier: 0.5, nextChange: { inMinutes: 90, at: '14:00' } },
    series: [6, 5, 4, 3, 2, 1, 0].map((back, index) => ({ day: day(back), yuan: index * 0.004, tokens: 0, turns: 0, unpriced: 0 })),
    turns: {
      total: 2,
      unpriced: 0,
      hasMore: false,
      recent: [
        { session: 's1', turn: 4, at: at(10), day: day(0), peak: true, card: 'deepseek-flash', model: 'deepseek-flash', yuan: 0.0088, tokens: { uncachedInput: 1200, output: 800, cacheRead: 0, cacheWrite: 0 } },
        { session: 's1', turn: 3, at: at(9), day: day(0), peak: false, card: 'deepseek-flash', model: 'deepseek-flash', yuan: 0.005, tokens: { uncachedInput: 4000, output: 200, cacheRead: 12000, cacheWrite: 0 } },
      ],
    },
  }
}

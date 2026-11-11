/**
 * dsh-balance-pro — browser half.
 *
 * A self-mounting pill built from plain DOM. Two constraints shaped it:
 *
 * 1. Registration is mandatory. client-modules loads this file for the package's
 *    graph row and reports a script that finishes without
 *    `window.__ModuleLoader__.load({ id, factory })` as "loaded without
 *    registering", which fails the whole page with `1 entry did not activate`.
 * 2. No dependency and no service may be assumed. This composition provides
 *    neither the `slots` service (a plugin that injects it stays PENDING, also a
 *    fatal boot error) nor a guaranteed module seed through the factory's
 *    `require`. So the pill paints itself with `document.createElement` and
 *    reads `require` only as an optimisation — never as a requirement.
 *
 * The Host substitutes `{{LOOPBACK_ORIGIN}}` when it serves this file: the
 * desktop page runs on dsh-app://app and cannot resolve a relative API path.
 */
window.__ModuleLoader__.load({
  id: 'dsh-balance-pro',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports

    const MODULE_ID = 'dsh-balance-pro'
    const LOG = '[dsh-balance-pro]'
    const LOOPBACK_ORIGIN = '{{LOOPBACK_ORIGIN}}'
    const API_PATH = '/dsh-balance-pro/balance.json'
    const DEFAULT_CURRENCY = 'CNY'
    const DEFAULT_LOW_BALANCE = 10
    const DEFAULT_REFRESH_MINUTES = 10

    /** Status surface for debugging from the devtools console. */
    const status = { mounted: false, error: null, reads: 0 }
    try {
      window.__dshBalanceProStatus = status
    } catch (error) {
      /* a frozen window object only costs the diagnostic */
    }

    const DICT = {
      zh: {
        label: 'DeepSeek 余额',
        spend: '累计消费',
        empty: '余额 —',
        total: '合计',
        recharge: '充值余额',
        bonus: '赠送余额',
        account: '账号',
        updated: '更新于',
        loading: '正在读取…',
        stale: '上次读取失败，显示的是缓存值',
        toppedUp: '账户可用余额为 0',
        refresh: '刷新',
        topUp: '去充值',
        justNow: '刚刚',
        minutesAgo: '{n} 分钟前',
        hoursAgo: '{n} 小时前',
        daysAgo: '{n} 天前',
        'code.NO_KEY': '未配置 DeepSeek API Key',
        'code.CREDENTIALS_UNAVAILABLE': '凭据服务不可用',
        'code.UNAUTHORIZED': 'API Key 无效或已过期',
        'code.RATE_LIMITED': '余额接口限流，稍后自动重试',
        'code.TIMEOUT': '余额接口请求超时',
        'code.NETWORK': '无法连接余额接口',
        'code.HTTP': '余额接口出错',
        'code.PARSE': '余额接口返回了无法解析的内容',
        'code.SHAPE': '余额接口返回结构异常',
      },
      en: {
        label: 'DeepSeek balance',
        empty: 'Balance —',
        total: 'Total',
        recharge: 'Topped up',
        bonus: 'Granted',
        account: 'Account',
        updated: 'Updated',
        loading: 'Reading…',
        stale: 'Last read failed; showing a cached value',
        toppedUp: 'Available balance is 0',
        refresh: 'Refresh',
        topUp: 'Top up',
        justNow: 'just now',
        minutesAgo: '{n} min ago',
        hoursAgo: '{n} h ago',
        daysAgo: '{n} d ago',
        spend: 'Total spent',
        'code.NO_KEY': 'DeepSeek API key not configured',
        'code.CREDENTIALS_UNAVAILABLE': 'Credentials service unavailable',
        'code.UNAUTHORIZED': 'API key rejected or expired',
        'code.RATE_LIMITED': 'Balance API rate limited; retrying later',
        'code.TIMEOUT': 'Balance API timed out',
        'code.NETWORK': 'Cannot reach the balance API',
        'code.HTTP': 'Balance API failed',
        'code.PARSE': 'Balance API answered unparseable content',
        'code.SHAPE': 'Balance API answered an unexpected shape',
      },
    }

    /**
     * Stylesheet for the pill and the card.
     *
     * Fetched from the Host on first mount and injected as a plugin-owned
     * `<style>` tag. Colours come from the shell's own design tokens when it
     * exposes them (`--dsw-*`, with `--dsh-*` as the older spelling) and fall
     * back to system colours, so the card follows the app's light/dark theme
     * without a stylesheet at all.
     */
    const STYLE_TEXT = [
      // The pill sits on the app surface, so it borrows that surface's colour
      // tokens when the shell defines them; the system colours are the fallback.
      '@keyframes dsb-in{from{opacity:0;transform:translateY(4px) scale(.985)}to{opacity:1;transform:none}}',
      '@keyframes dsb-pulse{0%,100%{opacity:.35}50%{opacity:1}}',
      '@keyframes dsb-spin{to{transform:rotate(360deg)}}',
      '#dsh-balance-pro{',
      '--dsb-surface:var(--dsw-surface,var(--dsh-surface,var(--dsw-bg-elevated,var(--dsh-bg-elevated,#ffffff))));',
      '--dsb-text:var(--dsw-text,var(--dsh-text,var(--dsw-text-primary,#17171c)));',
      '--dsb-muted:var(--dsw-text-muted,var(--dsh-text-muted,var(--dsw-text-secondary,color-mix(in srgb,var(--dsb-text) 62%,var(--dsb-surface)))));',
      '--dsb-faint:var(--dsw-text-faint,var(--dsh-text-faint,var(--dsw-text-tertiary,color-mix(in srgb,var(--dsb-text) 42%,var(--dsb-surface)))));',
      '--dsb-line:var(--dsw-border,var(--dsh-border,var(--dsw-border-base,color-mix(in srgb,var(--dsb-text) 14%,var(--dsb-surface)))));',
      '--dsb-accent:var(--dsw-accent,var(--dsh-accent,#4d6bfe));',
      '--dsb-warn:#d9a021;--dsb-danger:#e06c6c;',
      'position:fixed;right:16px;bottom:44px;z-index:900;display:inline-flex;align-items:flex-end;font:inherit;color:var(--dsb-text)}',
      '@media (prefers-color-scheme:dark){#dsh-balance-pro{',
      '--dsb-surface:var(--dsw-surface,var(--dsh-surface,var(--dsw-bg-elevated,var(--dsh-bg-elevated,#1f1f24))));',
      '--dsb-text:var(--dsw-text,var(--dsh-text,var(--dsw-text-primary,#ededf0)))}}',
      // Badge shape: a tall rounded rect with near-circular corners, the amount
      // left, the state glyph right, and a small alert dot on its shoulder.
      '.dsb-pill{position:relative;display:inline-flex;align-items:center;gap:8px;height:34px;padding:0 12px 0 13px;',
      'border-radius:13px;cursor:pointer;',
      'border:1px solid var(--dsb-line);background:color-mix(in srgb,var(--dsb-surface) 82%,transparent);',
      'color:var(--dsb-text);font:inherit;font-size:13px;line-height:1;white-space:nowrap;',
      'backdrop-filter:blur(12px) saturate(1.2);-webkit-backdrop-filter:blur(12px) saturate(1.2);',
      'box-shadow:0 1px 2px rgba(0,0,0,.08);transition:border-color .16s ease,background .16s ease,transform .16s ease}',
      '.dsb-pill:hover{color:var(--dsb-text);border-color:color-mix(in srgb,var(--dsb-accent) 45%,var(--dsb-line));',
      'background:color-mix(in srgb,var(--dsb-accent) 12%,var(--dsb-surface))}',
      // The card opens downward when the dock sits in the top half, so it never
      // leaves the window.
      '#dsh-balance-pro[data-flip="true"] .dsb-panel{top:calc(100% + 8px);bottom:auto;animation-name:dsb-in-down}',
      // Dragged to the left half: align the card's left edge with the dock.
      '#dsh-balance-pro[data-anchor="left"] .dsb-panel{left:0;right:auto}',
      '@keyframes dsb-in-down{from{opacity:0;transform:translateY(-4px) scale(.985)}to{opacity:1;transform:none}}',
      '.dsb-pill:active{transform:scale(.97)}',
      '.dsb-pill:focus-visible{outline:2px solid var(--dsb-accent);outline-offset:2px}',
      '.dsb-pill[data-loading="true"] .dsb-glyph{animation:dsb-pulse 1.1s ease-in-out infinite}',
      '.dsb-pill[data-warn="true"]{border-color:color-mix(in srgb,var(--dsb-warn) 45%,var(--dsb-line))}',
      '.dsb-glyph{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:7px;',
      'background:color-mix(in srgb,var(--dsb-accent) 16%,transparent);color:var(--dsb-accent);flex:none}',
      '.dsb-pill[data-warn="true"] .dsb-glyph{background:color-mix(in srgb,var(--dsb-warn) 18%,transparent);color:var(--dsb-warn)}',
      // The shoulder dot is the "needs attention" badge from the reference art.
      '.dsb-alert{position:absolute;top:5px;right:5px;width:6px;height:6px;border-radius:50%;background:#f04438;',
      'box-shadow:0 0 0 2px var(--dsb-surface)}',
      '.dsb-alert[hidden]{display:none}',
      '.dsb-pill .dsb-number{font-variant-numeric:tabular-nums;font-weight:600;font-size:13px;letter-spacing:-.01em}',
      '.dsb-number{font-variant-numeric:tabular-nums;font-weight:600;letter-spacing:-.01em;color:var(--dsb-text)}',
      // The currency code is a unit, not part of the number: half the size,
      // lighter weight, slightly muted, and it keeps the baseline.
      '.dsb-unit{font-size:50%;font-weight:500;letter-spacing:0;color:var(--dsb-faint);margin-left:1px}',
      '.dsb-panel{position:absolute;bottom:calc(100% + 8px);right:0;left:auto;min-width:236px;padding:12px 13px 10px;border-radius:14px;',
      'border:1px solid var(--dsb-line);background:var(--dsb-surface);color:var(--dsb-text);',
      'backdrop-filter:blur(18px) saturate(1.3);-webkit-backdrop-filter:blur(18px) saturate(1.3);',
      'box-shadow:0 18px 44px rgba(0,0,0,.24),0 2px 6px rgba(0,0,0,.12);',
      'font-size:12px;line-height:1.5;text-align:left;',
      // The entrance keyframes stay scoped to [data-entering], so `animation`
      // is free for the close transition. `both` + a permanent animation would
      // re-apply the entry frame and swallow the zoom-out.
      'transform-origin:right bottom;opacity:1;transform:none;transition:opacity .24s ease,transform .24s cubic-bezier(.4,0,.2,1)}',
      '#dsh-balance-pro[data-anchor="left"] .dsb-panel{transform-origin:left bottom}',
      '#dsh-balance-pro[data-flip="true"] .dsb-panel{transform-origin:right top}',
      '#dsh-balance-pro[data-flip="true"][data-anchor="left"] .dsb-panel{transform-origin:left top}',
      '#dsh-balance-pro[data-entering="true"] .dsb-panel{animation:dsb-in .16s cubic-bezier(.2,.8,.2,1) both}',
      // Closing: a slower zoom-out, so the card visibly shrinks away.
      '#dsh-balance-pro[data-closing="true"] .dsb-panel{opacity:0;transform:scale(.86);transition-duration:.24s}',
      '@media (prefers-reduced-motion:reduce){',
      '.dsb-panel{transition:none;animation:none!important}',
      '#dsh-balance-pro[data-closing="true"] .dsb-panel{transform:none}}',
      '.dsb-rows{margin:0;display:flex;flex-direction:column;gap:5px}',
      '.dsb-row{display:flex;align-items:baseline;justify-content:space-between;gap:18px}',
      '.dsb-row dt{margin:0;color:var(--dsb-muted);font-weight:400}',
      '.dsb-row dd{margin:0;font-variant-numeric:tabular-nums;font-weight:500;letter-spacing:-.01em}',
      '.dsb-total{padding-bottom:7px;border-bottom:1px solid color-mix(in srgb,var(--dsb-line) 65%,transparent);margin-bottom:0}',
      '.dsb-total dt{color:var(--dsb-text);font-weight:500}',
      '.dsb-total dd{font-size:19px;font-weight:650;letter-spacing:-.02em}',
      '.dsb-spend dt{color:var(--dsb-faint)}.dsb-spend dd{color:var(--dsb-muted);font-weight:400}',
      '.dsb-meta{margin-top:6px;color:var(--dsb-faint);font-size:11px;line-height:1.4}',
      '.dsb-meta-line{display:block}',
      '.dsb-meta[data-tone="error"]{color:var(--dsb-danger)}',
      '.dsb-actions{display:flex;gap:7px;margin-top:8px}',
      '.dsb-actions>button,.dsb-actions>a{flex:1;height:29px;display:inline-flex;align-items:center;justify-content:center;gap:5px;',
      'border-radius:9px;border:1px solid var(--dsb-line);background:transparent;color:var(--dsb-text);font:inherit;font-size:12px;',
      'text-decoration:none;cursor:pointer;transition:border-color .16s ease,background .16s ease,color .16s ease}',
      '.dsb-actions>button:hover{border-color:color-mix(in srgb,var(--dsb-accent) 50%,var(--dsb-line));',
      'background:color-mix(in srgb,var(--dsb-accent) 8%,transparent)}',
      '.dsb-actions>button:focus-visible,.dsb-actions>a:focus-visible{outline:2px solid var(--dsb-accent);outline-offset:1px}',
      '.dsb-actions>button:disabled{opacity:.55;cursor:default}',
      // The top-up link is the primary action: accent fill, white label.
      '.dsb-actions>a{border-color:color-mix(in srgb,var(--dsb-accent) 70%,transparent);background:var(--dsb-accent);color:#fff;font-weight:500}',
      '.dsb-actions>a:hover{background:color-mix(in srgb,var(--dsb-accent) 86%,#000)}',
      '.dsb-spinner{width:10px;height:10px;border-radius:50%;border:1.5px solid currentColor;border-right-color:transparent;display:inline-block;animation:dsb-spin .7s linear infinite}',
    ].join('')

    /**
     * Pick the dictionary for one paint.
     *
     * Resolved per paint, not once at load: index.html ships as
     * `<html lang="en">` and the shell's locale plugin rewrites that attribute
     * when its snapshot arrives — after the index rows have already run. The
     * browser's own preference list is the last resort.
     * @returns the dictionary for the current page language.
     */
    function currentTable() {
      try {
        const html = String(document.documentElement.getAttribute('lang') || '').toLowerCase()
        if (html !== '') return html.startsWith('zh') ? DICT.zh : DICT.en
      } catch (error) {
        /* fall through to the navigator */
      }
      try {
        const languages = Array.isArray(navigator.languages) && navigator.languages.length > 0
          ? navigator.languages
          : [navigator.language]
        for (const language of languages) {
          const value = String(language || '').toLowerCase()
          if (value === '') continue
          return value.startsWith('zh') ? DICT.zh : DICT.en
        }
      } catch (error) {
        /* fall through to the default */
      }
      return DICT.zh
    }

    /**
     * One dictionary lookup with `{n}` interpolation.
     * @param key - dictionary key.
     * @param params - interpolation values.
     * @returns display text.
     */
    function t(key, params) {
      const table = currentTable()
      const text = Object.prototype.hasOwnProperty.call(table, key) ? table[key] : key
      if (!params) return text
      return text.replace(/\{(\w+)\}/g, (match, name) => (params[name] === undefined ? '' : String(params[name])))
    }

    /**
     * Amount rendering: an unreadable amount is an em dash, never a zero.
     * @param value - finite number or null.
     * @param currency - ISO code.
     * @returns display text.
     */
    /**
     * Amount parts: the symbol, the number and the currency code.
     *
     * Returned separately so the unit can be typeset at half the number's size
     * (the DOM writes it as its own `<span>`), while callers that only need a
     * string can join them.
     * @param value - finite number or null.
     * @param currency - ISO code.
     * @returns `{ symbol, number, code }`; all empty for an unreadable amount.
     */
    function amountParts(value, currency) {
      if (typeof value !== 'number' || !isFinite(value)) return { symbol: '', number: '—', code: '' }
      // Escapes, not literals: a quoted dollar sign inside an inline script
      // element reads as a tag marker and truncates it.
      const symbol = currency === 'USD' ? '\u0024' : '\u00a5'
      const digits = Math.abs(value) >= 1000 ? 0 : 2
      let number
      try {
        number = value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })
      } catch (error) {
        number = value.toFixed(digits)
      }
      const code = typeof currency === 'string' && currency !== '' ? currency.toUpperCase() : ''
      return { symbol, number, code }
    }

    /** One-line amount (`¥95.02 CNY`), for titles and plain text. */
    function formatAmount(value, currency) {
      const { symbol, number, code } = amountParts(value, currency)
      return code === '' ? symbol + number : symbol + number + ' ' + code
    }

    /**
     * Fill an element with an amount whose unit is typeset smaller.
     * @param target - element to fill.
     * @param value - finite number or null.
     * @param currency - ISO code.
     */
    function writeAmount(target, value, currency) {
      const { symbol, number, code } = amountParts(value, currency)
      const unit = document.createElement('small')
      unit.className = 'dsb-unit'
      unit.textContent = code
      target.textContent = symbol + number
      if (code !== '') {
        target.appendChild(document.createTextNode(' '))
        target.appendChild(unit)
      }
    }

    /**
     * The same amount without the currency code, for the compact pill.
     * @param value - finite number or null.
     * @param currency - ISO code.
     * @returns display text.
     */
    function formatPillAmount(value, currency) {
      return formatAmount(value, currency).replace(/ [A-Z]{3}$/u, '')
    }

    /**
     * Relative age of a timestamp.
     * @param iso - ISO timestamp.
     * @returns display text.
     */
    function relativeTime(iso) {
      const then = Date.parse(iso)
      if (!isFinite(then)) return ''
      const minutes = Math.max(0, Math.round((Date.now() - then) / 60000))
      if (minutes < 1) return t('justNow')
      if (minutes < 60) return t('minutesAgo', { n: minutes })
      const hours = Math.round(minutes / 60)
      if (hours < 24) return t('hoursAgo', { n: hours })
      return t('daysAgo', { n: Math.round(hours / 24) })
    }

        /**
     * Base URL of the Host endpoint that answers balance.json.
     *
     * The desktop shell publishes the Host origin on `__DSH_TRANSPORT__` before
     * it applies the index rows, so that is the authoritative source here — it
     * tracks the port of the running Host with no substitution involved.
     * @returns the origin, without a trailing slash.
     */
    function hostOrigin() {
      // Relative first: the desktop shell's dsh-app:// handler forwards such a
      // request to the Host with the browser cookie — the one path the fence
      // always accepts. (The whale widget does exactly this.)
      return ''
    }

    /**
     * Absolute fallback used only when a relative request fails outright, e.g.
     * a page rendered outside the shell.
     * @returns the transport origin, or the substituted loopback origin.
     */
    function fallbackOrigin() {
      try {
        const transport = window.__DSH_TRANSPORT__
        const fromShell = transport && (transport.streamBaseUrl || transport.hostUrl)
        if (typeof fromShell === 'string' && /^https?:\/\//.test(fromShell)) return fromShell.replace(/\/+$/, '')
      } catch (error) {
        /* fall through to the substituted loopback origin */
      }
      return LOOPBACK_ORIGIN
    }

    /**
     * One balance read.
     *
     * The Host is the only reader: it owns the API key (or the DSH account
     * session when there is no key). A page cannot call api.deepseek.com
     * itself — the endpoint authenticates with the key, and a cross-origin GET
     * carrying `Authorization` is preflighted and refused for web pages.
     * @param force - bypass the Host cache (subject to its cooldown).
     * @returns Promise of the payload.
     */
    async function fetchBalance(force) {
      status.reads += 1
      const query = force ? '?force=1' : ''
      const bases = ['', fallbackOrigin()]
      let lastError = ''
      for (const base of bases) {
        if (base === '' && bases.indexOf('') !== 0) continue
        const url = base + API_PATH + query
        status.lastUrl = url
        try {
          // `omit`: the route answers without credentials on loopback; the
          // shell's own forwarding supplies the cookie when the page is
          // dsh-app://app.
          const response = await fetch(url, { cache: 'no-store' })
          if (response.ok) {
            const body = await response.json()
            if (body && typeof body === 'object' && body.ok !== undefined) {
              status.lastError = ''
              status.lastOrigin = base === '' ? 'relative' : base
              return body
            }
            lastError = 'empty payload'
            continue
          }
          lastError = 'HTTP ' + response.status
          // The Host answered but refused: no other origin can help.
          if (response.status === 401 || response.status === 403) break
        } catch (error) {
          lastError = String((error && error.message) || error)
        }
      }
      status.lastError = lastError
      const code = /HTTP (401|403)/.test(lastError) ? 'FORBIDDEN'
        : /HTTP 429/.test(lastError) ? 'RATE_LIMITED'
          : /HTTP 5/.test(lastError) ? 'HTTP'
            : 'NETWORK'
      return { ok: false, code, error: lastError }
    }

    /** Human text for one failure code. */
    function describeError(payload) {
      const code = payload && payload.code
      const key = 'code.' + code
      if (code && Object.prototype.hasOwnProperty.call(currentTable(), key)) return t(key)
      return (payload && payload.error) || t('code.NETWORK')
    }

    /**
     * Mount the pill and keep it live until cleanup.
     * @returns cleanup function.
     */
    function mount() {
      // One dock per page: a second apply (hot replacement, duplicate bundle)
      // would otherwise stack a second pill and second style tag on top.
      const existing = document.getElementById(MODULE_ID)
        || (document.body && document.body.querySelector ? document.body.querySelector('#' + MODULE_ID) : null)
      if (existing !== null && existing !== undefined) {
        status.duplicates = (status.duplicates || 0) + 1
        try {
          existing.parentNode.removeChild(existing)
        } catch (error) {
          /* a foreign node with our id: remove where possible, keep going */
        }
      }
      const cleanups = []
      // One style tag per page, owned by this module and removed by the
      // cleanup below. The rules carry fallbacks, so the card is themed even
      // if the stylesheet request never lands.
      let styleTag = document.getElementById(MODULE_ID + '-styles')
      if (styleTag === null) {
        styleTag = document.createElement('style')
        styleTag.id = MODULE_ID + '-styles'
        styleTag.setAttribute('data-plugin', MODULE_ID)
        styleTag.textContent = STYLE_TEXT
        document.head.appendChild(styleTag)
      }
      cleanups.push(() => {
        if (styleTag.parentNode) styleTag.parentNode.removeChild(styleTag)
      })

      const host = document.createElement('div')
      host.id = MODULE_ID
      host.setAttribute('data-dsh-balance-pro', '')

      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'dsb-pill'
      button.title = t('label')
      // A round badge: the amount, a small alert dot, and the state glyph.
      // Created directly (not through `text()`, which also appends) so this is
      // the single place the amount is placed in the pill.
      const value = document.createElement('span')
      value.className = 'dsb-number'
      value.textContent = '…'
      const alertDot = document.createElement('span')
      alertDot.className = 'dsb-alert'
      alertDot.setAttribute('aria-hidden', 'true')
      const glyph = document.createElement('span')
      glyph.className = 'dsb-glyph'
      glyph.setAttribute('aria-hidden', 'true')
      glyph.innerHTML = '<svg viewBox="0 0 20 20" width="10" height="10" aria-hidden="true">'
        + '<rect x="4.6" y="4.6" width="10.8" height="10.8" rx="3.4" transform="rotate(45 10 10)" fill="currentColor"/></svg>'
      button.appendChild(value)
      button.appendChild(alertDot)
      button.appendChild(glyph)
      host.appendChild(button)

      // Card, hidden until the pill is clicked.
      const card = document.createElement('div')
      card.className = 'dsb-panel'
      card.hidden = true
      card.setAttribute('role', 'dialog')
      const rows = document.createElement('dl')
      rows.className = 'dsb-rows'
      card.appendChild(rows)
      const meta = document.createElement('div')
      meta.className = 'dsb-meta'
      card.appendChild(meta)
      const actions = document.createElement('div')
      actions.className = 'dsb-actions'
      const refresh = document.createElement('button')
      refresh.type = 'button'
      refresh.textContent = t('refresh')
      const topUp = document.createElement('a')
      topUp.href = 'https://platform.deepseek.com/top_up'
      topUp.target = '_blank'
      topUp.rel = 'noreferrer noopener'
      topUp.textContent = t('topUp')
      actions.appendChild(refresh)
      actions.appendChild(topUp)
      card.appendChild(actions)
      host.appendChild(card)

      // The row label lives in a dictionary key, so it is re-translated on every
      // paint: the shell may switch the page language after the card is built.
      function row(labelKey, className) {
        const line = document.createElement('div')
        line.className = className ? 'dsb-row ' + className : 'dsb-row'
        const key = document.createElement('dt')
        key.textContent = t(labelKey)
        key.setAttribute('data-label-key', labelKey)
        const val = document.createElement('dd')
        line.appendChild(key)
        line.appendChild(val)
        rows.appendChild(line)
        return { value: val, label: key }
      }
      const totalRow = row('total', 'dsb-total')
      const rechargeRow = row('recharge')
      const bonusRow = row('bonus')
      const spendRow = row('spend', 'dsb-spend')
      const rowTotal = totalRow.value
      const rowRecharge = rechargeRow.value
      const rowBonus = bonusRow.value
      const rowSpend = spendRow.value

      let data
      let loading = true
      let open = false

      function paint() {
        const ok = !!(data && data.ok)
        const amount = ok ? data.totalBalance : null
        const low = ok && typeof data.lowBalanceThreshold === 'number' && amount !== null && amount < data.lowBalanceThreshold
        const emptyAccount = ok && data.isAvailable === false
        button.title = t('label')
          + (ok ? ' · ' + formatAmount(amount, data.currency) : data ? ' · ' + describeError(data) : ' · ' + t('loading'))
          + (data && data.stale ? '\n' + t('stale') : '')
        const warning = low || emptyAccount || (data && data.stale === true)
        alertDot.hidden = !warning
        button.setAttribute('data-warn', warning ? 'true' : 'false')
        button.setAttribute('data-ok', ok ? 'true' : 'false')
        button.setAttribute('data-low', low ? 'true' : 'false')
        button.setAttribute('data-empty-account', emptyAccount ? 'true' : 'false')
        button.setAttribute('data-stale', data && data.stale ? 'true' : 'false')
        button.setAttribute('data-loading', loading ? 'true' : 'false')
        button.setAttribute('aria-label', button.title)
        button.setAttribute('aria-expanded', open ? 'true' : 'false')
        value.textContent = loading && !data ? '…' : (ok ? formatPillAmount(amount, data.currency) : t('empty'))
        // `data` is still undefined before the first payload lands.
        const currency = data && data.currency ? data.currency : null
        writeAmount(rowTotal, ok ? data.totalBalance : null, currency)
        writeAmount(rowRecharge, ok ? data.rechargeBalance : null, currency)
        writeAmount(rowBonus, ok ? data.bonusBalance : null, currency)
        writeAmount(rowSpend, ok && typeof data.totalCost === 'number' ? data.totalCost : null, currency)
        // Meta lines, one per row: the timestamp, then the account, then any
        // state note. Separate lines read faster than one long dotted string.
        const lines = []
        if (ok) {
          // Prefer the signed-in account's own identity (the email the
          // platform reports, already masked upstream) over the key hash tag.
          const who = data.account && data.account.contact
            ? String(data.account.contact)
            : data.accountTag ? String(data.accountTag).slice(0, 8) : ''
          lines.push(t('updated') + ' ' + (relativeTime(data.updatedAt) || '—'))
          if (who) lines.push(t('account') + ' ' + who)
          if (data.stale) lines.push(t('stale'))
          if (emptyAccount) lines.push(t('toppedUp'))
        } else if (data) {
          lines.push(describeError(data))
        } else {
          lines.push(t('loading'))
        }
        // Keep the card inside the window: open downward from the top half and
        // rightward from the left half, anchored to whichever edge the dock
        // actually sits on.
        try {
          const rect = host.getBoundingClientRect()
          host.setAttribute('data-flip', open && rect.top < window.innerHeight * 0.45 ? 'true' : 'false')
          host.setAttribute('data-anchor', rect.left + rect.width / 2 < window.innerWidth / 2 ? 'left' : 'right')
        } catch (error) {
          host.setAttribute('data-flip', 'false')
          host.setAttribute('data-anchor', 'right')
        }
        meta.replaceChildren()
        for (const line of lines) {
          const row = document.createElement('div')
          row.className = 'dsb-meta-line'
          row.textContent = line
          meta.appendChild(row)
        }
        meta.setAttribute('data-tone', ok ? 'info' : 'error')
        card.hidden = !open
        // Re-translate static copy: the page language can change after mount.
        for (const cell of [totalRow, rechargeRow, bonusRow, spendRow]) {
          const key = (cell.label.dataset && cell.label.dataset.labelKey) || cell.label.getAttribute('data-label-key')
          if (!key) continue
          const text = t(key)
          if (cell.label.textContent !== text) cell.label.textContent = text
        }
        if (loading) {
          if (refresh.children.length === 0) {
            const spinner = document.createElement('span')
            spinner.className = 'dsb-spinner'
            spinner.setAttribute('aria-hidden', 'true')
            refresh.textContent = ''
            refresh.appendChild(spinner)
          }
        } else {
          refresh.textContent = t('refresh')
        }
        if (topUp.textContent !== t('topUp')) topUp.textContent = t('topUp')
        refresh.disabled = loading
      }

      /** The in-flight read, so a burst of presses shares one request. */
      let inFlight = null
      function read(force) {
        if (inFlight !== null) return inFlight
        loading = true
        paint()
        inFlight = fetchBalance(force).then((payload) => {
          data = payload
          loading = false
          inFlight = null
          paint()
          return payload
        }, (error) => {
          inFlight = null
          loading = false
          paint()
          throw error
        })
        return inFlight
      }

      // The language of the card is decided at paint time, so a locale switch
      // the shell makes after the pill mounted shows up on the next paint.
      let paintedLanguage = document.documentElement.getAttribute('lang')
      status.language = paintedLanguage
      const repaintIfLanguageChanged = () => {
        const language = document.documentElement.getAttribute('lang')
        if (language === paintedLanguage) return
        paintedLanguage = language
        status.language = language
        paint()
      }
      try {
        const observer = new MutationObserver(repaintIfLanguageChanged)
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
        cleanups.push(() => observer.disconnect())
      } catch (error) {
        /* no MutationObserver: the next natural paint still picks it up */
      }

      button.addEventListener('click', () => {
        if (closingTimer !== null) {
          // Re-opening mid-close: finish the close instantly, then open.
          clearTimeout(closingTimer)
          closingTimer = null
          host.removeAttribute('data-closing')
        }
        open = !open
        paintedLanguage = document.documentElement.getAttribute('lang')
        paint()
        if (open) {
          // Re-arm the entrance animation for this opening only.
          host.setAttribute('data-entering', 'true')
          setTimeout(() => host.removeAttribute('data-entering'), 180)
          void read(false)
        }
      })
      refresh.addEventListener('click', () => void read(true))
      /**
       * Close the card with a slow zoom-out.
       *
       * The attribute drives a CSS transition on the panel (scale + fade over
       * 240ms); `open` flips after it finishes so a quick reopen is not eaten
       * by a half-finished animation.
       */
      const CLOSE_MS = 240
      let closingTimer = null
      const close = () => {
        if (!open) return
        open = false
        host.setAttribute('data-closing', 'true')
        if (closingTimer !== null) clearTimeout(closingTimer)
        closingTimer = setTimeout(() => {
          closingTimer = null
          host.removeAttribute('data-closing')
          paint()
        }, CLOSE_MS)
      }

      // Any pointer press outside this dock closes the card (capture phase, so
      // an app handler that stops propagation cannot keep it open forever).
      const onOutside = (event) => {
        if (!open) return
        if (host.contains(event.target)) return
        close()
      }
      document.addEventListener('pointerdown', onOutside, true)
      cleanups.push(() => document.removeEventListener('pointerdown', onOutside, true))

      const onKey = (event) => {
        if (event.key === 'Escape' && open) close()
      }
      document.addEventListener('keydown', onKey)

      // ── placement: fixed at the right end of the account row ──────────
      // The pill is a readout, not a handle: dragging is off. It sits at the
      // right end of the sidebar's account row (same row as the avatar and the
      // masked phone), vertically centered, and follows that row on resize.
      // A position saved by an older draggable build is discarded.
      try {
        // Also clear the key an older draggable build wrote under the old name.
        window.localStorage.removeItem(MODULE_ID + '.placement')
        window.localStorage.removeItem('dsh-deepseek-balance.placement')
      } catch (error) {
        /* a storage-less page has nothing to clear */
      }

      /**
       * Compute the dock position: right-aligned and vertically centered on the
       * account row. Without that row it parks above the status bar.
       * @returns `{ x, y }` in viewport pixels.
       */
      function accountRowPlacement() {
        const width = host.offsetWidth || 96
        const height = host.offsetHeight || 34
        let x = 16
        let y = window.innerHeight - height - 44
        try {
          const avatar = document.querySelector('[data-avatar-status], [class*="_avatar"]')
          let row = avatar && avatar.closest('button') ? avatar.closest('button') : avatar
          // The row can be a plain wrapper rather than a button: walk up until
          // the box is wide enough to hold the badge beside the identity.
          let guard = 0
          while (row && row.getBoundingClientRect && guard < 4) {
            const box = row.getBoundingClientRect()
            if (box.width >= width + 40 || row.parentElement === null || row.parentElement === document.body) break
            if (box.width <= 0) break
            row = row.parentElement
            guard += 1
          }
          if (row) {
            const rect = row.getBoundingClientRect()
            if (rect.width > 0 && rect.height > 0) {
              x = rect.right - width - Math.max(4, (rect.width - width) * 0.03)
              y = rect.top + (rect.height - height) / 2
            }
          }
        } catch (error) {
          /* keep the status-bar fallback */
        }
        const maxX = Math.max(4, window.innerWidth - width - 4)
        const maxY = Math.max(4, window.innerHeight - height - 4)
        return { x: Math.min(Math.max(4, x), maxX), y: Math.min(Math.max(4, y), maxY) }
      }

      function applyPlacement() {
        const next = accountRowPlacement()
        host.style.left = Math.round(next.x) + 'px'
        host.style.top = Math.round(next.y) + 'px'
        host.style.right = 'auto'
        host.style.bottom = 'auto'
      }

      const onResize = () => applyPlacement()
      window.addEventListener('resize', onResize)
      cleanups.push(() => window.removeEventListener('resize', onResize))
      // The sidebar can slide in or out without a window resize event.
      let layoutFrame = 0
      const trackLayout = () => {
        if (layoutFrame !== 0) return
        layoutFrame = requestAnimationFrame(() => {
          layoutFrame = 0
          applyPlacement()
        })
      }
      try {
        const layoutObserver = new MutationObserver(trackLayout)
        layoutObserver.observe(document.body, { attributes: true, childList: true, subtree: true })
        cleanups.push(() => layoutObserver.disconnect())
      } catch (error) {
        /* without an observer the resize handler still keeps it in place */
      }

      applyPlacement()
      document.body.appendChild(host)
      status.mounted = true

      // Poll on the cadence the Host reports; re-read when the window wakes up.
      let timer = null
      function schedule() {
        if (timer !== null) clearTimeout(timer)
        const minutes = Math.max(1, Number(data && data.refreshMinutes) || 10)
        timer = setTimeout(() => {
          void read(false).then(schedule)
        }, minutes * 60000)
      }
      void read(false).then(schedule)
      const onVisible = () => {
        if (document.visibilityState !== 'visible') return void 0
        const last = data && Date.parse(data.updatedAt)
        if (isFinite(last) && Date.now() - last < 60000) return void 0
        return void read(false).then(schedule)
      }
      document.addEventListener('visibilitychange', onVisible)

      return () => {
        if (timer !== null) clearTimeout(timer)
        document.removeEventListener('visibilitychange', onVisible)
        document.removeEventListener('keydown', onKey)
        for (const clean of cleanups.splice(0)) {
          try {
            clean()
          } catch (error) {
            /* one failing cleanup must not keep the dock alive */
          }
        }
        status.mounted = false
        if (host.parentNode) host.parentNode.removeChild(host)
      }
    }

    exports.name = MODULE_ID
    // No services: this composition has no `slots`, and a pending entry aborts
    // the page boot. Nothing here may depend on `require` either.
    exports.inject = []
    exports.apply = function apply(ctx) {
      /**
       * Mount now, or after the body exists. The return value is the disposer
       * cordis keeps for fiber teardown.
       * @returns cleanup function.
       */
      function start() {
        try {
          if (document.body === null || document.body === undefined) {
            // The graph row can load before <body> exists.
            const onReady = () => {
              try {
                mount()
              } catch (error) {
                reportFailure(error)
              }
            }
            document.addEventListener('DOMContentLoaded', onReady, { once: true })
            return () => document.removeEventListener('DOMContentLoaded', onReady)
          }
          return mount()
        } catch (error) {
          reportFailure(error)
          return () => {}
        }
      }

      /** Record a mount failure where the devtools console can find it. */
      function reportFailure(error) {
        status.error = (error && error.message) || String(error)
        try {
          console.warn(LOG + ' mount failed: ' + status.error)
        } catch (inner) {
          /* no console */
        }
      }

      try {
        if (ctx && typeof ctx.effect === 'function') {
          ctx.effect(start, MODULE_ID + ': dock')
          return
        }
        // No plugin context (a page driving the bundle by hand): mount directly.
        start()
      } catch (error) {
        status.error = (error && error.message) || String(error)
      }
    }
    // `require` is accepted but unused: this bundle needs no seeded module.
    return module.exports
  },
})
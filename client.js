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

    /**
     * The DeepSeek whale, traced from the Harness brand wordmark
     * (`ui-primitives/src/BrandWordmark.tsx`). One path serves the pill, the
     * card crest and the watermark, so the plugin reads as part of the shell.
     */
    const WHALE_PATH = 'M23.0584 4.95203C22.8129 4.83203 22.7074 5.06103 22.5639 5.17704C22.5149 5.21454 22.4734 5.26354 22.4319 5.30854C22.0734 5.69155 21.6543 5.94306 21.1073 5.91306C20.3073 5.86806 19.6243 6.11957 19.0203 6.73158C18.8918 5.97706 18.4652 5.52655 17.8162 5.23754C17.4767 5.08753 17.1332 4.93703 16.8952 4.61052C16.7292 4.37801 16.6837 4.11901 16.6007 3.8635C16.5477 3.70949 16.4952 3.55199 16.3177 3.52549C16.1252 3.49549 16.0497 3.65699 15.9742 3.792C15.6722 4.34401 15.5552 4.95203 15.5667 5.56805C15.5932 6.95359 16.1782 8.05712 17.3407 8.84215C17.4727 8.93215 17.5067 9.02215 17.4652 9.15366C17.3857 9.42416 17.2917 9.68667 17.2087 9.95718C17.1557 10.1297 17.0767 10.1677 16.8917 10.0922C16.2537 9.82568 15.7027 9.43117 15.2156 8.95465C14.3891 8.15513 13.6416 7.2726 12.7096 6.58158C12.4906 6.42007 12.2716 6.27007 12.045 6.12707C11.094 5.20354 12.1696 4.44502 12.4186 4.35501C12.6791 4.26101 12.5091 3.938 11.6675 3.942C10.826 3.9455 10.056 4.22751 9.07446 4.60302C8.93096 4.65952 8.77995 4.70052 8.62545 4.73452C7.73492 4.56552 6.80989 4.52802 5.84386 4.63702C4.02481 4.83953 2.57177 5.69955 1.50373 7.1676C0.220694 8.93215 -0.0813148 10.9372 0.288196 13.0283C0.676708 15.2323 1.80174 17.0569 3.53029 18.4834C5.32285 19.9625 7.38741 20.6875 9.74298 20.5485C11.1735 20.466 12.7661 20.2745 14.5626 18.7539C15.0156 18.9795 15.4912 19.0695 16.2797 19.137C16.8872 19.1935 17.4722 19.107 17.9252 19.013C18.6347 18.8629 18.5857 18.2059 18.3292 18.0854C16.2497 17.1169 16.7062 17.5109 16.2912 17.1919C17.3477 15.9419 18.9618 13.7198 19.4598 10.6942C19.5088 10.3602 19.5713 9.88968 19.5638 9.61917C19.5598 9.45417 19.5978 9.39016 19.7863 9.37116C20.3073 9.31116 20.8128 9.16866 21.2773 8.91315C22.6249 8.17713 23.1684 6.96809 23.2964 5.51905C23.3154 5.29754 23.2924 5.06853 23.0584 4.95203ZM11.3165 17.9954C9.30097 16.4109 8.32344 15.8894 7.91992 15.9119C7.54241 15.9344 7.61042 16.3664 7.69342 16.6479C7.78042 16.9259 7.89342 17.1174 8.05193 17.3614C8.16143 17.5229 8.23694 17.7629 7.94243 17.9434C7.29341 18.3449 6.16487 17.8084 6.11187 17.7819C4.79833 17.0084 3.7003 15.9874 2.92628 14.5908C2.17875 13.2468 1.74474 11.8047 1.67324 10.2657C1.65424 9.89418 1.76374 9.76267 2.13375 9.69517C2.62077 9.60517 3.12278 9.58617 3.6093 9.65767C5.66636 9.95818 7.41741 10.8777 8.88545 12.3348C9.72348 13.1643 10.3575 14.1558 11.0105 15.1243C11.705 16.1529 12.4521 17.1329 13.4036 17.9364C13.7396 18.2179 14.0076 18.4319 14.2641 18.5899C13.4906 18.6764 12.1996 18.6949 11.3165 17.9964V17.9954ZM12.2826 11.7817C12.2826 11.6167 12.4146 11.4852 12.5806 11.4852C12.6181 11.4852 12.6521 11.4927 12.6826 11.5037C12.7241 11.5187 12.7621 11.5412 12.7921 11.5752C12.8451 11.6277 12.8751 11.7027 12.8751 11.7817C12.8751 11.9467 12.7431 12.0782 12.5771 12.0782C12.4111 12.0782 12.2826 11.9467 12.2826 11.7817ZM15.2831 13.3208C15.0906 13.3998 14.8981 13.4673 14.7131 13.4748C14.4261 13.4898 14.1131 13.3733 13.9431 13.2308C13.6791 13.0093 13.4901 12.8853 13.4111 12.4988C13.3771 12.3338 13.3961 12.0782 13.4261 11.9317C13.4941 11.6162 13.4186 11.4137 13.1961 11.2297C13.0151 11.0797 12.7846 11.0382 12.5316 11.0382C12.4371 11.0382 12.3506 10.9967 12.2861 10.9632C12.1806 10.9107 12.0936 10.7792 12.1766 10.6177C12.2031 10.5652 12.3316 10.4377 12.3616 10.4152C12.7051 10.2197 13.1011 10.2837 13.4676 10.4302C13.8071 10.5692 14.0641 10.8242 14.4336 11.1847C14.8111 11.6202 14.8791 11.7402 15.0941 12.0672C15.2641 12.3228 15.4186 12.5853 15.5247 12.8858C15.5887 13.0733 15.5057 13.2268 15.2831 13.3208Z'

    /**
     * Inline whale artwork. Static markup only: no network request, no image
     * file, and it stays crisp at any device pixel ratio.
     * @param size - square edge in CSS pixels.
     * @returns an `<svg>` string filled with `currentColor`.
     */
    function whaleSvg(size) {
      return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size
        + '" aria-hidden="true" focusable="false"><path d="' + WHALE_PATH + '" fill="currentColor"/></svg>'
    }

    /**
     * Whether the page around the plugin is dark.
     *
     * The shell can force a theme independently of the OS, so `prefers-color-
     * scheme` is only the fallback: the page background is the honest signal.
     * @returns `"dark"` or `"light"`.
     */
    function detectTone() {
      try {
        if (document.body && typeof document.body.hasAttribute === 'function'
          && document.body.hasAttribute('data-ds-dark-theme')) return 'dark'
      } catch (error) {
        /* no body yet */
      }
      try {
        if (typeof window.getComputedStyle === 'function') {
          for (const node of [document.body, document.documentElement]) {
            if (!node) continue
            const computed = window.getComputedStyle(node)
            const raw = computed && computed.backgroundColor
            const match = /^rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?/.exec(String(raw || ''))
            if (!match) continue
            const alpha = match[4] === undefined ? 1 : Number(match[4])
            if (!(alpha > 0.4)) continue
            const channel = (value) => {
              const unit = Number(value) / 255
              return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4
            }
            const luminance = 0.2126 * channel(match[1]) + 0.7152 * channel(match[2]) + 0.0722 * channel(match[3])
            return luminance < 0.42 ? 'dark' : 'light'
          }
        }
      } catch (error) {
        /* fall through to the media query */
      }
      try {
        if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
      } catch (error) {
        /* no media query support */
      }
      return 'dark'
    }

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
        balance: '余额',
        statusLoading: '读取中',
        statusOk: '正常',
        statusLow: '偏低',
        statusEmpty: '零余额',
        statusStale: '缓存',
        statusError: '异常',
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
        balance: 'Balance',
        statusLoading: 'Syncing',
        statusOk: 'Available',
        statusLow: 'Low',
        statusEmpty: 'Empty',
        statusStale: 'Cached',
        statusError: 'Error',
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
      '#dsh-balance-pro{--dsb-surface:var(--dsw-alias-bg-layer-2,#1c1f28);',
      '  --dsb-text:var(--dsw-alias-label-primary,#f4f5f8);',
      '  --dsb-muted:var(--dsw-alias-label-secondary,#b9c0cc);',
      '  --dsb-faint:var(--dsw-alias-label-tertiary,#8a92a3);',
      '  --dsb-line:var(--dsw-alias-border-l2,rgba(255,255,255,.10));',
      '  --dsb-line-strong:var(--dsw-alias-border-l3,rgba(255,255,255,.16));',
      '  --dsb-accent:var(--dsw-alias-link,#8fb4ff);',
      '  --dsb-brand:var(--dsw-static-deepseek-500,#5686fe);',
      '  --dsb-brand-2:var(--dsw-static-deepseek-400,#7aaaff);',
      '  --dsb-ok:#41c977;--dsb-warn:#e0a33a;--dsb-danger:#f25a5a;',
      '  --dsb-panel-fill:rgba(22,26,36,.60);',
      '  --dsb-panel-shadow:0 30px 70px -18px rgba(0,0,0,.72),0 12px 28px -10px rgba(0,0,0,.45),0 0 64px -26px rgba(86,134,254,.55);',
      '  --dsb-pill-shadow:0 1px 0 rgba(255,255,255,.16) inset,0 -1px 0 rgba(0,0,0,.12) inset,0 8px 24px rgba(0,0,0,.28),0 1px 2px rgba(0,0,0,.18),0 0 26px -10px rgba(86,134,254,.28);',
      '  --dsb-pill-fill:rgba(26,29,39,.78);',
      '  --dsb-edge-soft:rgba(255,255,255,.07);',
      '  --dsb-glow:rgba(86,134,254,.38);',
      '  position:fixed;right:16px;bottom:44px;z-index:900;display:inline-flex;align-items:flex-end;',
      '  font:inherit;color:var(--dsb-text);-webkit-font-smoothing:antialiased;',
      '}',
      '#dsh-balance-pro[data-tone="light"]{',
      '  --dsb-text:var(--dsw-alias-label-primary,#17171c);',
      '  --dsb-muted:var(--dsw-alias-label-secondary,#545557);',
      '  --dsb-faint:#707784;',
      '  --dsb-line:var(--dsw-alias-border-l2,rgba(15,17,21,.10));',
      '  --dsb-line-strong:var(--dsw-alias-border-l3,rgba(15,17,21,.14));',
      '  --dsb-accent:var(--dsw-alias-link,#4176e6);',
      '  --dsb-brand:#4176e6;--dsb-brand-2:#7aaaff;',
      '  --dsb-ok:#178a5c;--dsb-warn:#a56a12;--dsb-danger:#d64545;',
      '  --dsb-surface:var(--dsw-alias-bg-layer-2,#f4f7fc);',
      '  --dsb-panel-fill:rgba(242,247,255,.68);',
      '  --dsb-panel-shadow:0 30px 66px -22px rgba(24,45,95,.42),0 10px 26px -12px rgba(24,45,95,.26),0 0 54px -26px rgba(65,118,230,.32);',
      '  --dsb-pill-shadow:0 1px 0 rgba(255,255,255,.9) inset,0 -1px 0 rgba(20,40,80,.04) inset,0 10px 24px rgba(24,45,95,.14),0 0 0 .5px rgba(24,45,95,.06),0 0 22px -10px rgba(65,118,230,.25);',
      '  --dsb-pill-fill:rgba(252,253,255,.74);',
      '  --dsb-edge-soft:rgba(255,255,255,.9);',
      '  --dsb-glow:rgba(65,118,230,.18);',
      '}',
      '#dsh-balance-pro,#dsh-balance-pro *{box-sizing:border-box}',
      '#dsh-balance-pro[data-tone="dark"]{color-scheme:dark;--dsb-brand:var(--dsw-static-deepseek-450,#5686fe);--dsb-brand-2:var(--dsw-static-deepseek-300,#b7c8fe)}',
      '#dsh-balance-pro[data-tone="light"]{color-scheme:light}',
      '@keyframes dsb-in{0%{opacity:0;transform:translateY(10px) scale(.94)}62%{opacity:1;transform:translateY(-1px) scale(1.004)}100%{opacity:1;transform:none}}',
      '@keyframes dsb-in-down{0%{opacity:0;transform:translateY(-10px) scale(.94)}62%{opacity:1;transform:translateY(1px) scale(1.004)}100%{opacity:1;transform:none}}',
      '@keyframes dsb-breathe{0%,100%{opacity:.55;box-shadow:0 0 0 0 var(--dsb-glow)}50%{opacity:1;box-shadow:0 0 0 4px transparent}}',
      '@keyframes dsb-spin{to{transform:rotate(360deg)}}',
      '@keyframes dsb-glare{0%{opacity:0;transform:translateX(-135%)}18%{opacity:.9}100%{opacity:0;transform:translateX(135%)}}',
      '.dsb-pill{',
      '  position:relative;display:inline-flex;align-items:center;gap:9px;height:36px;padding:0 5px 0 13px;',
      '  border-radius:13px;cursor:pointer;isolation:isolate;overflow:hidden;-webkit-appearance:none;appearance:none;margin:0;',
      '  border:1px solid color-mix(in srgb,var(--dsb-accent) 18%,var(--dsb-line-strong));',
      '  background:',
      '    linear-gradient(180deg,rgba(255,255,255,.09),rgba(255,255,255,.02) 55%,rgba(255,255,255,0) 100%),',
      '    var(--dsb-pill-fill);',
      '  color:var(--dsb-text);font:inherit;font-size:13px;line-height:1;white-space:nowrap;',
      '  backdrop-filter:blur(24px) saturate(1.7);-webkit-backdrop-filter:blur(24px) saturate(1.7);',
      '  box-shadow:var(--dsb-pill-shadow);',
      '  transition:border-color .2s ease,background .2s ease,transform .2s cubic-bezier(.2,.8,.2,1),box-shadow .2s ease;',
      '}',
      '.dsb-pill::before{',
      '  content:"";position:absolute;inset:0;z-index:0;pointer-events:none;',
      '  background:linear-gradient(108deg,transparent 18%,rgba(255,255,255,.16) 40%,rgba(255,255,255,.05) 50%,transparent 68%);',
      '  transform:translateX(-130%);transition:transform .7s cubic-bezier(.2,.7,.2,1);',
      '}',
      '.dsb-pill:hover::before{transform:translateX(130%)}',
      '.dsb-pill:hover{',
      '  border-color:color-mix(in srgb,var(--dsb-accent) 42%,var(--dsb-line-strong));',
      '  box-shadow:0 1px 0 rgba(255,255,255,.2) inset,0 -1px 0 rgba(0,0,0,.12) inset,0 12px 30px rgba(0,0,0,.32),0 0 0 3px color-mix(in srgb,var(--dsb-accent) 9%,transparent);',
      '}',
      '.dsb-pill:active{transform:scale(.975)}',
      '.dsb-pill:focus-visible{outline:2px solid var(--dsb-accent);outline-offset:2px}',
      '.dsb-number{position:relative;z-index:1;display:inline-flex;align-items:baseline;font-variant-numeric:tabular-nums;font-weight:600;letter-spacing:-.015em}',
      '.dsb-sym{font-size:10px;font-weight:600;opacity:.6;margin-right:1.5px;letter-spacing:0}',
      '.dsb-num{font-size:13.5px}',
      '.dsb-alert{position:absolute;z-index:2;top:5px;right:5px;width:6px;height:6px;border-radius:50%;background:var(--dsb-danger);',
      '  box-shadow:0 0 0 2px var(--dsb-surface),0 0 8px 1px color-mix(in srgb,var(--dsb-danger) 65%,transparent);z-index:2}',
      '.dsb-alert[hidden]{display:none}',
      '.dsb-pill[data-warn="true"]{border-color:color-mix(in srgb,var(--dsb-warn) 45%,var(--dsb-line-strong))}',
      '.dsb-pill[data-warn="true"] .dsb-alert{background:var(--dsb-warn);box-shadow:0 0 0 2px var(--dsb-surface),0 0 8px 1px color-mix(in srgb,var(--dsb-warn) 65%,transparent)}',
      '.dsb-glyph{',
      '  position:relative;display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:8px;flex:none;',
      '  background:linear-gradient(150deg,color-mix(in srgb,var(--dsb-brand-2) 95%,white),var(--dsb-brand) 58%,color-mix(in srgb,var(--dsb-brand) 82%,#101a3a));',
      '  color:#fff;',
      '  box-shadow:0 1px 0 rgba(255,255,255,.45) inset,0 -1px 0 rgba(0,0,0,.18) inset,0 3px 8px color-mix(in srgb,var(--dsb-brand) 45%,transparent);',
      '  transition:transform .25s cubic-bezier(.2,.8,.2,1),box-shadow .25s ease;',
      '}',
      '.dsb-glyph svg{width:17px;height:17px;display:block;filter:drop-shadow(0 1px 1px rgba(10,20,50,.35))}',
      '.dsb-pill:hover .dsb-glyph{transform:translateY(-.5px) scale(1.04);box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 -1px 0 rgba(0,0,0,.18) inset,0 5px 14px color-mix(in srgb,var(--dsb-brand) 55%,transparent)}',
      '.dsb-pill[data-loading="true"] .dsb-glyph{animation:dsb-breathe 1.4s ease-in-out infinite}',
      '.dsb-panel{',
      '  position:absolute;bottom:calc(100% + 10px);right:0;left:auto;width:300px;padding:15px 15px 13px;',
      '  border-radius:24px;border:1px solid var(--dsb-edge-soft);',
      '  background:var(--dsb-panel-fill);',
      '  color:var(--dsb-text);font-size:12px;line-height:1.5;text-align:left;isolation:isolate;overflow:hidden;',
      '  backdrop-filter:blur(40px) saturate(1.65);-webkit-backdrop-filter:blur(40px) saturate(1.65);',
      '  box-shadow:var(--dsb-panel-shadow),0 0 0 .5px color-mix(in srgb,var(--dsb-text) 12%,transparent),0 1px 0 rgba(255,255,255,.22) inset,0 -22px 40px -28px rgba(0,0,0,.55) inset;',
      '  transform-origin:right bottom;opacity:1;transform:none;',
      '  transition:opacity .22s ease,transform .22s cubic-bezier(.4,0,.2,1);',
      '}',
      '#dsh-balance-pro[data-anchor="left"] .dsb-panel{left:0;right:auto;transform-origin:left bottom}',
      '#dsh-balance-pro[data-flip="true"] .dsb-panel{top:calc(100% + 10px);bottom:auto;transform-origin:right top}',
      '#dsh-balance-pro[data-flip="true"][data-anchor="left"] .dsb-panel{transform-origin:left top}',
      '#dsh-balance-pro[data-entering="true"] .dsb-panel{animation:dsb-in .34s cubic-bezier(.16,1,.3,1) both}',
      '#dsh-balance-pro[data-entering="true"][data-flip="true"] .dsb-panel{animation-name:dsb-in-down}',
      '#dsh-balance-pro[data-closing="true"] .dsb-panel{opacity:0;transform:scale(.94) translateY(4px);transition-duration:.2s}',
      '.dsb-glare{position:absolute;inset:0;z-index:2;pointer-events:none;border-radius:inherit;overflow:hidden;opacity:0;background:linear-gradient(112deg,transparent 34%,rgba(255,255,255,.16) 46%,rgba(255,255,255,.03) 52%,transparent 62%)}',
      '#dsh-balance-pro[data-glare="true"] .dsb-glare{animation:dsb-glare 1.05s cubic-bezier(.3,.6,.3,1) .06s both}',
      '.dsb-panel::before{',
      '  content:"";position:absolute;inset:0;z-index:3;border-radius:inherit;padding:1px;pointer-events:none;',
      '  background:linear-gradient(146deg,rgba(255,255,255,.72),rgba(255,255,255,.22) 20%,rgba(255,255,255,0) 45%,rgba(255,255,255,.04) 64%,color-mix(in srgb,var(--dsb-brand-2) 36%,transparent));',
      '  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);',
      '  -webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);mask-composite:exclude;',
      '}',
      '.dsb-panel::after{',
      '  content:"";position:absolute;inset:0;z-index:0;border-radius:inherit;pointer-events:none;opacity:.05;mix-blend-mode:overlay;',
      '  background-image:url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22140%22 height=%22140%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%22.9%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E");',
      '}',
      '.dsb-scene{position:absolute;inset:0;z-index:-1;border-radius:inherit;overflow:hidden;pointer-events:none;',
      '  background:',
      '    radial-gradient(120% 95% at 4% -8%,rgba(86,134,254,.34),rgba(86,134,254,0) 56%),',
      '    radial-gradient(85% 70% at 102% -4%,rgba(122,170,255,.24),rgba(122,170,255,0) 58%),',
      '    radial-gradient(120% 105% at 88% 112%,rgba(46,60,100,.62),rgba(46,60,100,0) 62%),',
      '    linear-gradient(165deg,#232a3d 0%,#171b27 52%,#10131c 100%);',
      '}',
      '.dsb-scene::before{',
      '  content:"";position:absolute;inset:-20% -10%;',
      '  background:',
      '    conic-gradient(from 208deg at 82% -12%,transparent 0deg,rgba(160,196,255,.16) 14deg,transparent 30deg,transparent 44deg,rgba(160,196,255,.08) 58deg,transparent 74deg),',
      '    linear-gradient(114deg,transparent 22%,rgba(180,206,255,.08) 32%,transparent 43%);',
      '  filter:blur(6px);opacity:.9;',
      '}',
      '.dsb-scene::after{',
      '  content:"";position:absolute;inset:0;',
      '  background:',
      '    radial-gradient(circle at 9% 86%,rgba(255,255,255,.42) 0 1px,transparent 2.2px),',
      '    radial-gradient(circle at 93% 17%,rgba(255,255,255,.22) 0 1.1px,transparent 2.3px);',
      '  opacity:.55;',
      '}',
      '.dsb-whale{position:absolute;right:-40px;bottom:-44px;width:228px;height:228px;color:rgba(146,186,255,.085);transform:rotate(-7deg);filter:none}',
      '.dsb-scrim{position:absolute;inset:0;background:linear-gradient(180deg,rgba(16,19,28,0) 18%,rgba(16,19,28,.16) 55%,rgba(16,19,28,.42) 100%);pointer-events:none}',
      '#dsh-balance-pro[data-tone="light"] .dsb-scrim{background:linear-gradient(180deg,rgba(255,255,255,0) 18%,rgba(245,248,255,.18) 55%,rgba(245,248,255,.5) 100%)}',
      '#dsh-balance-pro[data-tone="light"] .dsb-scene{',
      '  background:',
      '    radial-gradient(120% 95% at 2% -10%,rgba(183,200,254,.85),rgba(183,200,254,0) 58%),',
      '    radial-gradient(80% 70% at 102% 0%,rgba(228,237,253,.95),rgba(228,237,253,0) 60%),',
      '    radial-gradient(120% 110% at 90% 112%,rgba(211,226,255,.55),rgba(211,226,255,0) 62%),',
      '    linear-gradient(165deg,rgba(255,255,255,.78),rgba(236,243,255,.64) 52%,rgba(219,231,251,.58) 100%);',
      '}',
      '#dsh-balance-pro[data-tone="light"] .dsb-scene::before{opacity:.55}',
      '#dsh-balance-pro[data-tone="light"] .dsb-scene::after{opacity:.25;filter:invert(1)}',
      '#dsh-balance-pro[data-tone="light"] .dsb-whale{color:rgba(65,118,230,.10)}',
      '#dsh-balance-pro[data-tone="light"] .dsb-glare{position:absolute;inset:0;z-index:2;pointer-events:none;border-radius:inherit;overflow:hidden;opacity:0;background:linear-gradient(112deg,transparent 34%,rgba(255,255,255,.16) 46%,rgba(255,255,255,.03) 52%,transparent 62%)}',
      '#dsh-balance-pro[data-glare="true"] .dsb-glare{animation:dsb-glare 1.05s cubic-bezier(.3,.6,.3,1) .06s both}',
      '.dsb-panel::before{background:linear-gradient(148deg,rgba(255,255,255,1),rgba(255,255,255,.7) 22%,rgba(255,255,255,.1) 46%,rgba(65,118,230,.14));}',
      '.dsb-head,.dsb-rows,.dsb-meta,.dsb-actions{position:relative;z-index:1}',
      '.dsb-head{display:flex;align-items:center;gap:9px;margin-bottom:13px}',
      '.dsb-logo{width:29px;height:29px;flex:none;border-radius:9px;display:grid;place-items:center;',
      '  background:linear-gradient(150deg,#8fb6ff 0%,#5686fe 46%,#3f63d8 100%);color:#fff;',
      '  box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 -1px 0 rgba(0,0,0,.16) inset,0 4px 12px rgba(63,99,216,.35);',
      '}',
      '.dsb-logo svg{width:18px;height:18px;display:block}',
      '.dsb-headings{display:flex;flex-direction:column;gap:1px;min-width:0}',
      '.dsb-eyebrow{font-size:9px;font-weight:700;letter-spacing:.16em;color:color-mix(in srgb,var(--dsb-muted) 78%,transparent);line-height:1.2}',
      '.dsb-title{font-size:12.5px;font-weight:600;letter-spacing:.01em;color:var(--dsb-text);line-height:1.25}',
      '.dsb-status{white-space:nowrap;display:inline-flex;align-items:center;gap:5px;margin-left:auto;height:21px;padding:0 8px;border-radius:999px;',
      '  font-size:10px;font-weight:500;letter-spacing:.02em;color:var(--dsb-muted);',
      '  background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);',
      '}',
      '#dsh-balance-pro[data-tone="light"] .dsb-status{background:rgba(255,255,255,.5);border-color:rgba(15,17,21,.06)}',
      '.dsb-status i{width:5px;height:5px;border-radius:50%;background:var(--dsb-ok);flex:none;animation:dsb-breathe 3.2s ease-in-out infinite}',
      '.dsb-status[data-state="loading"]{color:var(--dsb-faint);background:rgba(255,255,255,.04);border-color:var(--dsb-line)}',
      '.dsb-status[data-state="loading"] i{background:var(--dsb-faint);animation:dsb-breathe 2.4s ease-in-out infinite}',
      '#dsh-balance-pro[data-tone="light"] .dsb-status[data-state="loading"]{background:rgba(255,255,255,.4)}',
      '.dsb-status[data-state="low"],.dsb-status[data-state="stale"],.dsb-status[data-state="empty"]{color:var(--dsb-warn);background:color-mix(in srgb,var(--dsb-warn) 12%,transparent);border-color:color-mix(in srgb,var(--dsb-warn) 22%,transparent)}',
      '.dsb-status[data-state="low"] i,.dsb-status[data-state="stale"] i,.dsb-status[data-state="empty"] i{background:var(--dsb-warn);animation:none}',
      '.dsb-status[data-state="error"]{color:var(--dsb-danger);background:color-mix(in srgb,var(--dsb-danger) 10%,transparent);border-color:color-mix(in srgb,var(--dsb-danger) 22%,transparent)}',
      '.dsb-status[data-state="error"] i{background:var(--dsb-danger);animation:none}',
      '.dsb-rows{margin:0;display:flex;flex-direction:column}',
      '.dsb-row{display:flex;align-items:baseline;justify-content:space-between;gap:18px;padding:6px 0}',
      '.dsb-row dt{margin:0;color:var(--dsb-muted);font-weight:400;font-size:11.5px;letter-spacing:.01em}',
      '.dsb-row dd{margin:0;font-variant-numeric:tabular-nums;font-weight:500;letter-spacing:-.015em;color:var(--dsb-text);font-size:12px}',
      '.dsb-total{padding:1px 0 12px;margin-bottom:2px;border-bottom:1px solid color-mix(in srgb,var(--dsb-line) 80%,transparent);align-items:flex-end}',
      '.dsb-total dt{color:var(--dsb-muted);font-size:11.5px;padding-bottom:4px}',
      '.dsb-total dd{font-size:27px;font-weight:650;line-height:1.05;letter-spacing:-.035em;color:var(--dsb-text);text-shadow:0 2px 22px rgba(146,186,255,.28)}',
      '.dsb-total[data-length="long"] dd{font-size:21px;letter-spacing:-.03em}',
      '.dsb-total[data-empty="true"] dd{font-size:18px;font-weight:500;letter-spacing:0;color:var(--dsb-muted);text-shadow:none}',
      '#dsh-balance-pro[data-tone="light"] .dsb-total dd{text-shadow:0 2px 18px rgba(65,118,230,.16)}',
      '.dsb-spend dt{color:var(--dsb-faint)}',
      '.dsb-spend dd{color:var(--dsb-muted);font-weight:400}',
      '.dsb-unit{font-size:9px;font-weight:500;letter-spacing:.045em;color:var(--dsb-faint);margin-left:3px;vertical-align:1px}',
      '.dsb-total .dsb-unit{font-size:10px;vertical-align:3px;margin-left:4px}',
      '.dsb-meta{margin-top:9px;padding-top:8px;border-top:1px solid color-mix(in srgb,var(--dsb-line) 70%,transparent);',
      '  color:var(--dsb-faint);font-size:10px;line-height:1.45;letter-spacing:.005em}',
      '.dsb-meta-line{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.dsb-meta[data-tone="error"]{color:var(--dsb-danger)}',
      '.dsb-actions{display:flex;gap:8px;margin-top:11px}',
      '.dsb-actions>button,.dsb-actions>a{flex:1;height:33px;display:inline-flex;align-items:center;justify-content:center;gap:6px;',
      '  border-radius:11px;border:1px solid color-mix(in srgb,var(--dsb-accent) 18%,var(--dsb-line-strong));background:rgba(255,255,255,.06);color:var(--dsb-text);',
      '  font:inherit;font-size:11.5px;font-weight:500;text-decoration:none;cursor:pointer;',
      '  box-shadow:0 1px 0 rgba(255,255,255,.12) inset;',
      '  transition:background .18s ease,border-color .18s ease,transform .18s ease,box-shadow .18s ease}',
      '#dsh-balance-pro[data-tone="light"] .dsb-actions>button{background:rgba(255,255,255,.55)}',
      '.dsb-actions>button:hover{border-color:color-mix(in srgb,var(--dsb-accent) 45%,var(--dsb-line-strong));background:color-mix(in srgb,var(--dsb-accent) 10%,rgba(255,255,255,.05))}',
      '.dsb-actions>button:active,.dsb-actions>a:active{transform:scale(.98)}',
      '.dsb-actions>button:focus-visible,.dsb-actions>a:focus-visible{outline:2px solid var(--dsb-accent);outline-offset:1px}',
      '.dsb-actions>button:disabled{opacity:.55;cursor:default}',
      '.dsb-actions>a{border-color:color-mix(in srgb,var(--dsb-brand) 80%,transparent);',
      '  background:linear-gradient(180deg,#456ce0 0%,#3f63d8 52%,#3452c0 100%);color:#fff;font-weight:550;',
      '  box-shadow:0 1px 0 rgba(255,255,255,.32) inset,0 -1px 0 rgba(0,0,0,.14) inset,0 6px 16px rgba(63,102,224,.38);',
      '}',
      '.dsb-actions>a:hover{background:linear-gradient(180deg,#4d74e6 0%,#456bdd 52%,#3b5bc8 100%);box-shadow:0 1px 0 rgba(255,255,255,.36) inset,0 8px 20px rgba(63,102,224,.46)}',
      '.dsb-actions svg{width:12px;height:12px;flex:none;opacity:.9}',
      '.dsb-icon{display:inline-flex;align-items:center;justify-content:center;flex:none}',
      '.dsb-action-label{line-height:1}',
      '.dsb-actions>button[data-loading="true"] .dsb-icon{display:none}',
      '.dsb-actions>button[data-loading="true"]::before{content:"";width:11px;height:11px;border-radius:50%;border:1.6px solid currentColor;border-right-color:transparent;animation:dsb-spin .7s linear infinite}',
      '@media (prefers-reduced-motion:reduce){',
      '  .dsb-panel{transition:none;animation:none!important}',
      '  #dsh-balance-pro[data-closing="true"] .dsb-panel{transform:none}',
      '  .dsb-status i,.dsb-pill[data-loading="true"] .dsb-glyph{animation:none}',
      '  .dsb-pill::before{display:none}',
      '  #dsh-balance-pro[data-glare="true"] .dsb-glare{animation:none;opacity:0}',
      '}',
      '@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){',
      '  .dsb-pill{background:#1a1d27}',
      '  .dsb-panel{background:#171a23}',
      '  #dsh-balance-pro[data-tone="light"] .dsb-pill{background:#f2f5fb}',
      '  #dsh-balance-pro[data-tone="light"] .dsb-panel{background:#f7f9fe}',
      '}',
      '@media (prefers-reduced-transparency:reduce){',
      '  .dsb-pill{backdrop-filter:none;-webkit-backdrop-filter:none;background:var(--dsb-pill-fill)}',
      '  .dsb-panel{backdrop-filter:none;-webkit-backdrop-filter:none;background:var(--dsb-surface)}',
      '  .dsb-scene{opacity:.55}',
      '}',
      '@media (prefers-contrast:more){',
      '  .dsb-panel,.dsb-pill{border-color:var(--dsb-text)}',
      '  .dsb-row dt,.dsb-meta{color:var(--dsb-text)}',
      '}',
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
     * Pill amount, typeset in two weights: a small muted symbol and the number.
     * @param target - element to fill.
     * @param value - finite number or null.
     * @param currency - ISO code.
     */
    function writePillAmount(target, value, currency) {
      const { symbol, number } = amountParts(value, currency)
      const unit = document.createElement('span')
      unit.className = 'dsb-sym'
      unit.textContent = symbol
      const digits = document.createElement('span')
      digits.className = 'dsb-num'
      digits.textContent = number
      // Clear first: a test double's replaceChildren does not drop own text.
      target.textContent = ''
      target.replaceChildren(unit, digits)
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

      // The pill's tone drives the glass recipe. The shell can force a theme
      // independently of the OS, so it is detected from the page, not guessed.
      host.setAttribute('data-tone', detectTone())

      const REFRESH_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"'
        + ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
        + '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/></svg>'
      const TOPUP_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"'
        + ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
        + '<path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg>'

      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'dsb-pill'
      button.title = t('label')
      button.setAttribute('aria-controls', MODULE_ID + '-panel')
      // Badge layout: amount, shoulder alert dot, then the whale crest.
      const value = document.createElement('span')
      value.className = 'dsb-number'
      value.textContent = '…'
      const alertDot = document.createElement('span')
      alertDot.className = 'dsb-alert'
      alertDot.setAttribute('aria-hidden', 'true')
      const glyph = document.createElement('span')
      glyph.className = 'dsb-glyph'
      glyph.setAttribute('aria-hidden', 'true')
      glyph.innerHTML = whaleSvg(18)
      button.appendChild(value)
      button.appendChild(alertDot)
      button.appendChild(glyph)
      host.appendChild(button)

      // Card, hidden until the pill is clicked. Layers, back to front: scene
      // (ocean + whale), glare sweep, content, specular rim, noise.
      const card = document.createElement('div')
      card.className = 'dsb-panel'
      card.id = MODULE_ID + '-panel'
      card.hidden = true
      card.setAttribute('role', 'dialog')
      card.setAttribute('aria-label', t('label'))

      const glare = document.createElement('div')
      glare.className = 'dsb-glare'
      glare.setAttribute('aria-hidden', 'true')
      card.appendChild(glare)

      const scene = document.createElement('div')
      scene.className = 'dsb-scene'
      scene.setAttribute('aria-hidden', 'true')
      scene.innerHTML = '<div class="dsb-whale">' + whaleSvg(228) + '</div>'
        + '<div class="dsb-scrim"></div>'
      card.appendChild(scene)

      const head = document.createElement('div')
      head.className = 'dsb-head'
      const logo = document.createElement('span')
      logo.className = 'dsb-logo'
      logo.setAttribute('aria-hidden', 'true')
      logo.innerHTML = whaleSvg(18)
      const headings = document.createElement('span')
      headings.className = 'dsb-headings'
      const eyebrow = document.createElement('span')
      eyebrow.className = 'dsb-eyebrow'
      eyebrow.textContent = 'DEEPSEEK'
      const title = document.createElement('span')
      title.className = 'dsb-title'
      title.textContent = t('balance')
      headings.appendChild(eyebrow)
      headings.appendChild(title)
      const statusChip = document.createElement('span')
      statusChip.className = 'dsb-status'
      statusChip.setAttribute('data-state', 'loading')
      statusChip.setAttribute('aria-live', 'polite')
      const statusDot = document.createElement('i')
      statusDot.setAttribute('aria-hidden', 'true')
      const statusText = document.createElement('span')
      statusText.textContent = t('statusLoading')
      statusChip.appendChild(statusDot)
      statusChip.appendChild(statusText)
      head.appendChild(logo)
      head.appendChild(headings)
      head.appendChild(statusChip)
      card.appendChild(head)

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
      refresh.setAttribute('data-loading', 'false')
      const refreshIcon = document.createElement('span')
      refreshIcon.className = 'dsb-icon'
      refreshIcon.innerHTML = REFRESH_ICON
      const refreshLabel = document.createElement('span')
      refreshLabel.className = 'dsb-action-label'
      refreshLabel.textContent = t('refresh')
      refresh.appendChild(refreshIcon)
      refresh.appendChild(refreshLabel)
      const topUp = document.createElement('a')
      topUp.href = 'https://platform.deepseek.com/top_up'
      topUp.target = '_blank'
      topUp.rel = 'noreferrer noopener'
      const topUpIcon = document.createElement('span')
      topUpIcon.className = 'dsb-icon'
      topUpIcon.innerHTML = TOPUP_ICON
      const topUpLabel = document.createElement('span')
      topUpLabel.className = 'dsb-action-label'
      topUpLabel.textContent = t('topUp')
      topUp.appendChild(topUpIcon)
      topUp.appendChild(topUpLabel)
      actions.appendChild(refresh)
      actions.appendChild(topUp)
      card.appendChild(actions)
      host.appendChild(card)

      // Keep the material honest when the shell switches themes at runtime.
      const syncTone = () => {
        const next = detectTone()
        if (host.getAttribute('data-tone') !== next) host.setAttribute('data-tone', next)
      }
      try {
        const toneObserver = new MutationObserver(syncTone)
        toneObserver.observe(document.body, {
          attributes: true,
          attributeFilter: ['class', 'style', 'data-ds-dark-theme'],
        })
        toneObserver.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['class', 'style', 'data-theme'],
        })
        cleanups.push(() => toneObserver.disconnect())
      } catch (error) {
        /* no observer: the mount-time tone still matches the page */
      }
      try {
        if (typeof window.matchMedia === 'function') {
          const query = window.matchMedia('(prefers-color-scheme: dark)')
          const onScheme = () => syncTone()
          if (query && typeof query.addEventListener === 'function') {
            query.addEventListener('change', onScheme)
            cleanups.push(() => query.removeEventListener('change', onScheme))
          }
        }
      } catch (error) {
        /* no media query support */
      }

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
        return { value: val, label: key, line }
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
        card.setAttribute('aria-label', t('label'))
        title.textContent = t('balance')
        if (loading && !data) value.textContent = '…'
        else if (ok) writePillAmount(value, amount, data.currency)
        else value.textContent = t('empty')
        // The state chip is the card's one-glance answer: live, low, cached or
        // unreachable. Text, not just colour, so it survives colour blindness.
        const state = data === undefined ? 'loading'
          : !ok ? 'error'
            : data.stale ? 'stale'
              : low ? 'low'
                : emptyAccount ? 'empty' : 'ok'
        statusChip.setAttribute('data-state', state)
        const stateText = t('status' + state.charAt(0).toUpperCase() + state.slice(1))
        if (statusText.textContent !== stateText) statusText.textContent = stateText
        // `data` is still undefined before the first payload lands.
        const currency = data && data.currency ? data.currency : null
        writeAmount(rowTotal, ok ? data.totalBalance : null, currency)
        writeAmount(rowRecharge, ok ? data.rechargeBalance : null, currency)
        writeAmount(rowBonus, ok ? data.bonusBalance : null, currency)
        writeAmount(rowSpend, ok && typeof data.totalCost === 'number' ? data.totalCost : null, currency)
        // A six-figure balance should not push the label out of the card.
        totalRow.line.setAttribute('data-length', ok && formatPillAmount(amount, data.currency).length > 10 ? 'long' : 'normal')
        totalRow.line.setAttribute('data-empty', ok ? 'false' : 'true')
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
        refresh.disabled = loading
        refresh.setAttribute('data-loading', loading ? 'true' : 'false')
        const refreshText = t('refresh')
        if (refreshLabel.textContent !== refreshText) refreshLabel.textContent = refreshText
        const topUpText = t('topUp')
        if (topUpLabel.textContent !== topUpText) topUpLabel.textContent = topUpText
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
        if (open) {
          // Clicking the pill again gets the same zoom-out as an outside click.
          close()
          return
        }
        open = true
        paintedLanguage = document.documentElement.getAttribute('lang')
        paint()
        // Re-arm the entrance and the glass glare for this opening only.
        // The glare outlives the entrance, so it has its own switch.
        if (enterTimer !== null) clearTimeout(enterTimer)
        if (glareTimer !== null) clearTimeout(glareTimer)
        host.setAttribute('data-entering', 'true')
        host.setAttribute('data-glare', 'true')
        enterTimer = setTimeout(() => {
          enterTimer = null
          host.removeAttribute('data-entering')
        }, ENTER_MS)
        glareTimer = setTimeout(() => {
          glareTimer = null
          host.removeAttribute('data-glare')
        }, GLARE_MS)
        void read(false)
      })
      refresh.addEventListener('click', () => void read(true))
      /**
       * Close the card with a slow zoom-out.
       *
       * The attribute drives a CSS transition on the panel (scale + fade over
       * 240ms); `open` flips immediately so a quick reopen is not eaten by a
       * half-finished animation.
       */
      const CLOSE_MS = 240
      const ENTER_MS = 360
      const GLARE_MS = 1100
      let closingTimer = null
      let enterTimer = null
      let glareTimer = null
      const close = () => {
        if (!open) return
        open = false
        // Drop the entrance animation so the close transition is not held at
        // its final keyframe.
        if (enterTimer !== null) {
          clearTimeout(enterTimer)
          enterTimer = null
        }
        host.removeAttribute('data-entering')
        if (glareTimer !== null) {
          clearTimeout(glareTimer)
          glareTimer = null
        }
        host.removeAttribute('data-glare')
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
        if (enterTimer !== null) clearTimeout(enterTimer)
        if (glareTimer !== null) clearTimeout(glareTimer)
        if (closingTimer !== null) clearTimeout(closingTimer)
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
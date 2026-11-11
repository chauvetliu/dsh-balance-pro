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
    const USAGE_API_PATH = '/dsh-balance-pro/usage.json'
    const DEFAULT_CURRENCY = 'CNY'
    const DEFAULT_LOW_BALANCE = 10
    const DEFAULT_REFRESH_MINUTES = 10

    /**
     * The DeepSeek whale, traced from the Harness brand wordmark
     * (`ui-primitives/src/BrandWordmark.tsx`). One path serves the pill, the
     * card crest and the watermark, so the plugin reads as part of the shell.
     */
    const WHALE_PATH = 'M23.0584 4.95203C22.8129 4.83203 22.7074 5.06103 22.5639 5.17704C22.5149 5.21454 22.4734 5.26354 22.4319 5.30854C22.0734 5.69155 21.6543 5.94306 21.1073 5.91306C20.3073 5.86806 19.6243 6.11957 19.0203 6.73158C18.8918 5.97706 18.4652 5.52655 17.8162 5.23754C17.4767 5.08753 17.1332 4.93703 16.8952 4.61052C16.7292 4.37801 16.6837 4.11901 16.6007 3.8635C16.5477 3.70949 16.4952 3.55199 16.3177 3.52549C16.1252 3.49549 16.0497 3.65699 15.9742 3.792C15.6722 4.34401 15.5552 4.95203 15.5667 5.56805C15.5932 6.95359 16.1782 8.05712 17.3407 8.84215C17.4727 8.93215 17.5067 9.02215 17.4652 9.15366C17.3857 9.42416 17.2917 9.68667 17.2087 9.95718C17.1557 10.1297 17.0767 10.1677 16.8917 10.0922C16.2537 9.82568 15.7027 9.43117 15.2156 8.95465C14.3891 8.15513 13.6416 7.2726 12.7096 6.58158C12.4906 6.42007 12.2716 6.27007 12.045 6.12707C11.094 5.20354 12.1696 4.44502 12.4186 4.35501C12.6791 4.26101 12.5091 3.938 11.6675 3.942C10.826 3.9455 10.056 4.22751 9.07446 4.60302C8.93096 4.65952 8.77995 4.70052 8.62545 4.73452C7.73492 4.56552 6.80989 4.52802 5.84386 4.63702C4.02481 4.83953 2.57177 5.69955 1.50373 7.1676C0.220694 8.93215 -0.0813148 10.9372 0.288196 13.0283C0.676708 15.2323 1.80174 17.0569 3.53029 18.4834C5.32285 19.9625 7.38741 20.6875 9.74298 20.5485C11.1735 20.466 12.7661 20.2745 14.5626 18.7539C15.0156 18.9795 15.4912 19.0695 16.2797 19.137C16.8872 19.1935 17.4722 19.107 17.9252 19.013C18.6347 18.8629 18.5857 18.2059 18.3292 18.0854C16.2497 17.1169 16.7062 17.5109 16.2912 17.1919C17.3477 15.9419 18.9618 13.7198 19.4598 10.6942C19.5088 10.3602 19.5713 9.88968 19.5638 9.61917C19.5598 9.45417 19.5978 9.39016 19.7863 9.37116C20.3073 9.31116 20.8128 9.16866 21.2773 8.91315C22.6249 8.17713 23.1684 6.96809 23.2964 5.51905C23.3154 5.29754 23.2924 5.06853 23.0584 4.95203ZM11.3165 17.9954C9.30097 16.4109 8.32344 15.8894 7.91992 15.9119C7.54241 15.9344 7.61042 16.3664 7.69342 16.6479C7.78042 16.9259 7.89342 17.1174 8.05193 17.3614C8.16143 17.5229 8.23694 17.7629 7.94243 17.9434C7.29341 18.3449 6.16487 17.8084 6.11187 17.7819C4.79833 17.0084 3.7003 15.9874 2.92628 14.5908C2.17875 13.2468 1.74474 11.8047 1.67324 10.2657C1.65424 9.89418 1.76374 9.76267 2.13375 9.69517C2.62077 9.60517 3.12278 9.58617 3.6093 9.65767C5.66636 9.95818 7.41741 10.8777 8.88545 12.3348C9.72348 13.1643 10.3575 14.1558 11.0105 15.1243C11.705 16.1529 12.4521 17.1329 13.4036 17.9364C13.7396 18.2179 14.0076 18.4319 14.2641 18.5899C13.4906 18.6764 12.1996 18.6949 11.3165 17.9964V17.9954ZM12.2826 11.7817C12.2826 11.6167 12.4146 11.4852 12.5806 11.4852C12.6181 11.4852 12.6521 11.4927 12.6826 11.5037C12.7241 11.5187 12.7621 11.5412 12.7921 11.5752C12.8451 11.6277 12.8751 11.7027 12.8751 11.7817C12.8751 11.9467 12.7431 12.0782 12.5771 12.0782C12.4111 12.0782 12.2826 11.9467 12.2826 11.7817ZM15.2831 13.3208C15.0906 13.3998 14.8981 13.4673 14.7131 13.4748C14.4261 13.4898 14.1131 13.3733 13.9431 13.2308C13.6791 13.0093 13.4901 12.8853 13.4111 12.4988C13.3771 12.3338 13.3961 12.0782 13.4261 11.9317C13.4941 11.6162 13.4186 11.4137 13.1961 11.2297C13.0151 11.0797 12.7846 11.0382 12.5316 11.0382C12.4371 11.0382 12.3506 10.9967 12.2861 10.9632C12.1806 10.9107 12.0936 10.7792 12.1766 10.6177C12.2031 10.5652 12.3316 10.4377 12.3616 10.4152C12.7051 10.2197 13.1011 10.2837 13.4676 10.4302C13.8071 10.5692 14.0641 10.8242 14.4336 11.1847C14.8111 11.6202 14.8791 11.7402 15.0941 12.0672C15.2641 12.3228 15.4186 12.5853 15.5247 12.8858C15.5887 13.0733 15.5057 13.2268 15.2831 13.3208Z'

    /** Line icons for the compact badge, drawn on a 24px grid. */
    const ICONS = {
      // Wallet: what the number is.
      wallet: '<rect x="3" y="6" width="18" height="13" rx="3.4"/><path d="M3 10.6h18"/><circle cx="16.4" cy="14.6" r="1.15" fill="currentColor" stroke="none"/>',
      // Pulse: trend, for the usage tab's spend.
      pulse: '<path d="M3 12.5h4l2.4-6 3.4 11 2.5-7.2 1.8 2.2H21"/>',
      // Coins: spend, for the amount.
      coins: '<circle cx="9" cy="9.5" r="4.4"/><path d="M14.6 14.1a4.4 4.4 0 1 1-5.9 5.7"/>',
    }

    /**
     * One icon as inline SVG that inherits the colour and the stroke weight.
     * @param shape - key of {@link ICONS}.
     * @param size - square edge in CSS pixels.
     * @returns an `<svg>` string.
     */
    function iconSvg(shape, size) {
      return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size
        + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"'
        + ' stroke-linejoin="round" aria-hidden="true" focusable="false">' + ICONS[shape] + '</svg>'
    }

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
     * The plugin follows the **macOS system appearance** first: when the OS is
     * in light mode the card is light even if the app shell around it is dark,
     * because a dark card floating on a dark shell reads as a grey slab. The
     * shell's own marker (`body[data-ds-dark-theme]`) is only the fallback for
     * Hosts that render a web page without `prefers-color-scheme` support.
     * @returns `"dark"` or `"light"`.
     */
    function detectTone() {
      try {
        if (typeof window.matchMedia === 'function') {
          const query = window.matchMedia('(prefers-color-scheme: dark)')
          if (query && typeof query.matches === 'boolean') return query.matches ? 'dark' : 'light'
        }
      } catch (error) {
        /* no media query support: fall through to the shell marker */
      }
      try {
        return document.body && typeof document.body.hasAttribute === 'function'
          && document.body.hasAttribute('data-ds-dark-theme') ? 'dark' : 'light'
      } catch (error) {
        return 'dark'
      }
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
        tabBalance: '余额',
        tabUsage: '用量',
        kindBalance: '余额',
        kindUsage: '用量',
        today: '今日消耗',
        todayPeak: '高峰算力',
        todayOffPeak: '空闲算力',
        todayPeakShort: '高峰',
        todayOffPeakShort: '空闲',
        runway: '按今日节奏还能用 {n} 天',
        runwayShort: '余额覆盖',
        burnToday: '折算全天 {amount}',
        noRunway: '今日暂无消耗',
        peakPeak: '高峰',
        peakOffPeak: '空闲',
        peakIn: '{n} 后转{tier}',
        turnList: '逐轮消耗',
        turnEmpty: '今天还没有结算的对话',
        turnMore: '还有 {n} 轮更早的记录',
        turnPeak: '高峰',
        turnOffPeak: '空闲',
        tokensIn: '输入',
        tokensOut: '输出',
        tokensCache: '缓存',
        usageNoData: '还没有用量数据：发一轮对话后自动出现',
        usageNote: '按官方价目本地估算，仅供参考',
        tokensLegend: '↑ 输入 · ⚡ 缓存 · ↓ 输出',
        series7: '近 7 天',
        saved: '今日靠空闲时段省下 {amount}',
        hours: '{n} 小时',
        minutesShort: '{n} 分钟',
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
        tabBalance: 'Balance',
        tabUsage: 'Usage',
        kindBalance: 'Bal',
        kindUsage: 'Use',
        today: 'Spent today',
        todayPeak: 'At peak rates',
        todayOffPeak: 'At off-peak rates',
        todayPeakShort: 'Peak',
        todayOffPeakShort: 'Off-peak',
        runway: 'About {n} days left at today’s pace',
        runwayShort: 'Balance covers',
        burnToday: 'On pace for {amount}',
        noRunway: 'Nothing spent today yet',
        peakPeak: 'Peak',
        peakOffPeak: 'Off-peak',
        peakIn: '{tier} starts in {n}',
        peakInShort: '{tier} in {n}',
        turnList: 'Per turn',
        turnEmpty: 'No settled turns today',
        turnMore: '{n} earlier turns',
        turnPeak: 'Peak',
        turnOffPeak: 'Off-peak',
        tokensIn: 'in',
        tokensOut: 'out',
        tokensCache: 'cached',
        usageNoData: 'No usage yet — it appears after your first turn',
        usageNote: 'Estimated locally from the published price sheet',
        tokensLegend: '↑ input · ⚡ cached · ↓ output',
        series7: 'Last 7 days',
        saved: 'Saved {amount} by running off-peak today',
        hours: '{n} h',
        minutesShort: '{n} min',
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
      '  --dsb-panel-fill:rgba(24,27,36,.62);',
      '  --dsb-panel-shadow:0 8px 24px -18px rgba(0,0,0,.5),0 1px 2px rgba(0,0,0,.16);',
      '  --dsb-pill-shadow:0 1px 3px rgba(0,0,0,.24);',
      '  --dsb-pill-fill:rgba(28,31,40,.70);',
      '  --dsb-edge-soft:rgba(255,255,255,.07);',
      '  --dsb-glow:rgba(86,134,254,.38);',
      '  position:fixed;right:16px;bottom:44px;z-index:900;display:inline-flex;align-items:flex-end;',
      '  font:inherit;color:var(--dsb-text);-webkit-font-smoothing:antialiased;',
      '}',
      '#dsh-balance-pro[data-tone="light"]{',
      '  --dsb-text:#17181c;',
      '  --dsb-muted:#5a616e;',
      '  --dsb-faint:#7c838f;',
      '  --dsb-line:rgba(15,17,21,.10);',
      '  --dsb-line-strong:rgba(15,17,21,.16);',
      '  --dsb-accent:#2f5fd0;',
      '  --dsb-brand:#2f5fd0;--dsb-brand-2:#5b86e8;',
      '  --dsb-ok:#178a5c;--dsb-warn:#a56a12;--dsb-danger:#d64545;',
      '  --dsb-surface:#f2f5fa;',
      '  --dsb-panel-fill:rgba(255,255,255,.58);',
      '  --dsb-panel-shadow:0 8px 22px -18px rgba(24,45,95,.22),0 1px 2px rgba(24,45,95,.06);',
      '  --dsb-pill-shadow:0 1px 2px rgba(24,45,95,.08);',
      '  --dsb-pill-fill:rgba(255,255,255,.62);',
      '  --dsb-edge:rgba(255,255,255,.8);',
      '  --dsb-edge-soft:rgba(15,17,21,.08);',
      '  --dsb-glow:rgba(65,118,230,.16);',
      '}',
      '#dsh-balance-pro,#dsh-balance-pro *{box-sizing:border-box}',
      '#dsh-balance-pro[data-tone="dark"]{color-scheme:dark;--dsb-brand:var(--dsw-static-deepseek-450,#5686fe);--dsb-brand-2:var(--dsw-static-deepseek-300,#b7c8fe)}',
      '#dsh-balance-pro[data-tone="light"]{color-scheme:light}',
      '@keyframes dsb-in{0%{opacity:0;transform:translateY(4px)}100%{opacity:1;transform:none}}62%{opacity:1;transform:translateY(-1px) scale(1.004)}100%{opacity:1;transform:none}}',
      '@keyframes dsb-in-down{0%{opacity:0;transform:translateY(-4px)}100%{opacity:1;transform:none}}62%{opacity:1;transform:translateY(1px) scale(1.004)}100%{opacity:1;transform:none}}',
      '@keyframes dsb-breathe{0%,100%{opacity:.55;box-shadow:0 0 0 0 var(--dsb-glow)}50%{opacity:1;box-shadow:0 0 0 4px transparent}}',
      '@keyframes dsb-spin{to{transform:rotate(360deg)}}',
      '@keyframes dsb-glare{0%{opacity:0;transform:translateX(-135%)}18%{opacity:.9}100%{opacity:0;transform:translateX(135%)}}',
      '.dsb-pill{',
      '  position:relative;display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 8px 0 3px;',
      '  border-radius:8px;cursor:pointer;isolation:isolate;overflow:hidden;-webkit-appearance:none;appearance:none;margin:0;',
      '  border:1px solid var(--dsb-line-strong);',
      '  background:var(--dsb-pill-fill);',
      '  color:var(--dsb-text);font:inherit;font-size:10.5px;line-height:1;white-space:nowrap;',
      '  backdrop-filter:blur(12px) saturate(1.1);-webkit-backdrop-filter:blur(12px) saturate(1.1);',
      '  box-shadow:var(--dsb-pill-shadow);',
      '  transition:border-color .2s ease,background .2s ease,transform .2s cubic-bezier(.2,.8,.2,1);',
      '}',
      '.dsb-pill::before{display:none}',
      '.dsb-pill:hover{',
      '  border-color:color-mix(in srgb,var(--dsb-accent) 40%,var(--dsb-line-strong));',
      '  background:color-mix(in srgb,var(--dsb-accent) 6%,var(--dsb-pill-fill));',
      '}',
      '.dsb-pill:active{transform:scale(.97)}',
      '.dsb-pill:focus-visible{outline:2px solid var(--dsb-accent);outline-offset:2px}',
      '.dsb-kind{',
      '  position:relative;z-index:1;display:inline-flex;align-items:center;justify-content:center;',
      '  width:18px;height:18px;flex:none;border-radius:5px;',
      '  color:var(--dsb-brand-2);background:color-mix(in srgb,var(--dsb-brand) 20%,transparent);',
      '}',
      '.dsb-kind svg{display:block}',
      '#dsh-balance-pro[data-tone="light"] .dsb-kind{color:var(--dsb-brand);background:rgba(47,95,208,.12)}',
      '.dsb-number{position:relative;z-index:1;display:inline-flex;align-items:baseline;font-variant-numeric:tabular-nums;font-weight:620;letter-spacing:-.015em}',
      '.dsb-sym{font-size:9px;font-weight:600;opacity:.62;margin-right:1px;letter-spacing:0}',
      '.dsb-num{font-size:10.5px}',
      '.dsb-number[data-compact="true"] .dsb-num{letter-spacing:-.02em}',
      '.dsb-number[data-missing="true"] .dsb-num{font-weight:500;letter-spacing:0;color:var(--dsb-muted)}',
      '.dsb-alert{position:absolute;top:2px;right:2px;width:4px;height:4px;border-radius:50%;background:var(--dsb-danger);box-shadow:0 0 0 1.5px var(--dsb-surface);z-index:2}',
      '.dsb-alert[hidden]{display:none}',
      '.dsb-pill[data-warn="true"]{border-color:color-mix(in srgb,var(--dsb-warn) 45%,var(--dsb-line-strong))}',
      '.dsb-pill[data-warn="true"] .dsb-alert{background:var(--dsb-warn)}',
      '.dsb-panel{',
      '  position:absolute;bottom:calc(100% + 10px);right:0;left:auto;width:300px;padding:15px 15px 13px;',
      '  border-radius:20px;border:1px solid var(--dsb-edge-soft);',
      '  background:var(--dsb-panel-fill);',
      '  color:var(--dsb-text);font-size:12px;line-height:1.5;text-align:left;isolation:isolate;overflow:hidden;',
      '  backdrop-filter:blur(28px) saturate(1.35);-webkit-backdrop-filter:blur(28px) saturate(1.35);',
      '  box-shadow:var(--dsb-panel-shadow),0 0 0 .5px color-mix(in srgb,var(--dsb-text) 10%,transparent);',
      '  transform-origin:right bottom;opacity:1;transform:none;',
      '  transition:opacity .22s ease,transform .22s cubic-bezier(.4,0,.2,1);',
      '}',
      '#dsh-balance-pro[data-anchor="left"] .dsb-panel{left:0;right:auto;transform-origin:left bottom}',
      '#dsh-balance-pro[data-flip="true"] .dsb-panel{top:calc(100% + 10px);bottom:auto;transform-origin:right top}',
      '#dsh-balance-pro[data-flip="true"][data-anchor="left"] .dsb-panel{transform-origin:left top}',
      '#dsh-balance-pro[data-entering="true"] .dsb-panel{animation:dsb-in .2s ease-out both}',
      '#dsh-balance-pro[data-entering="true"][data-flip="true"] .dsb-panel{animation-name:dsb-in-down}',
      '#dsh-balance-pro[data-closing="true"] .dsb-panel{opacity:0;transform:scale(.97) translateY(2px);transition-duration:.18s}',
      '.dsb-glare{display:none}',
      '#dsh-balance-pro[data-glare="true"] .dsb-glare{display:none}',
      '.dsb-scene{display:none}',
      '.dsb-scene::before{display:none}',
      '.dsb-scene::after{display:none}',
      '.dsb-whale{display:none}',
      '.dsb-scrim{display:none}',
      '#dsh-balance-pro[data-glare="true"] .dsb-glare{animation:dsb-glare 1.05s cubic-bezier(.3,.6,.3,1) .06s both}',
      '.dsb-panel::before{background:linear-gradient(148deg,rgba(255,255,255,1),rgba(255,255,255,.7) 22%,rgba(255,255,255,.1) 46%,rgba(65,118,230,.14));}',
      '#dsh-balance-pro[data-tone="light"] .dsb-panel{',
      '  backdrop-filter:blur(20px) saturate(1.05);-webkit-backdrop-filter:blur(20px) saturate(1.05);',
      '  box-shadow:var(--dsb-panel-shadow),0 0 0 .5px rgba(15,17,21,.06);',
      '}',
      '#dsh-balance-pro[data-tone="light"] .dsb-status{background:rgba(15,17,21,.045);border-color:rgba(15,17,21,.07)}',
      '#dsh-balance-pro[data-tone="light"] .dsb-status i{box-shadow:none}',
      '#dsh-balance-pro[data-tone="light"] .dsb-tabs{background:rgba(15,17,21,.045);border-color:rgba(15,17,21,.06)}',
      '#dsh-balance-pro[data-tone="light"] .dsb-tab[aria-selected="true"]{background:#fff}',
      '#dsh-balance-pro[data-tone="light"] .dsb-tier{background:rgba(255,255,255,.72);border-color:rgba(15,17,21,.07)}',
      '#dsh-balance-pro[data-tone="light"] .dsb-actions>button{background:rgba(255,255,255,.66)}',
      '#dsh-balance-pro[data-tone="light"] .dsb-peak{color:var(--dsb-muted)}',
      '.dsb-head,.dsb-rows,.dsb-meta,.dsb-actions{position:relative;z-index:1}',
      '.dsb-head{display:flex;align-items:center;gap:9px;margin-bottom:13px}',
      '.dsb-logo{width:29px;height:29px;flex:none;border-radius:9px;display:grid;place-items:center;',
      '  background:var(--dsb-brand);color:#fff;',
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
      '.dsb-total dd{font-size:27px;font-weight:650;line-height:1.05;letter-spacing:-.035em;color:var(--dsb-text)}',
      '.dsb-total[data-length="long"] dd{font-size:21px;letter-spacing:-.03em}',
      '.dsb-total[data-empty="true"] dd{font-size:18px;font-weight:500;letter-spacing:0;color:var(--dsb-muted);text-shadow:none}',
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
      '  border-radius:11px;border:1px solid var(--dsb-line-strong);background:rgba(255,255,255,.06);color:var(--dsb-text);',
      '  font:inherit;font-size:11.5px;font-weight:500;text-decoration:none;cursor:pointer;',
      '  transition:background .18s ease,border-color .18s ease,transform .18s ease}',
      '.dsb-actions>button:hover{border-color:color-mix(in srgb,var(--dsb-accent) 45%,var(--dsb-line-strong));background:color-mix(in srgb,var(--dsb-accent) 9%,rgba(255,255,255,.05))}',
      '.dsb-actions>button:active,.dsb-actions>a:active{transform:scale(.985)}',
      '.dsb-actions>button:focus-visible,.dsb-actions>a:focus-visible{outline:2px solid var(--dsb-accent);outline-offset:1px}',
      '.dsb-actions>button:disabled{opacity:.55;cursor:default}',
      '.dsb-actions>a{border-color:transparent;background:var(--dsb-brand);color:#fff;font-weight:550}',
      '.dsb-actions>a:hover{background:var(--dsb-brand-2)}',
      '.dsb-actions svg{width:12px;height:12px;flex:none;opacity:.9}',
      '.dsb-icon{display:inline-flex;align-items:center;justify-content:center;flex:none}',
      '.dsb-action-label{line-height:1}',
      '.dsb-actions>button[data-loading="true"] .dsb-icon{display:none}',
      '.dsb-actions>button[data-loading="true"]::before{content:"";width:11px;height:11px;border-radius:50%;border:1.6px solid currentColor;border-right-color:transparent;animation:dsb-spin .7s linear infinite}',
      '@media (prefers-reduced-motion:reduce){',
      '  .dsb-panel{transition:none;animation:none!important}',
      '  #dsh-balance-pro[data-closing="true"] .dsb-panel{transform:none}',
      '  .dsb-status i{animation:none}',
      '  .dsb-pill[data-loading="true"]{animation:none}',
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
      '.dsb-tabs{position:relative;z-index:1;display:flex;gap:3px;margin:0 0 12px;padding:3px;border-radius:11px;',
      '  background:rgba(255,255,255,.05);border:1px solid var(--dsb-line)}',
      '#dsh-balance-pro[data-tone="light"] .dsb-tabs{background:rgba(255,255,255,.5);border-color:rgba(15,17,21,.06)}',
      '.dsb-tab{flex:1;height:26px;border:0;border-radius:8px;background:transparent;color:var(--dsb-muted);',
      '  font:inherit;font-size:11.5px;font-weight:500;cursor:pointer;transition:background .18s ease,color .18s ease,box-shadow .18s ease}',
      '.dsb-tab:hover{color:var(--dsb-text)}',
      '.dsb-tab[aria-selected="true"]{color:var(--dsb-text);background:rgba(255,255,255,.12);',
      '  box-shadow:0 1px 0 rgba(255,255,255,.18) inset,0 1px 4px rgba(0,0,0,.22)}',
      '#dsh-balance-pro[data-tone="light"] .dsb-tab[aria-selected="true"]{background:#fff;box-shadow:0 1px 3px rgba(24,45,95,.16)}',
      '.dsb-tab:focus-visible{outline:2px solid var(--dsb-accent);outline-offset:1px}',
      '.dsb-body[hidden]{display:none!important}',
      '.dsb-today{position:relative;z-index:1;display:grid;grid-template-columns:46px 1fr;grid-template-areas:"ring main" "chips chips";',
      '  gap:6px 12px;align-items:center;padding:4px 0 12px;border-bottom:1px solid color-mix(in srgb,var(--dsb-line) 80%,transparent)}',
      '.dsb-ring{grid-area:ring;position:relative;width:44px;height:44px;--dsb-progress:0}',
      '.dsb-ring-art{position:absolute;inset:0}',
      '.dsb-ring svg{transform:rotate(-90deg);overflow:visible}',
      '.dsb-ring circle{fill:none;stroke-width:3.4}',
      '.dsb-ring-track{stroke:color-mix(in srgb,var(--dsb-text) 12%,transparent)}',
      '.dsb-ring-arc{stroke:var(--dsb-brand-2);stroke-linecap:round;stroke-dasharray:113.1;transition:stroke-dashoffset .5s cubic-bezier(.2,.8,.2,1)}',
      '.dsb-ring{--dsb-circ:113.1}',
      '.dsb-ring .dsb-ring-arc{stroke-dashoffset:calc(var(--dsb-circ) * (1 - var(--dsb-progress)))}',
      '.dsb-ring[data-level="high"] .dsb-ring-arc{stroke:var(--dsb-warn)}',
      '.dsb-ring[data-empty="true"] .dsb-ring-arc{stroke:transparent}',
      '.dsb-ring-center{position:absolute;inset:0;display:grid;place-items:center;font-size:10px;font-weight:600;color:var(--dsb-text);font-variant-numeric:tabular-nums}',
      '.dsb-ring[data-empty="true"] .dsb-ring-center{display:none}',
      '.dsb-today-main{grid-area:main;display:flex;flex-direction:column;gap:2px;min-width:0}',
      '.dsb-today-label{font-size:10.5px;color:var(--dsb-faint);letter-spacing:.02em}',
      '.dsb-today-amount{font-size:21px;font-weight:650;letter-spacing:-.03em;color:var(--dsb-text);font-variant-numeric:tabular-nums;line-height:1.1}',
      '.dsb-today-sub{font-size:10px;color:var(--dsb-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.dsb-tiers{grid-area:chips;display:flex;gap:6px;margin-top:2px}',
      '.dsb-tier{display:inline-flex;align-items:center;gap:4px;height:21px;min-width:0;padding:0 8px;border-radius:7px;font-size:10px;font-weight:500;color:var(--dsb-muted);white-space:nowrap;',
      '  background:rgba(255,255,255,.06);border:1px solid var(--dsb-line)}',
      '#dsh-balance-pro[data-tone="light"] .dsb-tier{background:rgba(255,255,255,.55)}',
      '.dsb-tier-label{min-width:0;overflow:hidden;text-overflow:ellipsis}',
      '.dsb-tier-amount{color:var(--dsb-text);font-weight:600;font-variant-numeric:tabular-nums;flex:none}',
      '.dsb-tier::before{content:"";width:5px;height:5px;border-radius:50%;background:currentColor;flex:none}',
      '.dsb-tier-peak{color:var(--dsb-warn);border-color:color-mix(in srgb,var(--dsb-warn) 22%,transparent)}',
      '.dsb-tier-off{color:var(--dsb-ok);border-color:color-mix(in srgb,var(--dsb-ok) 22%,transparent)}',
      '.dsb-peak{position:relative;z-index:1;display:flex;align-items:center;gap:7px;margin:9px 0 2px;font-size:10.5px;color:var(--dsb-muted)}',
      '.dsb-peak i{width:6px;height:6px;border-radius:50%;background:var(--dsb-ok);flex:none;animation:dsb-breathe 3.2s ease-in-out infinite}',
      '.dsb-peak[data-peak="true"] i{background:var(--dsb-warn);animation:none}',
      '.dsb-peak-now{color:var(--dsb-text);font-weight:500}',
      '.dsb-peak[data-peak="true"] .dsb-peak-now{color:var(--dsb-warn)}',
      '.dsb-peak-next{margin-left:auto;color:var(--dsb-faint)}',
      '.dsb-spark{position:relative;z-index:1;display:flex;align-items:flex-end;gap:5px;height:34px;margin:6px 0 2px;padding:0 2px}',
      '.dsb-spark i{flex:1;max-width:30px;border-radius:4px 4px 2px 2px;background:color-mix(in srgb,var(--dsb-brand-2) 20%,transparent);transition:background .2s ease}',
      '.dsb-spark-labels{position:relative;z-index:1;display:flex;gap:5px;padding:0 2px;margin-bottom:9px}',
      '.dsb-spark-labels span{flex:1;max-width:30px;text-align:center;font-size:9px;line-height:1.15;color:var(--dsb-faint);white-space:nowrap}',
      '.dsb-spark i[data-empty="true"]{background:color-mix(in srgb,var(--dsb-text) 10%,transparent)}',
      '.dsb-spark i[data-today="true"]{background:var(--dsb-brand-2)}',
      '.dsb-spark-labels span[data-today="true"]{color:var(--dsb-brand-2);font-weight:600}',
      '#dsh-balance-pro[data-tone="light"] .dsb-spark i{background:rgba(65,118,230,.22)}',
      '#dsh-balance-pro[data-tone="light"] .dsb-spark i[data-empty="true"]{background:rgba(15,17,21,.07)}',
      '#dsh-balance-pro[data-tone="light"] .dsb-spark i[data-today="true"]{background:#4176e6;box-shadow:none}',
      '.dsb-turn-head{position:relative;z-index:1;display:flex;align-items:baseline;gap:8px;font-size:10px;color:var(--dsb-faint);margin-bottom:4px}',
      '.dsb-turn-legend{color:var(--dsb-faint);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}',
      '.dsb-turn-legend[hidden]{display:none}',
      '.dsb-turn-note{margin-left:auto}',
      '.dsb-turns{position:relative;z-index:1;list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:1px}',
      '.dsb-turn{display:grid;grid-template-columns:56px 1fr auto;gap:8px;align-items:center;height:25px;border-radius:6px;font-size:10px;color:var(--dsb-muted)}',
      '.dsb-turn:hover{background:rgba(255,255,255,.05)}',
      '.dsb-turn-time{display:flex;align-items:center;gap:5px;font-variant-numeric:tabular-nums;color:var(--dsb-faint);white-space:nowrap}',
      '.dsb-turn-time::before{content:"";width:5px;height:5px;border-radius:50%;flex:none;background:var(--dsb-ok)}',
      '.dsb-turn[data-tier="peak"] .dsb-turn-time::before{background:var(--dsb-warn)}',
      '.dsb-turn-tokens{color:var(--dsb-faint);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.dsb-turn-amount{font-variant-numeric:tabular-nums;color:var(--dsb-text);font-weight:600}',
      '.dsb-turn[data-tier="peak"] .dsb-turn-amount{color:color-mix(in srgb,var(--dsb-warn) 82%,var(--dsb-text))}',
      '.dsb-turn[data-tier="off"] .dsb-turn-amount{color:color-mix(in srgb,var(--dsb-ok) 62%,var(--dsb-text))}',
      '.dsb-turn-empty{padding:6px 2px;font-size:10px;color:var(--dsb-faint)}',
      '.dsb-usage-note{position:relative;z-index:1;margin-top:7px;font-size:9.5px;color:var(--dsb-faint);text-align:right}',
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
    /**
     * Whether chip captions take their short form.
     *
     * The card is a fixed 300px wide, and the English captions ("At off-peak
     * rates") are twice the Chinese ones ("空闲算力"); both must still fit one
     * line next to the amount, so English uses the short pair.
     * @returns true when the active dictionary is not Chinese.
     */
    function shortLabels() {
      return currentTable() !== DICT.zh
    }

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
      if (typeof value !== 'number' || !Number.isFinite(value)) return { symbol: '', number: '—', code: '' }
      // Escapes, not literals: a quoted dollar sign inside an inline script
      // element reads as a tag marker and truncates it.
      const symbol = currency === 'USD' ? '\u0024' : '\u00a5'
      const abs = Math.abs(value)
      // Money keeps its cents; above a thousand the decimals are grouped as
      // they always were. Above a million the badge would not fit the sidebar
      // row, so the number is abbreviated instead: nothing is dropped, and the
      // exact amount stays in the tooltip and in the card.
      const code = typeof currency === 'string' && currency !== '' ? currency.toUpperCase() : ''
      if (abs >= 1_000_000) return { symbol, number: compactAmount(value, abs), code, compact: true }
      // "¥1,234.5" beats "¥1,234.50" in a 24px-tall pill; ¥95.02 keeps both.
      const number = trimCent(groupMoney(value))
      return { symbol, number, code }
    }

    /**
     * Group an amount with thousands separators and exactly two decimals.
     * @param value - signed amount.
     * @returns e.g. `1,234.50`.
     */
    function groupMoney(value) {
      const hundredths = Math.round(Math.abs(value) * 100)
      const whole = Math.floor(hundredths / 100)
      const cents = String(hundredths % 100).padStart(2, '0')
      const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/gu, ',')
      return (value < 0 ? '-' : '') + grouped + '.' + cents
    }

    /**
     * Compact form for amounts the pill cannot fit: `9.99m`, `12.4b`, `1.2t`.
     *
     * Rounded in integer hundredths of the unit so 9,999,999.99 reads `10m`
     * only when it truly rounds there — and the exact amount is still in the
     * tooltip and in the card, so nothing is lost.
     * @param value - signed amount.
     * @param abs - its absolute value.
     * @returns e.g. `12.4m`.
     */
    function compactAmount(value, abs) {
      const units = [[1e12, 't'], [1e9, 'b'], [1e6, 'm']]
      for (const [scale, suffix] of units) {
        if (abs < scale) continue
        if (abs >= scale * 1e6) continue
        const hundredths = Math.round(abs * 100 / scale)
        const whole = Math.floor(hundredths / 100)
        const cents = String(hundredths % 100).padStart(2, '0')
        // One decimal is enough once the number is wide; two below 10.
        const kept = whole >= 10 ? cents.charAt(0) : cents.charAt(1) === '0' ? cents.charAt(0) : cents
        const shown = kept === '0' || kept === '00' ? String(whole) : whole + '.' + kept
        return (value < 0 ? '-' : '') + shown + suffix
      }
      return (value < 0 ? '-' : '') + groupMoney(abs)
    }

    /**
     * Drop one trailing zero of the cents: `1,234.50` → `1,234.5`, `95.02`
     * untouched. Done with string slicing rather than a `$1` replacement, which
     * a client bundle would have to quote-escape.
     * @param text - grouped amount with two decimals.
     * @returns the trimmed amount.
     */
    function trimCent(text) {
      if (typeof text !== 'string' || text.length < 4) return text
      // Only the second decimal may go: .10 -> .1, but .00 stays .00 so whole
      // amounts keep their money shape.
      const second = text.charAt(text.length - 1)
      const first = text.charAt(text.length - 2)
      const dot = text.charAt(text.length - 3)
      if (dot !== '.' || second !== '0' || first === '0') return text
      return text.slice(0, text.length - 1)
    }

    /**
     * The full amount for tooltips: never abbreviated, so a badge showing
     * `¥10m` still lets the user hover to read `¥9,999,999.99`.
     * @param value - finite number or null.
     * @param currency - ISO code.
     * @returns e.g. `¥9,999,999.99 CNY`.
     */
    function formatExactAmount(value, currency) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
      const symbol = currency === 'USD' ? '\u0024' : '\u00a5'
      const code = typeof currency === 'string' && currency !== '' ? currency.toUpperCase() : ''
      const exact = symbol + groupMoney(value)
      return code === '' ? exact : exact + ' ' + code
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
      const { symbol, number, compact } = amountParts(value, currency)
      const unit = document.createElement('span')
      unit.className = 'dsb-sym'
      unit.textContent = symbol
      const digits = document.createElement('span')
      digits.className = 'dsb-num'
      digits.textContent = number
      if (compact) target.setAttribute('data-compact', 'true')
      else target.removeAttribute('data-compact')
      // Clear first: a test double's replaceChildren does not drop own text.
      target.textContent = ''
      target.replaceChildren(unit, digits)
      target.setAttribute('data-missing', typeof value === 'number' && Number.isFinite(value) ? 'false' : 'true')
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
      if (!Number.isFinite(then)) return ''
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
     * One read of a Host route, relative first and the shell transport second.
     *
     * Both routes go through here: `balance.json` (the wallet) and
     * `usage.json` (the local ledger). The Host is the only reader of the
     * platform — it owns the API key (or the DSH account session when there is
     * no key), and the desktop shell forwards a relative path to it with its
     * cookie, which is the one request the Host fence always accepts.
     * @param path - route path.
     * @param force - bypass the Host cache (subject to its cooldown).
     * @returns Promise of the payload, or `{ ok: false, code, error }`.
     */
    async function readRoute(path, force) {
      status.reads += 1
      const query = force ? '?force=1' : ''
      const bases = ['', fallbackOrigin()]
      let lastError = ''
      for (const base of bases) {
        const url = base + path + query
        status.lastUrl = url
        try {
          // The route answers without credentials on loopback; the shell's own
          // forwarding supplies the cookie when the page is dsh-app://app.
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

    /** One balance read. */
    function fetchBalance(force) {
      return readRoute(API_PATH, force)
    }

    /** Money with more decimals the smaller it is: ¥0.0038 still reads. */
    function formatSmall(value, currency) {
      const { symbol } = amountParts(0, currency)
      if (typeof value !== 'number' || !Number.isFinite(value)) return symbol + '—'
      let digits = 2
      if (value > 0 && value < 0.01) digits = 3
      else if (value > 0 && value < 1) digits = 3
      try {
        return symbol + value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })
      } catch (error) {
        return symbol + value.toFixed(digits)
      }
    }

    /** Compact token counts: 12.3k, 1.2M. */
    function formatTokens(value) {
      const n = Number(value) || 0
      if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/u, '') + 'M'
      if (n >= 1000) return (n / 1000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/u, '') + 'k'
      return String(Math.round(n))
    }

    /** Minutes → "1 小时 20 分钟" style copy. */
    function formatDuration(minutes) {
      const total = Math.max(0, Math.round(Number(minutes) || 0))
      if (total < 60) return t('minutesShort', { n: total })
      const hours = Math.floor(total / 60)
      const rest = total % 60
      return rest === 0 ? t('hours', { n: hours }) : t('hours', { n: hours }) + ' ' + t('minutesShort', { n: rest })
    }

    /** Runway target for the ring: today's burn against the wallet. */
    function runwayText(usage, currency) {
      const runway = usage && usage.runway
      if (!runway) return t('noRunway')
      const days = runway.days >= 10 ? runway.days.toFixed(0) : runway.days.toFixed(1)
      return t('runway', { n: days })
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
      // Badge layout: a tinted wallet square (what the number is), then the
      // amount. The square swaps to a pulse on the usage tab, so the badge
      // still says which figure it shows without spending width on a word.
      const kind = document.createElement('span')
      kind.className = 'dsb-kind'
      kind.setAttribute('aria-hidden', 'true')
      kind.innerHTML = iconSvg('wallet', 13)
      const value = document.createElement('span')
      value.className = 'dsb-number'
      value.textContent = '…'
      const alertDot = document.createElement('span')
      alertDot.className = 'dsb-alert'
      alertDot.setAttribute('aria-hidden', 'true')
      button.appendChild(kind)
      button.appendChild(value)
      button.appendChild(alertDot)
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

      // Two tabs share the card body: the wallet (default) and the local
      // usage ledger. Each body is built once and only switched by `hidden`.
      const bodyBalance = document.createElement('div')
      bodyBalance.className = 'dsb-body dsb-body-balance'
      const rows = document.createElement('dl')
      rows.className = 'dsb-rows'
      bodyBalance.appendChild(rows)
      // Updated-at and the masked account live under the total, inside the
      // same <dl> as the quiet rows they belong to.
      const meta = document.createElement('div')
      meta.className = 'dsb-meta'
      bodyBalance.appendChild(meta)

      const bodyUsage = document.createElement('div')
      bodyUsage.className = 'dsb-body dsb-body-usage'
      bodyUsage.hidden = true

      // ── usage body: today card, peak chip, sparkline, turn list ───────────
      const todayCard = document.createElement('div')
      todayCard.className = 'dsb-today'
      const ring = document.createElement('div')
      ring.className = 'dsb-ring'
      ring.setAttribute('data-empty', 'true')
      // The progress ring is real SVG, but its geometry lives on CSS custom
      // properties so the arc can be animated without touching the document.
      const ringSvg = document.createElement('span')
      ringSvg.className = 'dsb-ring-art'
      ringSvg.setAttribute('aria-hidden', 'true')
      ringSvg.innerHTML = '<svg viewBox="0 0 44 44" width="44" height="44">'
        + '<circle class="dsb-ring-track" cx="22" cy="22" r="18"/>'
        + '<circle class="dsb-ring-arc" cx="22" cy="22" r="18"/></svg>'
      const ringCenter = document.createElement('span')
      ringCenter.className = 'dsb-ring-center'
      ring.appendChild(ringSvg)
      ring.appendChild(ringCenter)
      const todayMain = document.createElement('div')
      todayMain.className = 'dsb-today-main'
      const todayLabel = document.createElement('span')
      todayLabel.className = 'dsb-today-label'
      todayLabel.textContent = t('today')
      const todayAmount = document.createElement('span')
      todayAmount.className = 'dsb-today-amount'
      todayAmount.textContent = '—'
      const todaySub = document.createElement('span')
      todaySub.className = 'dsb-today-sub'
      todayMain.appendChild(todayLabel)
      todayMain.appendChild(todayAmount)
      todayMain.appendChild(todaySub)
      const tierChips = document.createElement('div')
      tierChips.className = 'dsb-tiers'
      const peakChip = document.createElement('span')
      peakChip.className = 'dsb-tier dsb-tier-peak'
      const peakChipLabel = document.createElement('span')
      peakChipLabel.className = 'dsb-tier-label'
      const peakChipValue = document.createElement('span')
      peakChipValue.className = 'dsb-tier-amount'
      peakChip.appendChild(peakChipLabel)
      peakChip.appendChild(peakChipValue)
      const offChip = document.createElement('span')
      offChip.className = 'dsb-tier dsb-tier-off'
      const offChipLabel = document.createElement('span')
      offChipLabel.className = 'dsb-tier-label'
      const offChipValue = document.createElement('span')
      offChipValue.className = 'dsb-tier-amount'
      offChip.appendChild(offChipLabel)
      offChip.appendChild(offChipValue)
      tierChips.appendChild(peakChip)
      tierChips.appendChild(offChip)
      todayCard.appendChild(ring)
      todayCard.appendChild(todayMain)
      todayCard.appendChild(tierChips)
      bodyUsage.appendChild(todayCard)

      const peakRow = document.createElement('div')
      peakRow.className = 'dsb-peak'
      peakRow.setAttribute('data-peak', 'false')
      const peakDot = document.createElement('i')
      peakDot.setAttribute('aria-hidden', 'true')
      const peakNow = document.createElement('span')
      peakNow.className = 'dsb-peak-now'
      const peakNext = document.createElement('span')
      peakNext.className = 'dsb-peak-next'
      peakRow.appendChild(peakDot)
      peakRow.appendChild(peakNow)
      peakRow.appendChild(peakNext)
      bodyUsage.appendChild(peakRow)

      const spark = document.createElement('div')
      spark.className = 'dsb-spark'
      spark.setAttribute('aria-hidden', 'true')
      bodyUsage.appendChild(spark)
      const sparkLabels = document.createElement('div')
      sparkLabels.className = 'dsb-spark-labels'
      sparkLabels.setAttribute('aria-hidden', 'true')
      bodyUsage.appendChild(sparkLabels)

      const turnHead = document.createElement('div')
      turnHead.className = 'dsb-turn-head'
      const turnTitle = document.createElement('span')
      turnTitle.textContent = t('turnList')
      // Explains the arrow form of the token column; empty in Chinese.
      const turnLegend = document.createElement('span')
      turnLegend.className = 'dsb-turn-legend'
      const turnNote = document.createElement('span')
      turnNote.className = 'dsb-turn-note'
      turnHead.appendChild(turnTitle)
      turnHead.appendChild(turnLegend)
      turnHead.appendChild(turnNote)
      bodyUsage.appendChild(turnHead)
      const turnList = document.createElement('ul')
      turnList.className = 'dsb-turns'
      bodyUsage.appendChild(turnList)
      const usageNote = document.createElement('div')
      usageNote.className = 'dsb-usage-note'
      usageNote.textContent = t('usageNote')
      bodyUsage.appendChild(usageNote)

      const tabs = document.createElement('div')
      tabs.className = 'dsb-tabs'
      tabs.setAttribute('role', 'tablist')
      const tabButtons = {}
      for (const key of ['balance', 'usage']) {
        const tab = document.createElement('button')
        tab.type = 'button'
        tab.className = 'dsb-tab'
        tab.setAttribute('role', 'tab')
        tab.setAttribute('data-tab', key)
        tab.textContent = t(key === 'balance' ? 'tabBalance' : 'tabUsage')
        tab.setAttribute('aria-selected', key === 'balance' ? 'true' : 'false')
        tabs.appendChild(tab)
        tabButtons[key] = tab
      }
      card.appendChild(tabs)
      card.appendChild(bodyBalance)
      card.appendChild(bodyUsage)
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
          // Both queries: macOS can flip either when the user switches
          // appearance, and the shell may also force one of them.
          for (const [name, onScheme] of [
            ['(prefers-color-scheme: dark)', () => syncTone()],
            ['(prefers-color-scheme: light)', () => syncTone()],
          ]) {
            const query = window.matchMedia(name)
            if (query && typeof query.addEventListener === 'function') {
              query.addEventListener('change', onScheme)
              cleanups.push(() => query.removeEventListener('change', onScheme))
            }
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
      let usage
      let usageLoading = false
      let activeTab = 'balance'
      let loading = true
      let open = false

      function paint() {
        // Re-check the OS appearance on every paint as well: `paint` also runs
        // when the page mutates, and a missed media-query event must not leave
        // a light OS looking at a dark card.
        const tone = detectTone()
        if (host.getAttribute('data-tone') !== tone) host.setAttribute('data-tone', tone)
        const ok = !!(data && data.ok)
        const amount = ok ? data.totalBalance : null
        const low = ok && typeof data.lowBalanceThreshold === 'number' && amount !== null && amount < data.lowBalanceThreshold
        const emptyAccount = ok && data.isAvailable === false
        button.title = t('label')
          + (ok ? ' · ' + formatExactAmount(amount, data.currency) : data ? ' · ' + describeError(data) : ' · ' + t('loading'))
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
        if (loading && !data) {
          value.textContent = '…'
          value.setAttribute('data-missing', 'true')
        } else if (ok) {
          writePillAmount(value, amount, data.currency)
        } else {
          value.textContent = '—'
          value.setAttribute('data-missing', 'true')
        }
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
          const lineNode = document.createElement('div')
          lineNode.className = 'dsb-meta-line'
          lineNode.textContent = line
          meta.appendChild(lineNode)
        }
        meta.setAttribute('data-tone', ok ? 'info' : 'error')
        card.hidden = !open
        paintUsage()
        // Re-translate static copy: the page language can change after mount.
        for (const cell of [totalRow, rechargeRow, bonusRow, spendRow]) {
          const key = (cell.label.dataset && cell.label.dataset.labelKey) || cell.label.getAttribute('data-label-key')
          if (!key) continue
          const text = t(key)
          if (cell.label.textContent !== text) cell.label.textContent = text
        }
        refresh.disabled = loading
        refresh.setAttribute('data-loading', loading && activeTab === 'balance' ? 'true' : 'false')
        tabButtons.balance.setAttribute('data-busy', loading ? 'true' : 'false')
        const refreshText = t('refresh')
        if (refreshLabel.textContent !== refreshText) refreshLabel.textContent = refreshText
        const topUpText = t('topUp')
        if (topUpLabel.textContent !== topUpText) topUpLabel.textContent = topUpText
      }

      /**
       * Paint the usage tab from the last `usage.json` body.
       *
       * Everything here is optional: before the first read the body keeps its
       * skeleton, and a ledger with no turns says so in words.
       */
      function paintUsage() {
        try {
          paintUsageBody()
        } catch (error) {
          // A malformed usage payload must not take the balance tab with it.
          status.usageError = String((error && error.message) || error)
        }
      }

      /** The usage body itself; {@link paintUsage} guards it. */
      function paintUsageBody() {
        const currency = (data && data.currency) || (usage && usage.currency) || 'CNY'
        if (usage === null || usage === undefined) {
          todayAmount.textContent = '—'
          todaySub.textContent = t('loading')
        } else if (!usage.ok) {
          todayAmount.textContent = '—'
          todaySub.textContent = describeError(usage)
        } else {
          const today = usage.today || {}
          todayAmount.textContent = formatSmall(today.yuan, currency)
          todaySub.textContent = runwayText(usage, currency)
          const progress = usage.runway && typeof usage.runway.progress === 'number' ? usage.runway.progress : null
          ring.setAttribute('data-empty', progress === null ? 'true' : 'false')
          ring.setAttribute('data-level', progress !== null && progress >= 0.8 ? 'high' : 'normal')
          // The arc is drawn with a 0..1 fraction: the stylesheet maps it onto
          // the circle's circumference, so no DOM lookup is needed here.
          ring.setAttribute('style', '--dsb-progress:' + (progress === null ? 0 : Math.round(progress * 1000) / 1000))
          ring.title = usage.runway
            ? t('burnToday', { amount: formatSmall(usage.runway.burnYuan, currency) })
            : ''
          ringCenter.textContent = progress === null ? '' : Math.round(progress * 100) + '%'
          // Narrow card: drop the "rates" wording, keep the amount inline, so
          // neither chip has to wrap onto a second line.
          peakChipLabel.textContent = t(shortLabels() ? 'todayPeakShort' : 'todayPeak')
          peakChipValue.textContent = formatSmall(today.peakYuan, currency)
          offChipLabel.textContent = t(shortLabels() ? 'todayOffPeakShort' : 'todayOffPeak')
          offChipValue.textContent = formatSmall(today.offPeakYuan, currency)
          peakChip.hidden = false
          offChip.hidden = false

          const peak = usage.peak || {}
          const tier = peak.now ? t('peakPeak') : t('peakOffPeak')
          peakRow.setAttribute('data-peak', peak.now ? 'true' : 'false')
          peakNow.textContent = tier
          const next = peak.nextChange
          // Two forms: the roomy one, and a short one that still fits beside
          // the current-tier label when the translation is long.
          const nextTier = peak.now ? t('peakOffPeak') : t('peakPeak')
          const nextText = next ? t('peakIn', { n: formatDuration(next.inMinutes), tier: nextTier }) : ''
          peakNext.textContent = nextText
          peakNext.setAttribute('data-short', shortLabels() ? 'true' : 'false')
          const windows = (peak.windows || []).map((window) => window.start + '–' + window.end).join(' / ')
          peakRow.title = windows === '' ? '' : windows

          paintSpark(usage.series || [])

          const turns = (usage.turns && usage.turns.recent) || []
          const todayTurns = turns.filter((turn) => turn.day === today.day)
          turnList.replaceChildren()
          turnNote.textContent = (usage.turns && usage.turns.unpriced ? String(usage.turns.unpriced) : '')
          if (todayTurns.length === 0) {
            const empty = document.createElement('li')
            empty.className = 'dsb-turn-empty'
            empty.textContent = t('turnEmpty')
            turnList.appendChild(empty)
          }
          for (const turn of todayTurns.slice(0, 5)) turnList.appendChild(turnRow(turn, currency))
          if (usage.turns && usage.turns.hasMore) {
            const more = document.createElement('li')
            more.className = 'dsb-turn-empty'
            more.textContent = t('turnMore', { n: Math.max(0, usage.turns.total - turns.length) })
            turnList.appendChild(more)
          }
        }
        const balanceTab = activeTab === 'balance'
        tabButtons.balance.setAttribute('aria-selected', balanceTab ? 'true' : 'false')
        tabButtons.usage.setAttribute('aria-selected', balanceTab ? 'false' : 'true')
        bodyBalance.hidden = !balanceTab
        bodyUsage.hidden = balanceTab
        refreshLabel.textContent = t('refresh')
        tabButtons.balance.textContent = t('tabBalance')
        tabButtons.usage.textContent = t('tabUsage')
        todayLabel.textContent = t('today')
        const kindShape = activeTab === 'usage' ? 'pulse' : 'wallet'
        if (kind.getAttribute('data-shape') !== kindShape) {
          kind.setAttribute('data-shape', kindShape)
          kind.innerHTML = iconSvg(kindShape, 13)
        }
        // The header keeps one identity per tab: 余额 or 用量.
        title.textContent = t(activeTab === 'usage' ? 'tabUsage' : 'balance')
        turnTitle.textContent = t('turnList')
        turnLegend.textContent = shortLabels() ? t('tokensLegend') : ''
        turnLegend.hidden = !shortLabels()
        usageNote.textContent = t('usageNote')
      }

      /** One row of the per-turn list. */
      function turnRow(turn, currency) {
        const item = document.createElement('li')
        item.className = 'dsb-turn'
        item.setAttribute('data-tier', turn.peak ? 'peak' : 'off')
        const when = document.createElement('span')
        when.className = 'dsb-turn-time'
        const at = new Date(turn.at)
        when.textContent = Number.isFinite(at.getTime())
          ? String(at.getHours()).padStart(2, '0') + ':' + String(at.getMinutes()).padStart(2, '0')
          : '—'
        const tokens = document.createElement('span')
        tokens.className = 'dsb-turn-tokens'
        const buckets = (turn && turn.tokens) || {}
        if (shortLabels()) {
          // English: ↑ uncached-in · ⚡ cached · ↓ out. Shorter than three
          // words and still unambiguous next to the timestamps.
          tokens.textContent = '\u2191' + formatTokens(buckets.uncachedInput)
            + ' \u00b7 \u26a1' + formatTokens(buckets.cacheRead)
            + ' \u00b7 \u2193' + formatTokens(buckets.output)
        } else {
          tokens.textContent = t('tokensIn') + ' ' + formatTokens(buckets.uncachedInput)
            + ' · ' + t('tokensCache') + ' ' + formatTokens(buckets.cacheRead)
            + ' · ' + t('tokensOut') + ' ' + formatTokens(buckets.output)
        }
        const amount = document.createElement('span')
        amount.className = 'dsb-turn-amount'
        amount.textContent = turn.yuan === null ? '—' : formatSmall(turn.yuan, currency)
        item.appendChild(when)
        item.appendChild(tokens)
        item.appendChild(amount)
        item.title = (turn.model || '') + (turn.peak ? ' · ' + t('turnPeak') : ' ' + '· ' + t('turnOffPeak'))
        return item
      }

      /** Seven-day spend as a column chart; heights are relative to the max. */
      function paintSpark(input) {
        spark.replaceChildren()
        sparkLabels.replaceChildren()
        const series = Array.isArray(input) ? input : []
        const values = series.map((day) => Number(day.yuan) || 0)
        const max = Math.max(1e-9, ...values)
        for (let index = 0; index < series.length; index += 1) {
          const day = series[index]
          const bar = document.createElement('i')
          const ratio = values[index] / max
          // Empty days keep a 3px stub so the week reads as a chart, not a guess.
          bar.style.height = (values[index] === 0 ? 3 : 12 + Math.round(ratio * 22)) + 'px'
          bar.setAttribute('data-today', index === series.length - 1 ? 'true' : 'false')
          bar.setAttribute('data-empty', values[index] === 0 ? 'true' : 'false')
          bar.title = day.day + ' · ' + formatSmall(values[index], (usage && usage.currency) || 'CNY')
          spark.appendChild(bar)
          const label = document.createElement('span')
          // Weekday initials for the last week; today reads as "今天".
          const at = new Date(day.day + 'T12:00:00')
          const isToday = index === series.length - 1
          // Two letters where one would repeat (Tu/Th, Sa/Su); a single
          // letter for the days that stay unique reads as a chart, not a word.
          const weekday = currentTable() === DICT.zh
            ? '日一二三四五六'.charAt(at.getDay())
            : ['Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa'][at.getDay()]
          label.textContent = isToday ? (currentTable() === DICT.zh ? '今' : 'T') : weekday
          if (isToday) label.setAttribute('data-today', 'true')
          sparkLabels.appendChild(label)
        }
      }

      /** Switch tabs without reloading: usage is read on first use. */
      function selectTab(key) {
        activeTab = key === 'usage' ? 'usage' : 'balance'
        paint()
        paintUsage()
        if (activeTab === 'usage' && usage === undefined) void readUsage(false)
      }

      // The in-flight usage read, shared like the balance read.
      let usageInFlight = null
      function readUsage(force) {
        if (usageInFlight !== null) return usageInFlight
        usageLoading = true
        usageInFlight = readRoute(USAGE_API_PATH, force).then((payload) => {
          usage = payload
          usageLoading = false
          usageInFlight = null
          paintUsage()
          return payload
        }, (error) => {
          usageInFlight = null
          usageLoading = false
          usage = { ok: false, code: 'NETWORK', error: String((error && error.message) || error) }
          paintUsage()
          throw error
        })
        return usageInFlight
      }

      for (const key of ['balance', 'usage']) {
        tabButtons[key].addEventListener('click', (event) => {
          if (event && typeof event.stopPropagation === 'function') event.stopPropagation()
          selectTab(key)
        })
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
          // The wallet drives the runway bar, so a refreshed balance also
          // refreshes the usage body the user may be looking at.
          if (activeTab === 'usage' || usage !== undefined) void readUsage(force).catch(() => undefined)
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
        activeTab = 'balance'
        paintedLanguage = document.documentElement.getAttribute('lang')
        paint()
        paintUsage()
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
      refresh.addEventListener('click', () => {
        if (activeTab === 'usage') {
          usage = undefined
          paintUsage()
          void readUsage(true).catch(() => undefined)
          return
        }
        void read(true)
      })
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
        const width = host.offsetWidth || 92
        const height = host.offsetHeight || 26
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
          void read(false).then(() => {
            if (activeTab === 'usage') void readUsage(false).catch(() => undefined)
            schedule()
          })
        }, minutes * 60000)
      }
      void read(false).then(schedule)
      const onVisible = () => {
        if (document.visibilityState !== 'visible') return void 0
        const last = data && Date.parse(data.updatedAt)
        if (Number.isFinite(last) && Date.now() - last < 60000) return void 0
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
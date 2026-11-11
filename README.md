# dsh-balance-pro

> DeepSeek Harness 插件 · 侧边栏余额徽章 · 只读 · Key 不出宿主进程

在 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 里显示 DeepSeek 账户余额的插件：**侧边栏账号行右端一个余额徽章**，点开是一张明细卡片——合计、充值余额、赠送余额、累计消费、更新时间和账号，带「刷新」和「去充值」。

![余额徽章](docs/glass-badge.webp)

界面重构成**深海液态玻璃**：宽 300px 的浮层、40px 背景模糊、带折射感的渐变描边、官方 DeepSeek 鲸鱼徽标与水下剪影。徽章和卡片都跟随宿主的明暗主题，而不是只看系统设置。

| 深色 | 浅色 |
|---|---|
| ![深色](docs/glass-dark.webp) | ![浅色](docs/glass-light.webp) |

- **只读插件**：不写会话、不改模型配置；只读余额，点「去充值」才会打开 DeepSeek 充值页。
- **API Key 不离开宿主进程**：浏览器半区只拿到金额和平台掩码后的账号，拿不到 key。
- **失败不拖垮页面**：没配 key、key 失效、断网时徽章显示 `余额 —`，卡片里写明原因；不会让 DSH 启动失败。
- **液态玻璃**：宿主真实令牌（`--dsw-alias-*` / `--dsw-static-deepseek-*`）+ 分层高光 + 细噪点 + 背板模糊；不支持 `backdrop-filter` 时自动退化为实色。
- **跟随宿主主题**：直接读取页面背景与 `data-ds-dark-theme`，宿主强制明暗也能跟上。

余额偏低时徽章转为琥珀色、出现红点，卡片右上角给出「偏低」：

![低余额](docs/glass-low.webp)

没配 Key 时给出可读的原因，而不是一串错误码：

![未配置](docs/glass-error.webp)

从平面卡片到玻璃浮层的对比：

![重构前后](docs/glass-before-after.webp)

---

## 目录

- [安装](#安装)
- [卸载](#卸载)
- [更新](#更新)
- [配置](#配置)
- [视觉设计](docs/visual.md)
- [余额从哪来](#余额从哪来)
- [数据契约](#数据契约)
- [发布到 npm（可选）](#发布到-npm可选)
- [常见问题](#常见问题)
- [已知限制](#已知限制)
- [开发](#开发)
- [License](#license)

---

## 安装

### 前置条件

- 已安装 **DeepSeek Harness 桌面端**（本插件在 `0.2.2-rc.1` 实测可用）。
- 一个 DeepSeek 账户：**配了 API Key** 或 **在客户端里登录过** 都可以，二者有一个即可。

### 第一步：确认 `dsh` 命令可用

桌面端自带 CLI。先试：

```sh
dsh --version
```

没有这个命令也没关系，用应用包内的绝对路径代替（macOS）：

```sh
DSH="/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh"
"$DSH" --version
```

> 下文所有 `dsh` 都可以替换成上面的 `"$DSH"`。
> Windows 用户请把路径换成对应的安装目录，或直接使用应用自带终端。

### 第二步：安装插件

**方式 A：从 GitHub 安装（推荐）**

```sh
dsh plugin --profile desktop add "github:chauvetliu/dsh-balance-pro"
```

**方式 B：从本地目录安装（开发/离线）**

```sh
dsh plugin --profile desktop add "link:/绝对路径/dsh-balance"
```

安装命令会把包装进当前 profile 的 `node_modules`，并**自动**把 `dsh-balance` 写进 profile 的 bundle 列表。装完的 `~/.dsh/profiles/desktop/package.json` 大致是这样：

```jsonc
{
  "dependencies": {
    "dsh-balance-pro": "github:chauvetliu/dsh-balance-pro"
  },
  "dsh": {
    "profile": {
      "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "dsh-balance-pro"]
    }
  }
}
```

### 第三步：重启应用

**宿主半区（`index.js`、`lib/*`）只在启动时加载**，所以装完必须重启一次 DeepSeek Harness（点窗口里的「重启」，或完全退出再打开）。

### 第四步：确认生效

打开任意对话，看侧边栏底部账号行（头像 + 打码手机号）的**右端**是否出现 `¥xx.xx` 徽章：

- 有金额 → 成功；
- 显示 `余额 —` → 插件已生效但没读到余额，点开卡片看原因（见[常见问题](#常见问题)）；
- 什么都没有 → 看下面的排查。

在页面控制台（⌥⌘I）执行：

```js
window.__dshBalanceProStatus
// { mounted: true, ..., lastUrl: "/dsh-balance-pro/balance.json", lastError: "", lastOrigin: "relative" }
```

`undefined` 说明模块根本没加载（多半是没重启，或包没进 bundle 列表）。

---

## 卸载

```sh
dsh plugin --profile desktop remove dsh-balance
```

这条命令会从 `dependencies` 和 `dsh.profile.bundles` 里删掉该包，然后**重启应用**即可。徽章、样式和它注册的路由都会随插件卸载一起消失，不会残留。

如果命令不可用，也可以手动编辑 `~/.dsh/profiles/desktop/package.json`：

1. 删掉 `dependencies` 里的 `"dsh-balance-pro"` 一行；
2. 删掉 `dsh.profile.bundles` 数组里的 `"dsh-balance-pro"`；
3. 重启应用。

> 卸载不会动你的 API Key、账号登录态或任何会话数据——插件从不写这些。

---

## 更新

```sh
# 从 GitHub 安装的
dsh plugin --profile desktop add "github:chauvetliu/dsh-balance-pro"
# 本地 link 安装的：git pull / 改完代码即可
```

更新后**重启应用**。只有 `client.js` 变了的话，**刷新页面（⌘R）**就够了——前端 bundle 是宿主每次请求从磁盘读取的。

---

## 配置

在 `~/.dsh/profiles/desktop/cordis.patch.yml` 里按 id 覆盖（用户 patch 层在 bundle 层之后，优先级更高）：

```yaml
- id: dsh-balance
  name: dsh-balance-pro
  config:
    refreshMinutes: 5         # 后台刷新间隔（分钟）
    lowBalanceThreshold: 20   # 低于 20 元时显示警示色
    currency: CNY             # 多币种账户时优先取哪个
```

| 字段 | 默认 | 说明 |
|---|---|---|
| `apiKeyEnv` | `DEEPSEEK_API_KEY` | 读哪个凭据引用名 |
| `baseURL` | `https://api.deepseek.com` | 余额接口前缀，走代理/自建网关时改这里 |
| `currency` | `CNY` | 多币种钱包优先选哪个币种（不做汇率换算） |
| `refreshMinutes` | `10` | 宿主后台刷新间隔（上限 24 小时），前端轮询读同一个值 |
| `lowBalanceThreshold` | `10` | 低于该金额时徽章变警示色并显示红点 |
| `readTotalCosts` | `true` | 是否读取「累计消费」和账号邮箱（见下） |
| `requestTimeoutMs` | `8000` | 单次上游请求超时（上限 60 秒） |

### `readTotalCosts` 是什么

DeepSeek 官方 SDK 的 `deepseekAccount` 服务只投影出两个钱包，**丢掉了 `total_costs`（累计消费）**。为了显示这一行，插件会在开启时用**同一份账号凭据**再读一次平台 summary/profile。

- `true`（默认）：卡片显示累计消费和邮箱；
- `false`：完全不碰官方服务之外的接口，累计消费显示 `—`，账号退化为手机号掩码。

---

## 余额从哪来

页面**只发相对路径** `fetch('/dsh-balance-pro/balance.json')`——桌面壳会把它转发给宿主并带上浏览器 cookie，这是宿主信任栅栏唯一必过的路径。

宿主端两条取数路径，**API Key 优先**：

1. **API Key 路**：`ctx.credentials.resolve('DEEPSEEK_API_KEY')` → `GET https://api.deepseek.com/user/balance`；
2. **账号登录路**：没有 key（或 key 失效）时，用 DSH 账号会话 `deepseekAccount.getBalance(...)`。平台把钱包拆成 `value`（充值）和 `bonusWallets`（赠金），**两个都算**——新账号常常只有赠金。

两条路都不需要你在插件里填任何东西：Key 从 `~/.dsh/.credentials.yaml` 的 `refs`、宿主环境变量或 `.env` 读；账号登录态由 DSH 客户端自己管理。

---

## 数据契约

```
GET /dsh-balance-pro/balance.json[?force=1]
```

```jsonc
{
  "ok": true,                 // false 时金额都是 null，并带 code / error
  "totalBalance": 95.02,      // 合计
  "rechargeBalance": 95.02,   // 充值余额
  "bonusBalance": 0,          // 赠送余额
  "totalCost": 4.97,          // 累计消费（需要 readTotalCosts）
  "account": { "id": "…", "contact": "cha*****iu@163.com", "name": null, "avatarUrl": null },
  "currency": "CNY",
  "isAvailable": true,
  "accountTag": "99afec3c…",  // key 的 sha256 前 24 位，用于区分多个 key
  "source": "apikey",         // apikey | account | cache
  "stale": false,             // true = 本次刷新失败，显示的是上次成功值
  "updatedAt": "2026-11-11T01:00:00.000Z",
  "lowBalanceThreshold": 10,
  "refreshMinutes": 10,
  "code": "HTTP",             // 仅失败或 stale 时出现
  "error": "余额接口请求失败（HTTP 503）"
}
```

错误码：`NO_KEY`、`CREDENTIALS_UNAVAILABLE`、`UNAUTHORIZED`、`RATE_LIMITED`、`HTTP`、`NETWORK`、`TIMEOUT`、`PARSE`、`SHAPE`。

**安全边界**：只读路由；`GET/HEAD/OPTIONS` 之外一律 405；只接受本机来源（桌面壳 `dsh-app://app` 或任意回环端口上的页面），外站 origin 一律 403。响应带 `Access-Control-Allow-Origin: *`（无凭据、无 cookie 依赖）。

---

## 发布到 npm（可选）

包名 `dsh-balance-pro` 目前在 npm 上是空闲的，可以发布：

```sh
npm publish --access public
```

其余几个相近名字已被占用，别再试：`dsh-deepseek-balance`、`dsh-balance`、`dsh-balance-badge`、`dsh-balance-widget`、`dsh-wallet`。

## 常见问题

**装了但没有徽章**

1. 是否重启过应用？（宿主半区只在启动时加载）
2. `~/.dsh/profiles/desktop/package.json` 的 `dsh.profile.bundles` 里有没有 `dsh-balance-pro`？
3. 页面控制台执行 `window.__dshBalanceProStatus`：`undefined` = 前端没加载；有 `mounted: true` = 已加载。

**徽章显示 `余额 —`**

点开卡片看提示：

| 卡片提示 | 含义 | 处理 |
|---|---|---|
| 未配置 DeepSeek API Key | 两条路都没读到 | 在 设置 → 模型 填 Key，或登录客户端 |
| API Key 无效或已过期 | 上游返回 401/403 | 换一个有效 Key |
| 无法连接余额接口 | 网络/代理问题 | 有代理时把 `baseURL` 指到能通的网关 |
| 凭据服务不可用 | 宿主凭据服务还没就绪 | 稍等再点刷新；持续出现请重启 |

**数字长时间不变**

卡片里的「刷新」会强制拉一次（有 3 秒冷却，防止连点打爆接口）；自动刷新间隔看 `refreshMinutes`。

**`curl` 访问 `balance.json` 返回 401**

正常：宿主信任栅栏会拦没有浏览器 cookie 的请求。页面里的请求带 cookie，不受影响。

**徽章跑到了窗口右下角**

插件靠 `[data-avatar-status]` / `[class*="_avatar"]` 找侧边栏账号行。宿主改版改了结构时，会退回右下角（不会消失、不会错位）。遇到这种情况欢迎提 issue 附上 DOM 片段。

**如何强制回到默认位置**

插件本身不保存位置（拖动已禁用），位置每次都由账号行实时计算，无需重置。

---

## 已知限制

- **不支持多币种汇总**：只显示配置的那一种币种（默认 CNY）。
- **累计消费是"绕过投影"读的**：见 [`readTotalCosts`](#readtotalcosts-是什么)；介意就关掉。
- **不统计今日消耗 / 峰谷价 / 逐轮消耗**：那需要本地账本与用量事件，属于另一类插件。
- **只在 0.2.2-rc.1 桌面端实测**：其它版本的服务组合（是否有 `deepseekAccount`、账号行类名、模块图行为）未逐一验证。
- **依赖宿主 DOM 特征定位**：见上面「徽章跑到了窗口右下角」。
- **玻璃效果依赖 `backdrop-filter`**：不支持的宿主会退化为实色卡片，布局和文字不变。

---

## 开发

```sh
npm test        # node --test，64 个用例，零第三方依赖
npm run check   # 语法自检
```

结构：

| 文件 | 作用 |
|---|---|
| `index.js` | **宿主半区**：注册 `/dsh-balance-pro/*` 路由、读凭据/账号会话、请求上游、缓存与 CORS |
| `lib/balance.js` | 纯函数：上游响应解析、错误分类、脱敏、payload 组装 |
| `lib/request.js` | 准入校验（Host / Origin / Sec-Fetch-Site + 宿主栅栏） |
| `client.js` | **浏览器半区**：手写模块 bundle，自挂载徽章与卡片（样式内联） |
| `cordis.patch.yml` | bundle 补丁：把插件插进 profile 配置树并给默认配置 |
| `docs/visual.md` | 视觉设计说明：液态玻璃配方、鲸鱼用法、主题令牌与降级 |
| `test/` | 单测 |

**改哪里要重启？** 改 `index.js` / `lib/*` → 重启应用；改 `client.js` → 刷新页面（⌘R）。

### 为什么客户端不注册任何服务

DSH 桌面端的页面在你插件运行前就已构建好模块图。客户端条目如果声明了一个当前组合**并未提供**的服务，会一直停在 PENDING，而桌面端的启动审计把「有条目没激活」当成致命错误——整页白屏。所以这个插件的浏览器半区：

- 只做 `window.__ModuleLoader__.load({ id, factory })` 注册，**不声明 `inject`**；
- 不 require 任何模块（不依赖 React 是否在种子表里）；
- 用原生 DOM 自挂载徽章。

遇到同类场景的插件作者可以直接参考这个取舍。

---

## License

[MIT](LICENSE)。插件只在你的机器上读取你自己的余额数据，不发送任何遥测；除 DeepSeek 官方接口外不访问任何外部域名。
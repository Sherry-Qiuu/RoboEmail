# RoboEmail 交接文档

> 给接手这个项目的人（或下一个 AI session）。
> 另见：[使用说明](usage.md)（怎么装、怎么跑、怎么配发信）、[PRD](PRD.md)（产品需求）、[邮件系统交接](handoff-mailer.md)（历史版本）。

---

## 0. 一页速览

| 项 | 内容 |
| --- | --- |
| 是什么 | 给 UNNC 学生用的英文邮件写作助手：改写已有草稿、从零生成、查教授邮箱、错题学习 |
| 代码位置 | 本仓库根目录，后端 `apps/server`，前端 `apps/web` |
| 当前状态 | 主流程可用；真实 SMTP 发信已接通并通过验收；忘记密码、修改密码已补齐 |
| 怎么跑 | 双击 `start.cmd`，或 `pnpm install && pnpm dev`，浏览器打开 http://localhost:5173 |
| 技术栈 | Node 24 + Hono + `node:sqlite`；Vite + React 19 + Tailwind 4 |
| 存储 | 服务端 SQLite（账号、错题、教授库）；浏览器 IndexedDB（草稿、历史） |
| 外部依赖 | LLM（OpenAI 兼容协议，无 key 时走 mock）、SMTP 账号（无配置时打日志） |
| 验证环境 | Windows 11 + Node 24.21 + pnpm 11，全部功能在本机跑通过 |

---

## 1. 产品定位

UNNC 学生日常要给教授、导师、行政部门写英文邮件，难点不在语法，而在"不知道该说什么、语气拿不准、称呼写错"。

产品做三件事：

1. **润色** —— 贴一段自己写好的英文，给出逐句改动、改动理由、以及"这样显得不礼貌/太卑微"之类的提醒。
2. **生成** —— 选一个场景（请假、约 office hour、申请延期……），填几个字段，直接产出一封可发的邮件。
3. **教授库** —— 查询 UNNC 三个学院 576 位老师的邮箱、职称、学院，按职称自动推导正确称呼（Professor / Dr / 全名）。

非目标（PRD 第 1 节）：不做语法课、不做翻译、不做 IM 聊天式对话。

---

## 2. 技术架构

```
浏览器 (apps/web)
  React 19 + Tailwind 4，Vite 开发服务器 :5173
  /api/* 由 Vite 代理到 :8787
        │
        ▼
服务端 (apps/server)  Hono，Node 直接跑 TS，无构建步骤
  :8787
  ├─ 鉴权      auth.ts        argon2 哈希 + httpOnly session cookie（30 天）
  ├─ 数据      db.ts          node:sqlite，单文件 data/roboemail.db
  ├─ 模型      polish.ts / generate.ts / prompt.ts / llm.ts
  ├─ 教授库    professors.ts  职称 → 称呼推导
  ├─ 邮件      mailer.ts + mailer/smtp.ts   环境变量切换 console / SMTP
  └─ 路由      routes/learn.ts、routes/people.ts
        │
        ▼
外部：LLM 提供方（OpenAI 兼容） / SMTP 服务器
```

**没有构建步骤**：服务端源码就是运行产物，靠 Node 24 的 TypeScript 类型剥离直接执行。好处是改完即生效、部署简单；代价是必须 Node ≥ 22.6（`node:sqlite` 与 `loadEnvFile` 的要求），且不能用 `enum` 等需要转译的语法。

---

## 3. 目录结构

```
RoboEmail/
├─ apps/
│  ├─ server/                 后端
│  │  ├─ src/
│  │  │  ├─ index.ts          入口 + 认证/润色/生成路由 + 启动
│  │  │  ├─ env.ts            环境变量集中读取（仓库根 .env）
│  │  │  ├─ db.ts             建表 + 数据访问
│  │  │  ├─ auth.ts           密码、会话、配额
│  │  │  ├─ mailer.ts         Mailer 接口 + 环境选择
│  │  │  ├─ mailer/smtp.ts    SMTP 实现（超时、代理、日志脱敏）
│  │  │  ├─ polish.ts         润色业务
│  │  │  ├─ generate.ts       生成业务
│  │  │  ├─ prompt.ts         提示词与硬约束
│  │  │  ├─ llm.ts            提供方适配（OpenAI 兼容）
│  │  │  ├─ professors.ts     教授查询与称呼推导
│  │  │  ├─ scenarios.ts      生成场景定义
│  │  │  └─ routes/           learn.ts、people.ts
│  │  └─ data/
│  │     ├─ professors.json   教授库成品数据（576 人）
│  │     └─ roboemail.db      SQLite（**不入库、不打包**）
│  └─ web/                    前端
│     └─ src/pages/           HomePage、WritePage、PolishPage、PeoplePage、LearnPage、MyPage、AuthPage
├─ docs/                      PRD、交接文档、使用说明
├─ scripts/                   教授库导入、前端语法自检
├─ start.cmd                  Windows 一键启动
├─ dev.mjs                    同时拉起前后端
└─ .env.example               环境变量模板（真实配置放 .env，已被 .gitignore 忽略）
```

运行时**不读取** `data/`、`data_business/`、`data_fhss/` 这三个根目录——它们是抓取教授名录时的原始中间产物（HTML、listing JSON），只服务于 `scripts/` 里的重建流程，因此**没有打进交接压缩包**。

---

## 4. 功能现状

| 功能 | 状态 | 位置 | 备注 |
| --- | --- | --- | --- |
| 注册 / 邮箱验证码 / 登录 / 登出 | ✅ 可用 | `index.ts`、`auth.ts` | 验证码 10 分钟、错 5 次锁、重发 5 次/小时 |
| 润色（逐句 diff + 理由） | ✅ 可用 | `polish.ts`、`PolishPage.tsx` | 无 key 时走 mock |
| 生成（场景 + 字段） | ✅ 可用 | `generate.ts`、`WritePage.tsx` | |
| 教授库 | ✅ 可用 | `professors.ts`、`routes/people.ts` | 仅 UNNC 身份可见 |
| 学习页（错题本 + 统计） | ✅ 可用 | `routes/learn.ts`、`LearnPage.tsx` | 需要登录 |
| 我的（配额、导出） | ✅ 可用 | `MyPage.tsx`、`/api/auth/me` | |
| 未登录试用 | ✅ 可用 | `index.ts` 的 `charge()` | 每 IP 每天 3 次，不写库 |
| 语音输入 | ✅ 可用 | `VoiceButton.tsx` | 浏览器 Web Speech API |
| 真实发信 | ✅ 可用 | `mailer/smtp.ts` | 见第 6 节 |
| 忘记密码 | ✅ 可用 | `index.ts`、`ResetPage.tsx` | `/api/auth/forgot` + `/api/auth/reset` + `/reset?token=` 页面 |
| 修改密码 | ✅ 可用 | `index.ts`、`MyPage.tsx` | 改完保留当前会话，其余设备退出 |
| 自动化测试 / CI | ❌ 没有 | — | 全部靠手工验收，见 [usage.md](usage.md) 第 11 节 |

---

## 5. 关键设计决策（改之前先看）

1. **服务端零构建**。改 `.ts` 存盘即生效（`--watch`）。不要引入需要编译的语法（`enum`、装饰器、参数属性）。
2. **`node:sqlite` 而非 better-sqlite3**。免编译原生模块，换机器不会卡在 node-gyp。它是 Node 内置 API，升级 Node 时留意行为变化。
3. **邮件正文与主题不上云**。润色/生成的文本只在前端处理，服务端只记录账号、配额、错题片段。这是 PRD 第 5 节的硬约束，改接口时别把正文加进数据库。
4. **试用不写库**。`charge()` 对未登录用户只做内存计数，服务器重启即清零；这是刻意的隐私设计。
5. **邮件实现按环境变量切换，而不是按 NODE_ENV**。填了 `SMTP_HOST` + 账号密码就真发，否则打印日志。开发环境"半个配置"会降级并告警，生产环境直接启动失败（避免验证码只进日志）。
6. **日志永远不出现完整验证码**。`mailer/smtp.ts` 只打后两位和脱敏收件人；改日志格式时保持这一条。
7. **会话用 httpOnly cookie**，不用 JWT，因此服务端可随时吊销（`sessions` 表）。

---

## 6. 邮件系统（最近完成的一块）

### 6.1 结构

- `mailer.ts`：定义 `Mailer` 接口（`sendVerificationCode`、`sendPasswordReset`），并决定用哪个实现。
- `mailer/smtp.ts`：真实发信。`createSmtpMailer(config, appOrigin)`。
  - 465 隐式 TLS；587 强制 STARTTLS；其他端口"服务器支持才升级"。
  - transport 单例 + 连接池，避免每封信重连。
  - `sendMail` 外再套 15 秒硬超时（防"TCP 连上但服务器不说话"）。
  - 支持 `SMTP_PROXY`（HTTP CONNECT 代理），用于出口被墙的场景。
  - 失败记日志后**抛出**，由路由决定怎么回复用户。
- 配置项见 [usage.md](usage.md) 第 5 节。

### 6.2 验收结果（2026-10-29，真实 QQ 邮箱）

| # | 验收项 | 结果 |
| --- | --- | --- |
| 1 | 注册收码，日志有 SMTP 成功记录，邮箱收到 6 位码 | ✅ 通过（5 封全部投递，码可验证） |
| 2 | 连错验证码，第 6 次提示"试错太多次" | ✅ 通过（`429 code_locked`） |
| 3 | 连点重发 6 次，第 6 次被限流 | ✅ 通过（`429 rate_limited`，且被拦时不发信） |
| 4 | 忘记密码链接能打开且只能用一次 | ❌ 无法验收（功能不存在） |

### 6.3 忘记密码（已实现）

三个缺口的补法：

1. `POST /api/auth/forgot` —— 限流（同邮箱 5 次/小时、同 IP 20 次/小时），生成 32 字节随机 token，写 `password_resets`（只存 sha256、30 分钟过期），调 `mailer.sendPasswordReset`。**无论邮箱是否存在都返回 `{ok:true}`**，否则这个接口就成了账号枚举器。
2. `POST /api/auth/reset` —— 用 token 换新密码，`consumed_at` 标记后不可再用；同时删掉该用户全部 `sessions`，因为改密码的人未必是持有旧会话的人。
3. 前端 `/reset?token=...` —— `ResetPage.tsx`。App 启动时读 `location.pathname` 与 `token` 查询参数，命中就直接渲染重置页；成功后 `history.replaceState` 把 token 从地址栏抹掉。

配套的「修改密码」：`POST /api/auth/password`（需登录），校验当前密码，改完保留当前会话、踢掉其他设备。

### 6.4 已修复：验证码重复提交的提示语

原来查的是"最新一个未被消费的码"，已经用掉之后会回落到更早那个被锁的码，于是提示"试错太多次"。现在：

- 查询改成"最新的码"，不论是否已消费，先判 `consumed_at`，再判过期、再判尝试次数。
- 发包时把该邮箱同用途的旧码全部标记为已消费，所以永远只有一个有效码。

重复提交现在返回 `code_used` ——「这个验证码已经失效，重新获取一个」。

---

## 7. 数据边界

| 数据 | 位置 | 说明 |
| --- | --- | --- |
| 账号、密码哈希、配额 | 服务端 SQLite | 密码用 argon2 |
| 验证码、重置 token | 服务端 SQLite | 只存哈希，不存明文 |
| 错题（原文/改后/解释） | 服务端 SQLite | 仅登录用户，用户可删 |
| 草稿、润色历史 | 浏览器 IndexedDB | 换浏览器不跟走，需用"我的"页导出 |
| 邮件正文 | **不落盘** | 只在请求内存里 |

备份 = 复制 `apps/server/data/roboemail.db`（以及 `-wal`、`-shm`；建议停机或用 `.backup`）。**这个文件含用户数据，交接包里刻意没有包含。**

---

## 8. 已知问题与风险

1. **没有版本控制**。目录当前不是 git 仓库，改动无法回滚。接手后第一件事建议 `git init` 并提交一版基线（`.gitignore` 已写好，`.env` 和 `*.db` 会被忽略）。
2. **没有测试**。所有验收都是手工 HTTP 请求，改核心逻辑后请重跑 [usage.md](usage.md) 第 11 节的清单。
3. **Gmail SMTP 在国内直连不通**（TLS 握手超时），只有国内邮箱或带代理才能发。当前 `.env` 配的是 QQ 邮箱。
4. **个人邮箱发信有上限**。QQ / 163 对短时间高频发信会限流甚至封禁 SMTP 权限，验证码量大时要换企业邮箱或事务邮件服务。
5. **进垃圾箱的概率不低**。个人邮箱的发件人域名不是你的，SPF/DKIM 由邮箱服务商代签，正式上线前应换自有域名并配置 SPF、DKIM、DMARC。
6. **`node:sqlite` 仍在演进**。升级 Node 大版本前，先跑一遍注册、发信、教授库三个流程。
7. **限流是内存计数**（`RATE_BUCKETS`），多实例部署或重启后失效；单机小规模够用。
8. **学习页依赖登录**，未登录只能看到引导文案；这是产品决定，不是 bug。

---

## 9. 上线前清单

- [ ] 换自有域名发信（SPF / DKIM / DMARC），用 mail-tester.com 打分 ≥ 9
- [ ] `NODE_ENV=production`（开启 cookie `secure`，关闭接口里的 `devCode`）
- [ ] HTTPS 反向代理（Nginx / Caddy），并把 `APP_ORIGIN` 改成正式域名
- [ ] 数据库定时备份；确认磁盘权限
- [ ] 填入真实 `LLM_API_KEY`，确认配额（`QUOTA_USER_PER_DAY`）
- [ ] 限流改到 Redis 或网关层（若要多实例）
- [ ] 错误监控（现在只有 `console.error`）

---

## 10. 下一步建议（按优先级）

1. **纳入 git + 打基线**（半小时，收益最大）。
2. **换自有域名发信**，解决垃圾箱问题。
3. **加最小回归脚本**：注册→收码→验证→润色 一条链路跑通即可，防止改崩。
4. 学习页数据可视化打磨、移动端细节（PRD M4）。

---

## 11. 接手第一天做什么

1. 读这份文档和 [usage.md](usage.md)，按第 2 节把项目跑起来。
2. 打开 http://localhost:5173，注册一个账号，确认能收到验证码（没有 SMTP 配置就看服务端日志）。
3. `git init`，提交当前状态作为基线。
4. 读 `docs/PRD.md` 第 4 节，对照第 4 节的功能矩阵，确认哪些是你的任务。
5. 动代码前先看第 5 节的七条设计决策，避免踩已有的坑。

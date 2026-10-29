# PRD — RoboEmail（UNNC 英文邮件写作助手）

| 项 | 内容 |
| --- | --- |
| 版本 | v0.2（讨论稿） |
| 日期 | 2026-10-29 |
| 状态 | 待评审 |
| 负责人 | 个人开发 |
| 预计仓库名 | `aim-2627-roboemail`（academic year 2026–2027） |

**v0.2 主要变更**：引入账号体系（用户名 + 密码 + 邮箱）；邮件历史改为本地存储；上云数据限定为账号信息与错误片段。

---

## 1. 定位

面向宁波诺丁汉大学（UNNC）学生的英文邮件写作助手。解决两个真实痛点：

1. 学生会写英文，但写不对**语气**和**礼貌程度**——给教授发邮件时过于直接或过度卑微。
2. 学生不知道**该写什么**——格式、称呼、主题行、如何礼貌地提要求。

不做翻译工具。核心价值是**改得对，并且讲清楚为什么这么改**。

### 目标用户

- 主用户：UNNC 在读学生（英式学术环境，英文授课）
- 规模：100 人以内，个人维护
- 非 UNNC 用户：核心功能（润色、生成）完全可用，但没有教授库

### 非目标

- 不做中译英（润色仅接受英文原文）
- 不做邮件发送 / 邮箱托管
- 不做群发、批量发送
- 不做移动端 App（响应式网页即可）
- 不做邮件正文云端同步（见第 5 节）

---

## 2. 核心流程

```
润色模式：英文原文 ──▶ AI 改写 ──▶ 对照视图（改动高亮 + 原因）──▶ 迭代 ──▶ 复制
生成模式：场景表单 ──▶ AI 生成 ──▶ 对照视图（中英对照 + 槽位）──▶ 迭代 ──▶ 复制
```

两个模式**共用同一个结果组件**，只换"文本怎么来的"。这是本设计最重要的一条约束：任何结果区的功能（高亮、原因、复制、迭代、新增信息检测）都只实现一次。

---

## 3. 页面结构

| 路由 | 页面 | 说明 |
| --- | --- | --- |
| `/login` | 登录 | 用户名 + 密码 |
| `/register` | 注册 | 用户名 + 邮箱 + 密码 → 邮箱验证码 |
| `/forgot` | 找回密码 | 邮箱 → 重置链接 |
| `/` | 首页 | 两个入口：写邮件 / 润色 |
| `/write` | 写邮件 | 生成模式 |
| `/polish` | 润色 | 润色模式 |
| `/me` | 我的 | 本地历史、导出导入、配额、修改密码、删除账号 |
| `/learn` | 学习 | 云端错误统计、错题本 |
| `/professors` | 教授库 | 仅 UNNC 身份可见 |

除 `/login`、`/register`、`/forgot` 外均需登录。

---

## 4. 功能规格

### 4.1 润色模式

**输入**
- 多行文本输入框
- 语音输入按钮（Web Speech API，不支持时隐藏）
- 中文检测：输入中中文字符占比超过阈值（建议 15%）时拦截，提示"润色只接受英文原文"，并给一个"改用生成模式"的按钮
- 可选上下文（折叠，非必填）：收件人身份、关系（初次 / 已认识）、正式度 1–5

**输出**
- 英文正文，改动片段高亮显示。高亮由前端按 word-level diff 计算，不依赖模型标记
- 每条改动可点击展开：原句 / 改后 / 中文原因（1–2 句）/ 类别标签
- "只看改动"开关：开启时隐藏未改动部分，避免满屏高亮
- 分类统计条：本次共 N 处改动，语法 x / 用词 y / 语气 z / 格式 w

**迭代**
- 快捷指令 chips：更正式 / 更简洁 / 更礼貌 / 更具体
- 自由输入框：一句自己的要求
- 版本链：v1 → v2 → v3，可回退，可"与最初版对比"
- 默认 diff 基准是**上一版**，不是最初版

**复制**
- 复制纯文本（不含任何高亮标记）
- 复制时若存在未替换的槽位，弹确认

**新增信息检测（安全网，必须做）**
- 服务端比对原文与改后文本中的数字、日期、专有名词
- 改后出现但原文没有的，标为 ⚠️"新增信息，请确认"
- 纯字符串 / 正则实现，不调用模型

### 4.2 生成模式

**第 1 步：选场景**

询问信息 / 请求帮忙 / 请假与延期 / 约时间 / 道歉 / 感谢 / 投诉反馈 / 申请与套磁 / 其他

场景只决定表单字段和段落骨架，不决定文风。

**第 2 步：填表单**

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| 收件人身份 | 是 | 教授 / 导师 / 教务行政 / 同学 / 其他 |
| 收件人姓名 | UNNC 用户可补全 | 选中后自动生成称呼并锁定 |
| 是否初次联系 | 是 | 影响开场句 |
| 背景事件 | 是 | 多行 + 语音 |
| 核心诉求 | 是 | 询问：想确认的问题；请求：希望对方做什么 |
| 原因 / 必要性 | 是 | 为什么需要，给对方一个理由 |
| 已查过什么 | 否 | 学术邮件黄金法则：先证明做过功课 |
| 期望答复时间 | 否 | |
| 署名 | 否 | 英文名 + 学号 |
| 正式度 | 是 | 1–5，默认 3 |

**第 3 步：输出**

- 主题行：单独一块，给 2–3 个选项，可单独复制
- 正文：段落级中英对照（英文在上，中文灰字在下）
- 每段一个"这段为什么这么写"折叠：开场 — 背景 — 请求 — 给对方留退路 — 落款
- 槽位：`{{professor_name}}` 这类命名槽位，渲染成可点击 chip，点一下就填；未填的保留 `[Professor Name]`
- 复制：只英文 / 英文 + 主题 / 全文
- 底部："继续润色"按钮，带着当前文本进入润色模式

### 4.3 账号与认证

**设计原则**：用户名 + 密码是日常通道，邮件只在"忘记密码"时使用。因此 **SMTP 故障不影响日常使用**，这是本设计的关键优点。

**注册**
- 字段：用户名、邮箱、密码、是否 UNNC 学生（复选框，默认勾选）
- 用户名：3–20 字符，字母 / 数字 / 下划线，唯一
- 密码：≥ 8 位，Argon2id 哈希（默认参数），不存明文、不可逆
- 邮箱：唯一，注册后发 6 位验证码
- **必须完成邮箱验证才能登录**——否则邮箱是假的，重置密码功能就形同虚设
- 注册时提示"请填写常用邮箱，这是你唯一的重置渠道"

**登录**
- 用户名 + 密码
- 失败限速：同一用户名 5 次锁定 15 分钟；同一 IP 单独限速
- 错误信息统一为"用户名或密码错误"，不区分用户不存在与密码错误
- 会话：服务端 `sessions` 表 + HttpOnly / Secure / SameSite=Lax Cookie，30 天有效
- token 只在 Cookie 中，**绝不放 localStorage**

**忘记密码**
- 输入邮箱 → 无论邮箱是否存在都返回相同响应（防枚举）
- 存在则发重置链接，令牌 32 字节随机、单次使用、30 分钟过期、存哈希
- 重置成功后可选择"登出所有设备"

**验证码与邮件**
- 6 位数字，10 分钟过期，最多 5 次尝试
- 发送限流：同一邮箱 1 次/分钟、1 小时 5 次；同一 IP 1 小时 20 次
- 未限流等于对外开放一个邮件轰炸器，域名会进黑名单

**邮件发送的接口契约**（发送实现由独立 session 完成）

```ts
interface Mailer {
  sendVerificationCode(to: string, code: string): Promise<void>
  sendPasswordReset(to: string, token: string): Promise<void>
}
```

- 本项目只依赖这两个方法，发送方不得访问业务表
- 开发态实现 `consoleMailer`：验证码打印到服务器日志，`NODE_ENV !== 'production'` 时启用
- 生产实现 `smtpMailer`：替换后仅改一行配置
- 发信域名需配置 SPF / DKIM / DMARC，否则验证码大概率进垃圾箱

**管理员兜底**
- 提供 CLI：`npm run reset-password -- <username>`
- SMTP 未就绪阶段，内测用户忘记密码只能靠这个脚本

### 4.4 我的

- 本地历史列表：时间、模式、场景、主题行摘要、改动数
- 点开可恢复完整结果视图（只读 + 可复制）
- 单条删除 / 全部清空
- **导出 / 导入 JSON**：解决"换设备历史就没了"
- 配额展示：今日已用 / 上限
- 修改密码
- 删除账号（同时清除云端错误记录与账号信息）

说明文案需明确：本地历史仅存于当前浏览器，清理浏览器数据会丢失，建议定期导出。

### 4.5 学习

数据来源：润色与生成时上报到云端的 `errors` 片段。

- 概览：累计错误数、近 7 天趋势、按大类分布
- 错题本：原句片段 / 改后 / 中文解释 / 类别 / 来源标签，可按类别筛选，可标记"已掌握"
- 每条错误旁有"这条我不认同"按钮

**错误分类（固定枚举，两级）**

```
grammar.tense            语法-时态
grammar.agreement        语法-主谓一致
grammar.article          语法-冠词
grammar.preposition      语法-介词
grammar.plural           语法-单复数
grammar.structure        语法-句法结构
lexis.collocation        用词-搭配
lexis.word_form          用词-词性
lexis.chinese_english    用词-中式表达
lexis.register           用词-语域不当
pragmatics.directness    语气-过于直接
pragmatics.humility      语气-过于卑微
pragmatics.formality     语气-正式度不当
mechanics.punctuation    格式-标点
mechanics.capitalization 格式-大小写
mechanics.spacing        格式-空格
structure.subject_line   结构-主题行
structure.greeting       结构-称呼
structure.closing        结构-落款
structure.paragraphing   结构-分段
```

**三条规则**
- 只统计 `before !== after` 的条目，防止模型凑数
- 风格偏好不计入错误（"可以更简洁"不是错）
- 每条错误只存句子级片段（≤ 200 字符），**不存整封邮件、不存收件人、不存主题行**

### 4.6 教授库（仅 UNNC 身份）

**身份门控说明**："是不是 UNNC 学生"是**自我声明**，不是身份验证。教授信息本身是公开的，不构成安全问题。不得用它做额度控制或学号认证。

**数据来源**：UNNC 官网各学院 Staff 目录（公开信息），手工录入 + 定期校对。

**录入范围**：不按"学院"录，按"大一学生会写信的人"录，v1 控制在 40–60 人：
- Personal Tutor
- 本学期各模块的 Module Convenor / Lecturer
- CELE 老师
- 学院行政（Senior Tutor / Student Experience Officer / Course Director）

**三个关键字段**
- `surname` 必须单独存。中文名的英文拼写分不出姓在前还是后，而"Dear Professor Wei"正是要防的错误
- `salutation_override` 处理例外（老师明确说"叫我 Chris"）
- `source_url` + `updated_at` 没有来源和日期的数据三个月后就是负债

**职称 → 称呼映射**

| title | 称呼 |
| --- | --- |
| Professor | Dear Professor {Surname} |
| Associate Professor | Dear Dr {Surname} |
| Assistant Professor | Dear Dr {Surname} |
| Lecturer / Senior Lecturer | 有博士学位：Dear Dr {Surname}；否则 Dear Mr/Ms {Surname} |
| Teaching Fellow | 视学位，Dear Dr / Mr / Ms {Surname} |
| Tutor | Dear Dr {Surname} 或 Dear {First name} |
| Administrator | Dear Mr/Ms {Surname} 或 Dear {First name} |

原则：数据里有真实职称就不需要猜；缺失时宁高勿低。

**自动补全**
- 支持英文名、拼音、中文名、邮箱前缀四种匹配
- 下拉项必须消歧：`Prof. Wei Chen · School of CS`
- 选中后填入称呼并锁定该字段

**目录页**
- 搜索 + 按学院 / 系 / 研究方向筛选
- 卡片：姓名、职称、学院、邮箱、研究方向标签、个人主页
- **每张卡片有"写邮件给 TA"**，跳转生成模式并预填收件人和称呼
- 页头注明：`当前收录：XX 学院 52 人 · 更新于 2026-10`
- 每张卡片有"信息有误 / 已离职"按钮

**分两期**
- v1：姓名 / 职称 / 学院 / 系 / 邮箱 —— 够自动补全用
- v2：研究方向 / 个人主页 —— 工作量约 5 倍

---

### 4.7 试用模式

未登录也能直接用润色和生成，降低第一次使用的门槛。

- **不写任何数据**：不建用户、不存邮件、不上报错误片段。刷新即失。
- **限流**：同一 IP 每日 3 次，计数只放内存，服务重启即清零。内存计数不落盘，因此不违反"无存储"。
- **响应里带 `trial: true`**，前端据此提示"结果不会保存，注册后可以留下历史"。
- **不提供**：历史、学习页、教授库、导出。

---

## 5. 数据边界（本地 vs 云端）

**原则**：边界不按"哪张表放哪"划，按**"上云文本最长能有多长"**划。因为 `errors` 里的 `before` / `after` 本身就是邮件原文片段，存片段等于存了那句话。

| 数据 | 位置 | 说明 |
| --- | --- | --- |
| 邮件正文、主题行、改动列表、收件人信息 | **本地 IndexedDB** | 不上云 |
| 错误片段（≤ 200 字符）、类别、中文解释 | 云端 | 供学习页跨设备统计 |
| 来源标签（`润色 · 2026-10-20`）、来源日期 | 云端 | 不存 `email_id` |
| 用户名、邮箱、密码哈希、UNNC 标记、配额 | 云端 | |
| 教授库 | 云端 | 公开信息 |

**三条衍生规则**

1. **错误记录不存 `email_id`**。原文只在那台设备上，跨设备时 id 是悬空指针。用 `source_label + source_date` 展示"来源：2026-10-20 润色"。
2. **学习页点不进原文**。这是设计取舍，不是缺陷，UI 上要自然（不提供跳转入口，而不是给一个点不动的链接）。
3. **删除本地邮件不影响云端错题**。学习记录本就该留存，但删除按钮旁要写明。

**本地存储技术**：IndexedDB + Dexie。不用 localStorage——邮件 + 改动 + 原因文本一封几十 KB，5MB 上限撑不到 100 封。

**同步可靠性**：错误上报失败时写入本地 `sync_queue`，下次上线重试，避免静默丢失。

---

## 6. 数据模型

### 云端（SQLite）

```sql
users(
  id, username UNIQUE, email UNIQUE, password_hash,
  email_verified_at, is_unnc,
  quota_day, quota_used,
  created_at, updated_at
)

sessions(
  id, user_id, token_hash, expires_at,
  last_seen_at, user_agent, created_at
)

email_codes(
  id, email, code_hash, purpose,
  expires_at, attempts, consumed_at, created_at
)

password_resets(
  id, user_id, token_hash, expires_at, consumed_at, created_at
)

errors(
  id, user_id, category, before, after, explanation_zh,
  source_label, source_date, mastered, created_at
)

professors(
  id, name_en, surname, name_zh, name_pinyin,
  title, salutation_override,
  school, department, email UNIQUE, role, modules,
  profile_url, source_url, updated_at
)

professor_reports(
  id, professor_id, kind, note, created_at
)
```

### 本地（IndexedDB）

```ts
emails: {
  id, mode, purpose, context, input_text, output_text, subject,
  changes[], model, tokens_in, tokens_out, created_at
}

sync_queue: { id, kind, payload, attempts, created_at }
```

---

## 7. 接口

### 认证

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/auth/register` | `{username, email, password}` |
| POST | `/api/auth/verify-email` | `{email, code}` |
| POST | `/api/auth/resend-code` | 限流 |
| POST | `/api/auth/login` | `{username, password}` → Set-Cookie |
| POST | `/api/auth/logout` | |
| POST | `/api/auth/forgot-password` | `{email}`，恒定响应 |
| POST | `/api/auth/reset-password` | `{token, new_password}` |
| GET | `/api/auth/me` | 当前用户 + 配额 |
| DELETE | `/api/auth/account` | 删除账号与云端数据 |

### 业务

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/polish` | `{text, context}` → SSE 流 |
| POST | `/api/polish/iterate` | `{text, instruction}` → SSE 流 |
| POST | `/api/generate` | `{purpose, fields}` → SSE 流 |
| POST | `/api/errors/batch` | 上报错误片段（含 sync_queue 重试） |
| POST | `/api/errors/:id/mastered` | 标记已掌握 |
| POST | `/api/feedback` | 记录"我不认同"（只存片段） |
| GET | `/api/insights` | 学习页聚合数据 |
| GET | `/api/professors` | `?q=` 搜索 / 列表 |
| POST | `/api/professor-reports` | 教授信息纠错 |

**注意**：服务端不存邮件，因此没有 `/api/emails`。邮件历史完全由前端管理。

---

## 8. 模型调用契约

### 8.1 输出结构（严格 JSON，不输出 Markdown）

```json
{
  "revised": "Dear Professor Chen,\n\nI am writing to ...",
  "subject": "Question about COMP1033 coursework deadline",
  "changes": [
    {
      "before": "I want to ask you a question",
      "after": "I would like to ask a question",
      "reason_zh": "want to 在正式邮件中显得直接，would like to 更符合学术场合的礼貌程度。",
      "category": "pragmatics.directness"
    }
  ],
  "errors": [
    {
      "before": "informations",
      "after": "information",
      "explanation_zh": "information 是不可数名词，没有复数形式。",
      "category": "grammar.plural"
    }
  ],
  "slots": [
    { "key": "professor_name", "hint": "教授的姓，如 Chen" }
  ]
}
```

### 8.2 Prompt 硬约束

1. 不改变事实。不新增学生未提供的信息（日期、数字、姓名、承诺）。信息缺失时写进 `slots`，不要编。
2. 保留学生自己的语气和用词习惯，不重写成通用 AI 英文。
3. UNNC 是英式体系，使用 en-GB 拼写（organise / programme / colour），学术称呼按英式惯例。
4. `changes` 与 `errors` 只报告真实存在差异的片段，无改动返回空数组。
5. `errors` 中每条 `before` / `after` 不超过 200 字符。
6. 严格输出 JSON，不包裹 Markdown 代码块，不添加解释性前后缀。
7. 中文只出现在 `reason_zh` / `explanation_zh` 字段。

### 8.3 Provider 适配层

- 只实现 OpenAI 兼容协议
- 环境变量：`LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL`
- 优先级链：WorkBuddy 开放平台 → DeepSeek → 智谱 GLM
- 超时 / 429 / 额度耗尽自动降级，前端只感知为延迟
- 每次调用记录 token 与耗时，超日预算熔断

---

## 9. 技术架构

```
浏览器 ──HTTPS──▶ Caddy ──▶ Node 服务 ──▶ SQLite
   │                            │
   └─ IndexedDB（邮件历史）      └──▶ 模型 API（可切换）
```

| 层 | 选型 |
| --- | --- |
| 前端 | Vite + React + TypeScript + Tailwind |
| 数据请求 | TanStack Query |
| 本地存储 | Dexie（IndexedDB） |
| Diff | diff-match-patch（前端计算 word-level diff） |
| 后端 | Node 20 + Hono + better-sqlite3 |
| 密码 | Argon2id |
| 流式 | SSE |
| 部署 | 单机 Docker Compose（app + caddy） |
| 服务器 | 香港 / 新加坡轻量，2 核 2G，约 288 元/年 |
| 域名 | 约 80 元/年，香港节点无需 ICP 备案 |

**备份**：每日 cron 复制 `.db` 文件到对象存储或本地。

---

## 10. 成本与配额

- 服务器 + 域名：约 370 元/年
- 模型：100 人 × 5 次/天 ≈ 500 次/天 ≈ 1–1.5M token/天
- 配额：**按账号**每日 30 次，全局日上限 3000 次
- 超限提示并引导明日再试

---

## 11. 隐私与合规

- 上云数据仅限：用户名、邮箱、密码哈希、错误片段（≤ 200 字符）、配额计数
- 邮件正文与主题行**不上云**，仅存于用户浏览器
- 明确告知：生成内容会发送给第三方模型供应商
- 明确告知：本地历史不加密，清除浏览器数据即丢失
- 明确告知：数据保留期限（建议 180 天），提供导出、删除账号
- 模型供应商的数据条款（是否用于训练）确认后写入隐私页
- 教授数据仅存公开信息，标注来源与更新时间，提供纠错入口
- 使用条款注明：禁止用于群发或骚扰
- 密码重置令牌与验证码均只存哈希

---

## 12. 里程碑

| 阶段 | 内容 | 预计 |
| --- | --- | --- |
| M0 | 仓库骨架、后端 + SQLite、**账号系统（含 consoleMailer）**、部署、`/api/polish` 跑通 | 1 周 |
| M1 | 润色闭环（diff 高亮、原因、复制）、本地历史（Dexie）、语音、新增信息检测 | 1 周 |
| M1.5 | 内测：5–10 名同学 | 1 周 |
| M2 | 生成模式 + 教授自动补全 + 与润色共用结果组件 | 1–2 周 |
| M3 | 学习页（错误上报 + 统计 + 错题本） | 1 周 |
| M4 | 教授目录页、导出导出、模板库、发送前检查清单、移动端打磨 | 按需 |

**外部依赖**：SMTP 发送实现（独立 session）、WorkBuddy 开放平台额度。

---

## 13. 待定事项

| # | 事项 | 影响 |
| --- | --- | --- |
| 1 | WorkBuddy 开放平台：免费额度、QPS、是否允许对外服务、数据条款 | 决定默认 provider |
| 2 | 首批录入哪个学院 / 哪些模块 | 决定教授库 `school` / `department` 枚举 |
| 3 | 个人开发者是否需要企业认证才能创建应用 | 决定能否用 WorkBuddy |
| 4 | 数据保留期限（建议 180 天） | 隐私页文案 + 清理任务 |

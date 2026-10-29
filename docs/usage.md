# RoboEmail 使用说明

从零到跑起来 + 配置真实发信 + 排错。全程 Windows 为例，macOS 把路径换成 `/` 即可。

---

## 1. 你需要准备什么

| 项 | 要求 | 说明 |
| --- | --- | --- |
| Node.js | **24 推荐，最低 22.6** | 服务端直接跑 TS、用 `node:sqlite`，版本太低起不来 |
| pnpm | 11（可选） | 不想装 pnpm 可以用 npm，见 3.2 |
| 磁盘 | 约 300 MB | 含 node_modules |
| 网络 | 配 `LLM_API_KEY` 时需要 | 不配也能跑，走内置 mock |
| 邮箱 | 可选 | 只在你想要"真发验证码"时需要，见第 6 节 |

检查版本：

```powershell
node -v      # 应 ≥ v22.6，推荐 v24.x
pnpm -v      # 没装就先看下面
```

---

## 2. 安装

### 2.1 Windows 一键（推荐）

双击项目根目录的 **`start.cmd`**。它会：

1. 检查 `node_modules`，缺了就自动 `pnpm install`
2. 打开浏览器到 http://localhost:5173
3. 同时启动前后端

第一次运行会比较慢（装依赖），之后是秒开。

### 2.2 手动安装

```powershell
cd E:\UNNC_Y1_FAM\RoboEmail
pnpm install
```

没装 pnpm：

```powershell
npm i -g pnpm@11
```

### 2.3 不想用 pnpm

```powershell
npm install
npm run dev:server    # 窗口 A
npm run dev:web       # 窗口 B
```

> 切换包管理器前先删掉 `node_modules`，两种包管理器不要混用，否则会出现"模块找不到"的怪问题。

---

## 3. 启动与停止

### 3.1 常用命令

| 命令 | 作用 |
| --- | --- |
| `pnpm dev` | 同时启动前端 + 后端（等于 `node dev.mjs`） |
| `pnpm dev:server` | 只启动后端，http://127.0.0.1:8787 |
| `pnpm dev:web` | 只启动前端，http://localhost:5173 |
| `pnpm build` | 构建前端静态文件到 `apps/web/dist` |
| `pnpm check` | 前端语法自检（需要 pnpm store 里的 esbuild） |

启动后终端会显示：

```
接口  http://127.0.0.1:8787
网页  http://localhost:5173
按 Ctrl+C 停止
```

**停止**：在该窗口按 `Ctrl + C`，或直接关窗口。

### 3.2 改了 `.env` 怎么办

必须**完全停掉再启动**。`--watch` 只监听源码文件，不会因 `.env` 变化而重启——这是最常见的"我明明改了配置怎么没生效"。

### 3.3 端口被占用

看到 `EADDRINUSE`：

```powershell
netstat -ano | findstr :8787
taskkill /PID <上面查到的PID> /F
```

或者改 `.env` 里的 `PORT`（改完记得前端 `vite.config.ts` 的代理目标也要跟着改）。

---

## 4. 第一次打开网页

打开 http://localhost:5173，按这个顺序走一遍：

1. **注册** —— 点右上角「登录」→ 注册。密码至少 8 位。
2. **验证码** —— 填邮箱收到的 6 位码。
   - 没配 SMTP 时：验证码直接打印在**启动后端的那个终端窗口**里，形如 `[mailer:console] verification code to=... code=123456`
   - 开发环境下接口还会在响应里返回 `devCode`，网页上也会提示
3. **写邮件** —— 选场景、填字段，生成一封草稿，可以「复制」或「去润色」
4. **润色** —— 贴一段写好的英文，看到逐句改动、改动原因和语气提醒
5. **教授** —— 首屏会让你确认是不是 UNNC 学生（自助声明），确认后能查 576 位老师的邮箱，点「写邮件」会带上正确称呼（Professor / Dr / 全名）
6. **学习** —— 登录后可见，错题本和类别统计
7. **我的** —— 看今日配额、导出本地数据

未登录也能试用润色和生成，每 IP 每天 3 次，不写任何数据。

---

## 5. 环境变量

配置文件放在**项目根目录**的 `.env`（不是 `apps/server/.env`）。从模板复制：

```powershell
cd E:\UNNC_Y1_FAM\RoboEmail
Copy-Item .env.example .env
```

`apps/server/src/env.ts` 是这么读的（写死往上两级）：

```ts
process.loadEnvFile(resolve(appRoot, '../../.env'))
```

| 变量 | 默认 | 作用 | 什么时候要改 |
| --- | --- | --- | --- |
| `NODE_ENV` | `development` | 生产环境会开启 cookie `secure`、关闭 `devCode` | 上线时设 `production` |
| `PORT` | `8787` | 后端端口 | 端口冲突时 |
| `DB_PATH` | `data/roboemail.db` | SQLite 路径，相对 `apps/server` | 想换位置/多环境隔离时 |
| `LLM_BASE_URL` | `https://api.deepseek.com/v1` | OpenAI 兼容接口地址 | 换服务商 |
| `LLM_API_KEY` | 空 | 模型 key；**空则走 mock**，不联网不计费 | 要用真模型时 |
| `LLM_MODEL` | `deepseek-chat` | 模型名 | 换服务商时一起改 |
| `LLM_TIMEOUT_MS` | `60000` | 模型调用超时 | 网络慢时调大 |
| `QUOTA_USER_PER_DAY` | `30` | 登录用户每天次数 | 控成本 |
| `QUOTA_TRIAL_PER_DAY` | `3` | 每 IP 每天试用次数 | |
| `SMTP_HOST` | 空 | SMTP 服务器；**空 = 只打日志** | 要真发信时 |
| `SMTP_PORT` | `465` | 465 隐式 TLS / 587 STARTTLS | 按服务商要求 |
| `SMTP_USER` | 空 | 发信账号（完整邮箱） | |
| `SMTP_PASS` | 空 | **授权码**，不是登录密码 | |
| `MAIL_FROM` | `RoboEmail <SMTP_USER>` | 显示的发件人 | 换自有域名时 |
| `SMTP_PROXY` | 空 | HTTP 代理，如 `http://127.0.0.1:7897` | 出口被墙时 |
| `SMTP_TIMEOUT_MS` | `15000` | 单封发信超时 | |
| `APP_ORIGIN` | `http://localhost:5173` | 生成重置链接的基地址 | 部署后改成正式域名 |

---

## 6. 配置真实发信

### 6.1 QQ 邮箱（当前这套配置，国内推荐）

1. 浏览器打开 `https://mail.qq.com`，登录
2. 顶部「设置」→「账号」（新版：左上菜单 →「设置」→「账号与安全」→「安全设置」）
3. 找到「POP3/IMAP/SMTP/Exchange/CardDAV/CalDAV 服务」
4. 点「IMAP/SMTP 服务」旁边的「开启」，按提示用手机发短信验证
5. 验证通过后弹出 **16 位授权码**，复制下来（关掉窗口就看不到了，可重新生成）

填进 `.env`：

```env
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_USER=你的QQ邮箱@qq.com
SMTP_PASS=那串16位授权码
```

`MAIL_FROM` 不用写，会自动变成 `RoboEmail <你的QQ邮箱@qq.com>`。

### 6.2 163 邮箱

`SMTP_HOST=smtp.163.com`，其余同上。授权码在「设置 → POP3/SMTP/IMAP」里开启后生成。

注意 163 对陌生收件人较严格，验证码邮件可能延迟。

### 6.3 企业邮箱

| 服务商 | SMTP_HOST |
| --- | --- |
| 腾讯企业邮 | `smtp.exmail.qq.com` |
| 阿里企业邮 | `smtp.qiye.aliyun.com` |

账号密码用邮箱密码或客户端专用密码（视管理员设置）。

### 6.4 Gmail（国内直连不通，需要代理）

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=你的地址@gmail.com
SMTP_PASS=16位应用专用密码
SMTP_PROXY=http://127.0.0.1:7897      # 你的代理端口
```

- 应用专用密码需要先开两步验证：`myaccount.google.com/apppasswords`
- 手机上显示的密码带空格（`abcd efgh ijkl mnop`），填入时**去掉空格**
- **国内网络直连 Gmail 的 465/587 会超时**，必须挂代理；代理没开就会看到 `verify timed out after 15000 ms`

### 6.5 验证是否配置成功

重启后端，注册一个新号，看后端终端：

```
[mailer:smtp] verify sent  to=ab******@qq.com  code=**17  id=<...@qq.com>
```

看到 `sent` 就成功了，去邮箱收信。看到 `failed` 就是下面这些问题。

### 6.6 发信常见错误

| 日志/现象 | 原因 | 处理 |
| --- | --- | --- |
| `Invalid login: 535` / `EAUTH` | 密码填成了登录密码 | 换成授权码/应用专用密码 |
| `verify timed out after 15000 ms` | 网络到 SMTP 不通（Gmail 常见） | 换国内邮箱，或配 `SMTP_PROXY` |
| `550` / `553 Mail from must equal authorized user` | 发件人和登录账号不一致 | 清空 `MAIL_FROM`，让它自动取 `SMTP_USER` |
| 注册成功但提示"邮件没能发出去" | 发信失败。账号和验证码已经建好，不影响继续 | 点「重发验证码」；仍失败就修 SMTP。开发环境可直接看服务端日志里的码 |
| 日志有 `sent` 但收不到 | 进了垃圾箱 / 服务商拦截 | 查垃圾邮件文件夹；换企业邮箱 |

> 开发环境只填了 `SMTP_HOST` 而没填账号密码时，程序会打一行警告并回退到日志模式，不会让注册挂掉；生产环境（`NODE_ENV=production`）则直接启动报错。

---

## 7. 数据：在哪、怎么备份、怎么清空

| 数据 | 位置 | 备份 |
| --- | --- | --- |
| 账号、配额、错题、教授库 | `apps/server/data/roboemail.db` | 停服务后复制这三个文件（`.db`、`.db-wal`、`.db-shm`） |
| 草稿、润色历史 | 浏览器 IndexedDB | 「我的」页导出 JSON |

**清空所有服务器数据**（会删掉所有账号）：

```powershell
# 先停掉服务
Remove-Item apps\server\data\roboemail.db* -Force
# 再启动，会自动重建空库
```

**只清某个账号**：用 SQLite 客户端打开 `roboemail.db`，`DELETE FROM users WHERE email='...'`（关联的 sessions、errors 会级联删除）。

---

## 8. 教授库更新

成品数据是 `apps/server/data/professors.json`（576 人）。要重新生成：

```powershell
# 1. 三个学院的员工表格 -> JSON（需要 pandas + openpyxl）
python scripts/xlsx_to_professors.py

# 2. JSON -> SQLite
node scripts/import_professors.mjs
```

**注意**：`scripts/xlsx_to_professors.py` 里 `ROOT` 是硬编码的绝对路径 `E:\UNNC_Y1_FAM\RoboEmail`，项目换位置后要改这一行。

称呼由 `apps/server/src/professors.ts` 按职称推导：教授 → Professor，副教授/助理教授/研究员/导师 → Dr，行政与技术岗用全名。

---

## 9. 常见问题

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `node: command not found` / 版本报错 | Node 未装或太旧 | 装 Node 24 |
| `pnpm: 无法将"pnpm"识别为...` | 没装 pnpm | `npm i -g pnpm@11` |
| 网页白屏 | 后端没起 / 依赖没装 | 看终端有没有报错，重跑 `pnpm dev` |
| 注册提示"这个邮箱已经注册过了" | 该邮箱已验证过 | 换邮箱，或用已有账号登录 |
| 登录提示"用户名或密码错误" | 密码错，或连错 5 次被锁 15 分钟 | 等 15 分钟再试 |
| 登录提示"邮箱还没验证" | 注册后没走验证 | 重新注册同邮箱会补发验证码 |
| 验证码提示"试错太多次" | 同一个码错 5 次 | 重新获取（受每小时 5 次限制） |
| 提示"这个邮箱注册太频繁了" | 1 小时内已发 5 次 | 等一小时，或直接看日志里的码 |
| 改了 `.env` 不生效 | 没重启 | `Ctrl+C` 后重新启动 |
| `database is locked` | 开了两个后端进程 | 只留一个 |
| 教授页是空的 | 没导入数据 | 跑第 8 节的导入脚本 |
| 润色/生成没有真结果 | 没配 `LLM_API_KEY` | 走的是 mock，属预期；要真结果就填 key |

---

## 10. 部署到服务器（简要）

1. 装 Node 24，`pnpm install`，`pnpm build`（生成 `apps/web/dist`）
2. `.env`：`NODE_ENV=production`、`APP_ORIGIN=https://你的域名`
3. 前端 `dist` 交给 Nginx 静态托管；`/api` 反代到 `127.0.0.1:8787`
4. HTTPS 用 Caddy 或 Let's Encrypt
5. 备份 `roboemail.db`
6. 发信换自有域名，配 SPF / DKIM / DMARC，用 mail-tester.com 打分

反向代理示例（Nginx）：

```nginx
server {
  server_name roboemail.example.com;
  root /srv/roboemail/apps/web/dist;
  location / { try_files $uri /index.html; }
  location /api/ { proxy_pass http://127.0.0.1:8787; proxy_set_header X-Forwarded-For $remote_addr; }
}
```

---

## 11. 改动后的自检清单

改完代码，按这个顺序手工跑一遍（约 3 分钟）：

1. `pnpm dev` 能起来，打开 http://localhost:5173 不白屏
2. 注册新邮箱 → 收到码（或日志里看到 `[mailer:console]`）
3. 用收到的码验证 → 成功进入登录态
4. 登录 → 刷新页面仍保持登录
5. 润色一段英文 → 有 diff 和理由
6. 生成一封邮件 → 能复制
7. 教授页能查到人，点「写邮件」称呼正确
8. 学习页（登录后）能看到统计
9. 连错 5 次验证码 → 第 6 次提示"试错太多次"
10. 1 小时内第 6 次注册同一邮箱 → 提示"注册太频繁"
11. 点「忘记密码」→ 填邮箱 → 邮箱收到链接 → 打开能设新密码 → 旧密码登录失败、新密码成功
12. 「我的」页改密码 → 其他窗口被登出，当前窗口仍在线

第 2 条若配置了真实 SMTP，确认日志里是 `[mailer:smtp] verify sent`，且邮箱真的收到。

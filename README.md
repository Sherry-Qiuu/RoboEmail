# RoboEmail

给 UNNC（宁波诺丁汉）学生用的英文邮件写作助手。两个入口：**写邮件**（选目的、填背景，直接拿到中英对照的成稿）和**润色**（贴一段英文草稿，拿回改过的版本、逐条改动理由，以及真实语言错误）。

线上地址：**https://rbem.online**

---

## 功能

| 功能 | 说明 |
| --- | --- |
| 写邮件 | 目的可多选（询问、请假、约时间、套磁…），填收件人、背景、诉求；背景写中文即可，输出是英式英语成稿，附中文对照与段落用意 |
| 润色 | 英英润色，输出改写 + 逐条理由（改了哪里、为什么），并挑出真实语言错误；可多轮继续改 |
| 调整方向 | 标签（更正式 / 更简洁 / 更礼貌 / 更具体，可多选）叠加自由输入，第一次润色和后续每一轮都生效 |
| 教授名录 | 576 位教职工，按院系筛选、按姓名搜索，自动推导邮件称呼（教授 → Professor，副教授及以下 → Dr） |
| 教授档案 | 点任意一行弹出档案卡：照片、职称、院系、邮箱、研究方向、近期论文（链到 DOI 或 Pure 科研页） |
| 语音输入 | 浏览器 Web Speech API，原文和背景都支持口述 |
| 历史记录 | 存在浏览器本地，可复制、删除、导出 Word / PDF / HTML / JSON，也可从 JSON 导入恢复 |
| 学习 | 润色改出的真实语言错误按类别归档，可筛选、标记已掌握，附统计 |
| 账号 | 邮箱验证后登录，忘记密码走邮件链接，设置页可改密码（两次确认） |

未登录可以试用 **1 次**，用完自动跳到注册页。登录后每天 30 次。

---

## 技术栈

- **服务端**：Hono 4 + `node:sqlite`，Node 24 原生类型剥离直接跑 `.ts`，无构建步骤；Argon2id 哈希、zod 校验、httpOnly 会话 cookie
- **前端**：Vite 8 + React 19 + Tailwind 4，历史记录用 IndexedDB，外观用 [Edge Fluent Appearance](https://github.com/Sherry-Qiuu/edge-fluent-appearance)（浅色/深色/五种配色/十种图像主题）
- **模型**：OpenAI 兼容协议，默认 DeepSeek；没填 key 时走内置 mock，不联网不计费
- **部署**：Docker Compose + Caddy（自动 HTTPS），腾讯云轻量 2C2G

---

## 本地运行

需要 Node 22.6 以上（推荐 24）。

```bash
pnpm install
pnpm dev
```

打开 http://localhost:5173

Windows 上双击根目录的 `start.cmd` 也可以，它会自动装依赖并打开浏览器。

不用 pnpm 的话：

```bash
npm install
npm run dev:server   # 一个窗口
npm run dev:web      # 另一个窗口
```

> 切换包管理器前先删掉 `node_modules`，两者不要混用。Windows 上请在 **cmd** 里执行，PowerShell 会把 `rmdir` 映射成别的命令。

### 配置

复制 `.env.example` 为 `.env`。全部留空也能跑：

```
LLM_API_KEY 为空     → 用 mock 模型，界面完全可用，不花钱
SMTP_HOST 为空       → 验证码打印到服务端日志，注册流程照样走通
```

常用变量：

| 变量 | 默认 | 作用 |
| --- | --- | --- |
| `PORT` | `8787` | 服务端口 |
| `DB_PATH` | `data/roboemail.db` | SQLite 路径（相对 `apps/server`） |
| `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` | DeepSeek | 任何 OpenAI 兼容服务 |
| `QUOTA_USER_PER_DAY` | `30` | 登录用户每日次数 |
| `QUOTA_TRIAL_PER_DAY` | `1` | 未登录试用次数（每 IP） |
| `APP_ORIGIN` | `http://localhost:5173` | 生成重置密码链接的域名，**部署后必须改** |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | 空 | 发信配置，465 隐式 TLS，587 STARTTLS |

---

## 目录

```
apps/server
  src/index.ts        路由、限流、静态托管
  src/auth.ts         密码、会话、配额
  src/professors.ts   教授表、称呼推导、启动时播种
  src/profiles.ts     档案数据（照片、研究方向、论文）按邮箱/姓名关联
  src/prompt.ts       两个功能的提示词
  src/db.ts           schema
  data/professors.json   教授名录（576 人）
  assets/profiles.json   档案数据（463 人）
  assets/photos/         压缩后的照片（407 张，7 MB）
apps/web
  src/pages/          写邮件、润色、教授、历史记录、学习、设置、登录
  src/components/     DiffText、SlotText、ProfessorModal、VoiceButton…
  src/store.ts        IndexedDB 历史
  src/export.ts       Word / PDF / HTML / JSON 导出
  public/edge-theme.js 外观系统（单文件，自包含）
docs/                 PRD、部署、使用说明、交接文档
```

---

## 常用命令

```bash
pnpm dev            # 前后端一起起
pnpm build          # 构建前端到 apps/web/dist
pnpm check          # 前端所有模块的语法检查
pnpm smoke          # 端到端回归（临时数据库，23 项检查）
pnpm test:export    # 导出格式的离线检查
pnpm verify:live    # 从本机检查线上：端口、证书、接口、备案号
```

---

## 数据

### 教授名录（576 人）

来自三个学院的员工名录，含行政与技术岗。更新：

```bash
python scripts/xlsx_to_professors.py   # 三个 Excel -> professors.json
node scripts/import_professors.mjs     # JSON -> SQLite（也可以不管，启动时自动播种）
```

### 教授档案（463 人）

照片、研究方向、近期论文，随仓库以 JSON + 压缩照片的形式发布，**不进数据库**——请求时按邮箱（其次姓名）关联到名录行。

```bash
python scripts/import_profiles.py      # 三院教师主页/ -> apps/server/assets/
```

- 407 人有照片，428 人有公开邮箱，1420 篇论文（优先链 DOI，没有则链 Pure 页面）
- 463 份档案覆盖 447 行名录，其余行弹窗只显示基础信息
- 照片版权归宁波诺丁汉大学所有，仅供校内教学与联络使用

---

## 部署

完整步骤见 [`docs/deploy.md`](docs/deploy.md)：买服务器 → 配 DNS → `docker compose up -d --build`。

```bash
git pull
docker compose up -d --build
node scripts/verify-live.mjs   # 八项检查
```

改完 `.env` 必须 `docker compose up -d --force-recreate app`，`restart` 不会重新读取。

---

## 几个约定

- **邮件正文不上云**。正文和历史只存在浏览器 IndexedDB；服务端保存账号信息和被改出的错误片段（`before` / `after` / 中文解释 / 类别），不存整封信。
- **试用不写任何数据**。未登录的计数在内存里，重启即清零。
- **不编造事实**。模型只能用你给的信息，缺什么就留 `{{占位符}}`，前端高亮提示替换。
- **称呼要准**。英国学术习惯下，只有正教授是 Professor，副教授和助理教授是 Dr。

---

## 已知限制

- 服务端依赖 Node 自带的 TypeScript 类型剥离和 `node:sqlite`，需要较新 Node（22.6+，推荐 24），好处是没有构建步骤、不用编译原生模块。
- 历史记录存在浏览器里，换设备不会跟过去，用导出/导入带走。
- Word 导出是 Word 兼容的 `.doc`（HTML 内嵌），不是真正的 `.docx`；PDF 走浏览器打印对话框。
- 试用次数存在内存里，服务重启后就重置。
- 「学习」只收真实语言错误，纯风格改写不进错题本——如果草稿本来就干净，那里会是空的。

---

## 文档

| 文件 | 内容 |
| --- | --- |
| [`docs/PRD.md`](docs/PRD.md) | 需求、边界、数据归属的取舍 |
| [`docs/usage.md`](docs/usage.md) | 使用说明与运维命令 |
| [`docs/deploy.md`](docs/deploy.md) | 从买服务器到上线的完整流程 |
| [`docs/handoff.md`](docs/handoff.md) | 交接：谁做了什么、哪里容易踩坑 |
| [`docs/handoff-two-site.md`](docs/handoff-two-site.md) | 同一台服务器跑两个站的分工与边界 |
| [`docs/two-site-after-filing.md`](docs/two-site-after-filing.md) | 第二站点备案通过后的收尾清单 |

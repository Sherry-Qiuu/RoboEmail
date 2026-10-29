# RoboEmail

给 UNNC 学生用的英文邮件写作助手。写一封新邮件，或者把手上的英文草稿改得更像样。

## 运行

需要 Node 22 以上（推荐 24）。

**最简单：双击项目根目录的 `start.cmd`。** 第一次会自动装依赖，然后打开浏览器。

手动方式：

```bash
pnpm install
pnpm dev
```

打开 http://localhost:5173

没装 pnpm 的话先装一个：

```bash
npm i -g pnpm@11
```

Windows 上这些命令请在 **cmd** 里执行。PowerShell 里 `rmdir /s /q` 会被当成 `Remove-Item` 的别名，直接报错。

### 不想用 pnpm

```bash
npm install
npm run dev:server   # 一个窗口
npm run dev:web      # 另一个窗口
```

换用 npm 之前，先把已有的 `node_modules` 删掉，两种包管理器不要混用。

## 目录

```
apps/server   Hono + node:sqlite，直接用 TS 运行
apps/web      Vite + React + Tailwind
docs          PRD、交接文档 handoff.md、使用说明 usage.md
```

## 几个约定

- 邮件正文和主题只存在浏览器里，服务端不存。上云的只有账号信息和错误片段，见 `docs/PRD.md` 第 5 节。
- 未登录可以试用，试用不写任何数据。
- 填了 `SMTP_HOST` 就会真的发信，留空时验证码打印在服务端日志里，方便本地调试。
- 没有填 `LLM_API_KEY` 时走内置 mock，不联网、不计费，用来调界面。

## 教授库

名单来自 UNNC 三个学院的员工名录（2026-10-29 抓取，共 576 人：理工 247、人文社科 156、商学院 173）。更新流程：

```bash
python scripts/xlsx_to_professors.py   # 三个表格 -> apps/server/data/professors.json
node scripts/import_professors.mjs     # JSON -> SQLite
```

导出脚本需要 pandas 和 openpyxl。称呼由 `apps/server/src/professors.ts` 按职称推导：教授 → Professor，副教授 / 助理教授 / 研究员 / 导师 → Dr，行政与技术岗用全名。

## 已知限制

- 服务端用 Node 自带的 TypeScript 类型剥离直接运行，没有构建步骤，需要 Node 22.6 以上（推荐 24）。
- 数据库用 Node 内置的 `node:sqlite`，同样要求较新的 Node，好处是不用编译原生模块。
- 学习页需要登录，数据来自服务端 `/api/insights`。历史记录存在浏览器本地（IndexedDB），换浏览器不会跟过去，用「我的」页的导出带走。
- 忘记密码链路还没做，密码忘了目前只能人工改库。

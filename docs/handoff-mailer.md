# 交接：把邮箱验证码接上（SMTP）

> 这份是当时的任务说明，已完成。当前状态、验收结果和遗留项见 [handoff.md](handoff.md) 第 6 节。

这份文档给另一个 session 用。目标只有一个：让验证码真的发到学生邮箱。

## 现状

`apps/server/src/mailer.ts` 里已经有一个可用但只会打日志的实现：

```ts
export interface Mailer {
  sendVerificationCode(to: string, code: string): Promise<void>
  sendPasswordReset(to: string, token: string): Promise<void>
}

export const consoleMailer: Mailer = { ... }   // 打印到服务端日志
export const mailer: Mailer = consoleMailer    // 唯一出口
```

注册、验证、限流、验证码存取、过期与重试计数都已经做完并测通。缺的只是"把邮件发出去"这一段。

## 要做的事

1. 新建 `apps/server/src/mailer/smtp.ts`，实现 `Mailer` 接口。
2. 在 `mailer.ts` 里按环境变量选择实现：有 `SMTP_HOST` 就用 smtp，否则用 console。
3. 补环境变量到 `.env.example`。
4. 自己测通两条链路：注册收码、找回密码收链接。

## 不要做的事

- **不要改任何表结构**。`email_codes`、`password_resets` 已经定好。
- **不要在 mailer 里读写数据库**。它只接收"发给谁 + 发什么"，别的都不知道。
- **不要动路由和限流**。`/api/auth/register`、`/api/auth/verify-email` 已经能用。
- **不要把验证码写进接口响应**。目前 `devCode` 只在 `NODE_ENV !== 'production'` 时返回，这个判断要保留。

## 环境变量

```env
SMTP_HOST=
SMTP_PORT=465
SMTP_USER=
SMTP_PASS=
MAIL_FROM="RoboEmail <no-reply@your-domain.com>"
```

## 实现要点

- 465 端口用隐式 TLS，587 用 STARTTLS。两种都要能跑。
- 发信要有超时（建议 15 秒），失败抛错，让上层记日志并返回"稍后再试"，不要静默吞掉。
- 连接可复用（transport 单例），不要每封信重连。
- 日志里**不要打印完整验证码**，只打后两位或直接打脱敏的收件人。

## 邮件内容

验证码邮件：

- 主题：`RoboEmail 验证码`
- 正文：6 位数字，单独一行，字号大一些；写明 10 分钟内有效；写明"不是你本人操作请忽略"。

重置密码邮件：

- 主题：`RoboEmail 重置密码`
- 正文：一个链接 `${APP_ORIGIN}/reset?token=...`，写明 30 分钟内有效、只能使用一次。
- 需要新增 `APP_ORIGIN` 环境变量（本地是 `http://localhost:5173`）。

两封都用纯文本 + 简单 HTML 两个版本，别用花哨模板。

## DNS（上线前必须先配）

发信域名要配齐 SPF、DKIM、DMARC，否则验证码大概率进垃圾箱。配完用 `mail-tester.com` 打一次分，目标 9/10 以上。

## 验收

1. `pnpm dev`，注册一个新账号，服务端日志里应出现通过 SMTP 发送成功的记录，邮箱收到 6 位码。
2. 输错验证码 3 次，第 6 次应提示"试错太多次，重新获取一个"。
3. 连续点"重新发送"6 次，第 6 次应被限流拦下。
4. 走一遍忘记密码，链接能打开并且只能用一次。

## 提示

`.env` 不要提交。发信账号建议单独注册一个，别用自己的学校邮箱当发信人。

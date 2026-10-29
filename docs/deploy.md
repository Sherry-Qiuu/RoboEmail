# 部署

一台服务器 + 一个域名，用 Docker Compose 起两个容器：`app`（Node 跑 API 和前端）+ `caddy`（TLS 与反代）。

---

## 0. 需要准备

| 项 | 说明 |
| --- | --- |
| 服务器 | 香港 / 新加坡轻量，2 核 2G，约 288 元/年 |
| 域名 | `.com` 约 80 元/年，不需要备案（服务器在境外） |
| `.env` | 里面要有真实 SMTP 和 LLM key |

---

## 1. DNS

在域名服务商的解析页加两条 A 记录：

```
@      A   <服务器 IP>
www    A   <服务器 IP>
```

等 5–30 分钟，用 `nslookup 你的域名` 确认已经指向服务器。**这一步没生效，Caddy 就签不下证书**，后面 `https` 会一直失败。

---

## 2. 服务器装 Docker

SSH 登进去（`ssh root@服务器IP`），然后：

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
docker --version
docker compose version
```

两条命令都要有输出。没有 `compose` 子命令说明 docker 太旧，重装。

---

## 3. 把代码放上去

任选一种：

```bash
# A. 从 GitHub（推荐，以后更新只要 git pull）
git clone https://github.com/Sherry-Qiuu/roboemail.git /srv/roboemail

# B. 本地打包再传
scp roboemail.zip root@服务器IP:/srv/
```

放好之后：

```bash
cd /srv/roboemail
```

---

## 4. 配置

```bash
cp .env.example .env
nano .env
```

必须改的几项：

```env
NODE_ENV=production
APP_ORIGIN=https://rbem.online

SMTP_HOST=smtp.qq.com
SMTP_USER=你的邮箱
SMTP_PASS=授权码

LLM_BASE_URL=https://api.deepseek.com/v1
LLM_API_KEY=sk-...
LLM_MODEL=deepseek-chat
```

`Caddyfile` 里已经写好了 `rbem.online, www.rbem.online`，换域名时才需要改。

**`APP_ORIGIN` 必须写成 `https://rbem.online`**，和 Caddyfile 里的域名一致，否则密码重置邮件里的链接会指向错误地址。

---

## 5. 启动

```bash
docker compose up -d --build
```

第一次要装依赖 + 编译前端，约 3–5 分钟。看日志：

```bash
docker compose logs -f app
```

看到 `roboemail server  http://127.0.0.1:8787` 就成了，`Ctrl+C` 退出日志（不会停服务）。

Caddy 签证书可能要几十秒：

```bash
docker compose logs -f caddy
```

出现 `certificate obtained successfully` 就绪。

---

## 6. 验证

1. 浏览器打开 `https://你的域名` —— 应该是落地页
2. `https://你的域名/api/health` —— 返回 `{"ok":true,...}`，`provider` 应该是你的模型名而不是 `mock`
3. 注册一个账号，真的能收到验证码
4. 走一遍忘记密码，确认邮件里的链接是 `https://你的域名/reset?...`

---

## 7. 备份

数据库在 `apps/server/data/roboemail.db`，容器通过 volume 挂到了宿主机。加一条定时任务：

```bash
crontab -e
```

```cron
0 3 * * * cp /srv/roboemail/apps/server/data/roboemail.db /srv/backup/roboemail-$(date +\%F).db
0 4 * * * find /srv/backup -name 'roboemail-*.db' -mtime +14 -delete
```

每天 3 点备份，保留 14 天。`/srv/backup` 要先 `mkdir -p`。

---

## 8. 更新

```bash
cd /srv/roboemail
git pull
docker compose up -d --build
```

数据库不会被覆盖（在 volume 里）。

---

## 9. 常见问题

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 打开 https 超时 | DNS 没生效，或 80/443 被防火墙挡 | `nslookup` 确认解析；云厂商控制台放行 80/443 |
| `certificate obtain failed` | 域名没指向本机，或 80 端口不通 | 先修 DNS；Caddy 走 HTTP-01 验证需要 80 |
| 502 Bad Gateway | app 容器没起来 | `docker compose logs app` 看报错 |
| 页面是旧的 | 浏览器缓存，或没重新 build | `docker compose up -d --build` 后强刷 |
| `database is locked` | 起了两个容器实例 | `docker compose down` 再 `up` |
| 验证码进垃圾箱 | 发件域名不是你自己的 | 换自有域名并配 SPF/DKIM/DMARC，见 `usage.md` 第 6 节 |
| 注册报 500 | SMTP 配置不对 | 看 `docker compose logs app` 里 `[mailer:smtp] failed` |

---

## 10. 安全清单

- [ ] `.env` 权限 `chmod 600`，不要提交到仓库
- [ ] 服务器 SSH 改端口 / 禁用密码登录（可选）
- [ ] `NODE_ENV=production`（cookie 才会带 `secure`，接口不再返回 `devCode`）
- [ ] 云厂商安全组只放行 22 / 80 / 443
- [ ] 定期看 `docker compose logs` 有没有异常

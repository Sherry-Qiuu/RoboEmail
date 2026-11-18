# calhub.asia 上线后的收尾清单（Morrow 侧）

> 2026-11-18 · 对应 RoboEmail 的 [`handoff-two-site.md`](handoff-two-site.md)
> 当前状态：**已上线**。`https://calhub.asia` 返回 200，证书由 Caddy 于 2026-11-18 10:17 签发。
> 本文不含任何密钥。

---

## 0. 一句话

站点已经跑起来了，剩下的是**合规**和**长期维护**两件事：页面底部挂备案号、30 天内办公安联网备案、备份与日志别把 40G 的盘撑爆。

---

## 1. 已确认的事实（2026-11-18 实测）

| 项 | 结果 |
| --- | --- |
| `http://calhub.asia` | `308` → `https://calhub.asia`（不再是备案拦截页） |
| `https://calhub.asia` | `200`，页面 36 KB |
| `https://calhub.asia/api/health` | `200`，`{"ok":true,"service":"morrow",...}` |
| 证书 | Let's Encrypt，`calhub.asia`，有效期至 2027-02-16，自动续期 |
| SSE 头 | Caddy 已配 `flush_interval -1` |
| 宿主机端口 | 未发布，只通过 Caddy 反代 |
| `https://rbem.online` | 未受影响，`v1.1.0` |

**服务器、Caddy、证书都不需要你们再动。** 下面全是内容侧和运维侧的事。

---

## 2. 必做：页面底部挂备案号（法定义务）

工信部要求已备案站点在首页底部展示备案号，并链接到备案查询系统。

### 2.1 拿编号

登录腾讯云备案控制台，`calhub.asia` 会有一条**独立的备案号**，形如：

```
浙ICP备XXXXXXXX号-2
```

**不能复用 `rbem.online` 的那个号。** 同一主体下每个网站各有一个序号。

### 2.2 加在页脚

```html
<a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">
  浙ICP备XXXXXXXX号-2
</a>
```

样式随你们的页面走，但有三条硬要求：

- 必须是**可点击链接**，指向 `https://beian.miit.gov.cn/`
- 必须在**首页底部**，用户不滚动也能看到的位置更好
- 编号与备案系统里的**完全一致**，包括序号

### 2.3 如果也办了公安联网备案

格式固定：**图标在左，编号在右**。

```html
<a href="https://beian.mps.gov.cn/#/query/webSearch?code=<编号去掉前缀>" target="_blank" rel="noreferrer">
  <img src="/gongan.png" alt="" width="14" height="14" />
  浙公网安备XXXXXXXXXXXXXX号
</a>
```

图标从备案系统里下载（“点击下载备案编号图标”），不要自己画。

> RoboEmail 那边的实现可以照抄：`apps/web/src/App.tsx` 的 `<footer>` 块。

---

## 3. 必做：公安联网备案

ICP 备案通过后 **30 个工作日内**要到 `https://beian.gov.cn` 办理公安联网备案，免费，约一周。

> 注意：这是**按网站**办的。`rbem.online` 已经拿到 `浙公网安备33021202004698号`，`calhub.asia` 需要另办一次。

办理后，把上面 2.3 的代码挂上去。

---

## 4. 上线后确认这四件事

### 4.1 对外地址用域名，不用 IP / http

检查你们的环境变量与前端配置：

```bash
grep -E "ORIGIN|CORS|BASE_URL|HOST" /opt/morrow/morrow-agent/.env
```

应该出现 `https://calhub.asia`。如果还留着 `http://` 或 `http://43.142.163.248:8000`，会出现：

- 邮件里的链接打不开（或跳 http 被浏览器拦）
- 前端跨域失败
- Cookie 因 `Secure` 标记不一致而丢失

### 4.2 AI 对话是逐字返回的

Caddy 侧已经配了 `flush_interval -1`，但真正的 SSE 还得应用自己写对响应头：

```
Content-Type: text/event-stream
Cache-Control: no-cache
X-Accel-Buffering: no
```

验证：打开 AI 面板提一个问题，**看答案是逐渐出现，还是一次性整段蹦出来**。一次性出现说明中间某层还在缓冲。

### 4.3 备份

自己一套 cron，文件名带 `morrow` 前缀，别和 `roboemail-*.db` 混：

```bash
0 4 * * * /opt/morrow/backup.sh >> /opt/morrow/backup.log 2>&1
```

**并且真的要试一次恢复。** 备份文件存在但恢复不了，等于没有备份。

### 4.4 日志轮转

40G 的盘，应用日志不轮转会在几个月内撑满，后果是**两个站一起挂**（同一个文件系统）。

Docker 层面加限制，写入 `docker-compose.two-site.yml`：

```yaml
services:
  morrow:
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
```

改完 `docker compose -f docker-compose.two-site.yml up -d` 重建容器生效。

---

## 5. 不要做的事

| 不要 | 原因 |
| --- | --- |
| 起第二个 Caddy / nginx 抢 80、443 | 会直接让两个站同时 502 |
| 给 `morrow` 加 `ports:` | 绕过 HTTPS，且可能与现有端口冲突 |
| 改 `/srv/roboemail/Caddyfile` | 那是我方的仓库文件，改了会在 `git pull` 时冲突 |
| 执行 `docker compose down`（在 roboemail 目录） | 会连带停掉 Caddy，两个站一起下线 |
| 用 `docker system prune -a` | 会删掉 Caddy 的证书卷和镜像 |

改 Caddy 配置的需求（比如加新域名）走 RoboEmail 侧，见 `handoff-two-site.md`。

---

## 6. 验收清单

| # | 检查 | 命令 / 方法 | 期望 |
| --- | --- | --- | --- |
| 1 | 首页可访问 | 浏览器打开 `https://calhub.asia` | 有锁，正常显示 |
| 2 | 健康检查 | `curl -sS https://calhub.asia/api/health` | `{"ok":true,...}` |
| 3 | 备案号 | 滚到页面底部 | 有链接，编号与备案系统一致 |
| 4 | 无宿主机端口 | `docker inspect morrow --format '{{json .NetworkSettings.Ports}}'` | `{}` |
| 5 | 在共享网络里 | `docker inspect morrow --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}'` | 含 `roboemail_default` |
| 6 | SSE 逐字 | 提一个问题看输出 | 逐字出现 |
| 7 | 备份在跑 | `crontab -l` | 有 morrow 自己的那一条 |
| 8 | 日志上限 | `docker inspect morrow --format '{{json .HostConfig.LogConfig}}'` | 有 max-size |

---

## 7. 常见问题

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 502 | Morrow 容器没起 | `docker inspect --format '{{.State.Status}}' morrow` |
| 页面能开但接口 404 | 反代只转发了 `/` | 检查 Caddy 块里的 `reverse_proxy morrow:8000`（已配，别改） |
| AI 回答一次性出现 | 应用层或某层代理缓冲 | 见 4.2 |
| 站点突然整体 404 | 有人在 roboemail 目录执行了 `docker compose down` | `cd /srv/roboemail && docker compose up -d` |
| 证书报错 | 浏览器缓存 | 无痕窗口或强刷 |

---

## 8. 未来如果要做网络隔离

现在两个容器在**同一个 Docker 网络**里，技术上 Morrow 能访问 `app:8787`（接口都要登录态，风险很低）。

若要彻底隔开，需要双方同时改：

1. RoboEmail：`docker-compose.yml` 给 caddy 加一个 `edge` 外部网络
2. Morrow：加入 `edge`，离开 `roboemail_default`
3. 重建 Caddy（`rbem.online` 会中断几秒）

代价是需要安排一次维护窗口，收益有限。**建议两站稳定运行一段时间后再考虑。**

---

## 9. 联系

| 事项 | 找谁 |
| --- | --- |
| Caddy / 证书 / 域名解析 | RoboEmail 侧 |
| Morrow 应用、`/opt/morrow` 下的文件 | Morrow 侧 |
| 备案、服务器续费、安全组 | 站长（你） |

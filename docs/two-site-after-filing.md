# calhub.asia 备案通过后的收尾

> 2026-11-13 · 前置：《[双站同机交接](handoff-two-site.md)》
> 现状：Caddy 已加载 `calhub.asia` 块并经 reload，服务端就绪；只等备案放行。

---

## 0. 怎么确认“备案通过了”

两个信号，缺一不可：

1. 收到短信 / 站内信，里面有**这个域名自己的备案号**（形如 `沪ICP备2026xxxxxx号-2`）
   - 同一主体下第二个网站会拿到新的序号（`-2`、`-3`…），**不能复用 `rbem.online` 的 `-1`**
2. 腾讯云备案控制台里该订单状态为「**已备案**」

只是“审核中”或“管局审核中”都不算。

---

## 1. 立刻验证（3 条命令，1 分钟）

在服务器或本机都行：

```bash
curl -sSI http://calhub.asia | head -3
```

**期望**：`HTTP/1.1 308 Permanent Redirect` → `https://calhub.asia`

**备案前的样子**：`302` → `https://dnspod.qcloud.com/static/webblock.html?d=calhub.asia`（只要还看到 webblock，就是没放行）

```bash
curl -sS https://calhub.asia/api/health
```

**期望**：`{"ok":true,...}`（Morrow 的响应）

```bash
curl -sSI https://calhub.asia | head -3
```

**期望**：`HTTP/2 200`

三条都对，就完成了。放行是腾讯云侧自动的，**服务器不用改任何东西**。

---

## 2. 如果 http 通了、https 还不行

Caddy 在 ACME 失败后会**指数退避重试**，最长可能等几小时。想立刻重试：

```bash
cd /srv/roboemail
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
```

还不行就重启 Caddy（只重启它，不影响 app）：

```bash
docker compose restart caddy
docker compose logs --tail=80 caddy | grep -i -E "acme|certificate"
```

看到 `certificate obtained successfully` 就够了。

常见误判：

| 现象 | 实际原因 |
| --- | --- |
| 浏览器报证书错误 | 浏览器缓存了旧的失败状态，强刷或无痕窗口 |
| `curl` 通、浏览器不通 | 同上，或本地 DNS 缓存（`ipconfig /flushdns`） |
| 一直 502 | 证书好了但 Morrow 没起：`docker inspect --format '{{.State.Status}}' morrow` |

---

## 3. RoboEmail 侧（我做）

备案放行后我会：

- [ ] 复验 `https://rbem.online` 三个指标（健康检查、页面、证书）
- [ ] 复验 `https://calhub.asia` 同样三项
- [ ] 清理 Caddyfile 里冗余的 `header_up X-Forwarded-For`（Caddy 默认就会加，现在每次 reload 都报 WARN）
- [ ] 更新 `handoff-two-site.md` 的状态表，把「待备案」改成「已上线」

这些都不需要你操作。

---

## 4. Morrow 侧（对方）

| 事项 | 要求 |
| --- | --- |
| 备案号 | 网站底部显示**它自己的**备案号，链接到 `https://beian.miit.gov.cn/` |
| 对外地址 | `APP_ORIGIN`、CORS 白名单用 `https://calhub.asia`，别留 `http://` 或 IP |
| SSE | 已配 `flush_interval -1`，确认 AI 对话是逐字返回而不是一次性吐出 |
| 备份 | 自己的 cron、自己的文件名，别和 `roboemail-*` 混 |
| 日志 | 容器日志加轮转，2C2G 的盘经不起无限增长 |

---

## 5. 你（主体负责人）

| 事项 | 说明 |
| --- | --- |
| **公安联网备案** | ICP 备案通过后 **30 天内**要办，`https://beian.gov.cn`，免费，约 1 周 |
| 两个站底部都要有备案号 | `rbem.online` 已有；`calhub.asia` 等 Morrow 加 |
| 安全组 | 只保留 22 / 80 / 443；别再临时开 8787 |
| 备份 | 两套 cron 都在跑（`crontab -l` 应看到两条 `backup.sh`） |
| 续费 | 服务器 2027-10-29 到期、两个域名各自到期，提前一个月续 |

---

## 6. 验收清单

| # | 检查 | 命令 | 期望 |
| --- | --- | --- | --- |
| 1 | calhub 80 跳转 | `curl -sSI http://calhub.asia` | 308 → https |
| 2 | calhub 健康 | `curl -sS https://calhub.asia/api/health` | `{"ok":true,...}` |
| 3 | calhub 页面 | `curl -sSI https://calhub.asia` | 200 |
| 4 | calhub 证书 | 浏览器打开 | 有锁，Let's Encrypt |
| 5 | rbem 未受影响 | `curl -sS https://rbem.online/api/health` | `provider=deepseek-chat` |
| 6 | Morrow 无宿主机端口 | `docker inspect morrow --format '{{json .NetworkSettings.Ports}}'` | `{}` |
| 7 | Morrow 在网络里 | `docker inspect morrow --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}'` | 含 `roboemail_default` |
| 8 | 只有 Caddy 占 80/443 | `ss -lntp \| grep -E ':80\|:443'` | 只有 caddy 容器 |
| 9 | 两个备案号都在页面底部 | 人工看 | 各自链接工信部 |

---

## 7. 常见问题

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 80 还是 webblock 302 | 备案尚未真正生效 | 等 10–30 分钟再试；确认备案号已下发 |
| 80 正常、443 重置 | 同上，443 放行稍慢 | 等一会；`docker compose restart caddy` |
| 证书反复失败 | DNS 没指对 / 80 被占 | `dig calhub.asia`；`ss -lntp \| grep :80` |
| 证书好了但 502 | Morrow 容器没起 | `docker inspect morrow`；`docker logs morrow` |
| 两个站都挂了 | Caddy 配置坏了 | 见 `handoff-two-site.md` 第 7 节回滚 |

---

## 8. 一句话记住

**备案通过 = 腾讯云自动放行，服务器不用动。** 唯一要人工做的是给 Morrow 的页面底部补上它自己的备案号，以及 30 天内的公安联网备案。

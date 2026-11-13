# 双站同机：RoboEmail 侧的交接说明

> 2026-11-13 · 配合《两站同机部署方案》（`E:\UNNC_Y1_FAM\黑客松\两站同机部署方案.md`）执行
> 本文只写 RoboEmail 侧需要做什么、让出什么、验收什么。不含任何密钥。

---

## 1. 一句话

一台服务器跑两个网站：**RoboEmail 的 Caddy 继续独占 80/443**，Morrow 作为容器加入同一个 Docker 网络，Caddy 按域名分流。

```
Internet
   │
Caddy（容器 roboemail-caddy-1）:80/:443
   ├── rbem.online   → app:8787       RoboEmail（不变）
   └── calhub.asia   → morrow:8000    Morrow（新增）
```

---

## 2. 事实清单（执行前先核对）

| 项 | 值 | 怎么确认 |
| --- | --- | --- |
| Caddy | 容器 `roboemail-caddy-1` | `docker ps --format '{{.Names}}'` |
| Docker 网络 | `roboemail_default` | `docker network ls \| grep roboemail` |
| RoboEmail 应用 | 容器 `roboemail-app-1`，内网 8787，**不映射宿主机端口** | `docker ps` 的 PORTS 列为空 |
| 数据库 | `/srv/roboemail/apps/server/data/roboemail.db`，挂载进容器 | `docker compose config` |
| Caddyfile | `/srv/roboemail/Caddyfile`，只读挂载到容器 `/etc/caddy/Caddyfile` | — |

**如果 `docker network ls` 显示的不是 `roboemail_default`**，以实际输出为准，并同步给 Morrow 侧。

---

## 3. 本次改动

只改一个文件：`Caddyfile`，末尾追加 `calhub.asia` 块。

```caddyfile
calhub.asia {
	encode zstd gzip
	reverse_proxy morrow:8000 {
		flush_interval -1                    # Morrow 的 AI 面板用 SSE，不能缓冲
		header_up X-Forwarded-For {remote_host}
	}
	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
		X-Content-Type-Options "nosniff"
		Referrer-Policy "strict-origin-when-cross-origin"
	}
}
```

提交：`700257f feat: serve calhub.asia from the same caddy`

**没有动**：`app` 的 ports / volumes / environment、数据库、`.env`、`docker-compose.yml`。

---

## 4. 对 Morrow 侧的硬性要求

Caddy 靠**容器名**找上游，所以这三条不能变：

| 项 | 要求 | 不满足的后果 |
| --- | --- | --- |
| 容器名 | 必须是 `morrow` | Caddy 解析不到，502 |
| 监听端口 | 容器内 `8000` | 同上 |
| 网络 | 加入 `roboemail_default`，声明 `external: true` | 不在同一网络，解析失败 |
| 宿主机端口 | **一个都不要 publish** | 绕过 HTTPS 暴露，且可能与现有端口冲突 |

Morrow 的 `docker-compose.yml` 片段：

```yaml
services:
  morrow:
    container_name: morrow
    networks:
      - roboemail_default

networks:
  roboemail_default:
    external: true
```

---

## 5. 执行顺序

依赖关系：DNS → Morrow 起来 → 本侧 pull + reload。顺序错了会出现长时间 502。

### 5.1 加 DNS（人工）

DNSPod → `calhub.asia` 加 `@ A 43.142.163.248`，TTL 600。暂不加 `www`。

```bash
nslookup calhub.asia 8.8.8.8     # 必须返回 43.142.163.248
```

### 5.2 让 Morrow 进网络（Morrow 侧）

确认 `docker ps` 里有 `morrow`，且：

```bash
docker inspect morrow --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}'
```

应包含 `roboemail_default`。

### 5.3 本侧拉取并 reload

```bash
cd /srv/roboemail
git pull                                    # 应该更新到 700257f
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
```

reload 成功没有输出。失败的话：

```bash
docker compose restart caddy
docker compose logs --tail=80 caddy
```

### 5.4 验收

```bash
curl -sS https://rbem.online/api/health          # RoboEmail 必须仍然正常
curl -sS https://calhub.asia/api/health          # Morrow
curl -sSI https://calhub.asia | head -3          # 看是否 200 / 502
```

三条都对，才算完成。

---

## 6. 常见故障

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `calhub.asia` 返回 502 | Morrow 没起、容器名不对、不在同一网络 | `docker inspect morrow` 查网络；`docker compose logs morrow` |
| 证书签不下来 | DNS 未生效 / 80 被占 / 备案未接入 | `docker compose logs caddy \| grep -i acme` |
| `rbem.online` 也挂了 | Caddy 配置语法错误导致 reload 失败并退出 | 看 `logs caddy`；回滚见第 7 节 |
| 两个域名都 502 | Caddy 不在网络上 | `docker network connect roboemail_default roboemail-caddy-1` |
| Morrow 内部调用 `app:8787` | 同网络，技术上可达 | 见第 8 节 |

---

## 7. 回滚

只回滚 Morrow，不影响 RoboEmail：

```bash
cd /srv/roboemail
git revert --no-edit 700257f
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
```

或者直接在 Caddyfile 里删掉 `calhub.asia { ... }` 整块再 reload。

**不要**用 `docker compose down` 回滚——那会把两个站一起停掉。

---

## 8. 隔离边界（必须知道）

| 层 | 现状 | 说明 |
| --- | --- | --- |
| 域名 | 完全独立 | cookie / localStorage 天然分开 |
| 进程 | 独立容器 | 一个崩不影响另一个 |
| 数据 | 各自目录、各自 volume | 不共享 |
| 网络 | **共享 `roboemail_default`** | Morrow 技术上能访问 `app:8787`（接口都要登录态，风险低） |
| 端口 | 只有 Caddy 对外 | 两个应用都不 publish |
| 资源 | 同一台 2C2G | 没有 cgroup 限额，一方跑满会拖慢另一方 |

**升级到网络隔离的路径**（两站稳定后再考虑）：

1. 新建网络 `edge`：`docker network create edge`
2. 本侧 `docker-compose.yml` 给 caddy 加 `networks: [default, edge]`，`edge` 声明 external
3. Morrow 改加入 `edge`，不再加入 `roboemail_default`
4. 重建 caddy（`rbem.online` 会中断几秒）

在此之前，两个站是「独立进程、共享网络」。

---

## 9. 不要做的事

- 不要为 Morrow 再起一个 Caddy，也不要让它抢 80/443
- 不要执行 `docker compose down`
- 不要改 `app` 的 ports / volumes / environment
- 不要把 Morrow 的容器名改成 `morrow-agent` 之类（Caddyfile 里写的是 `morrow`）
- 不要在 `calhub.asia` DNS 没生效前就 reload（会反复申请证书失败）

---

## 10. 双方各自要记住的一句

- **RoboEmail 侧**：Caddy 是唯一入口，改 Caddyfile 必须 reload，回滚只 revert 那一个提交
- **Morrow 侧**：容器名 `morrow`、端口 `8000`、加入 `roboemail_default`、不 publish 端口

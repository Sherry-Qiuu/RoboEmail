# 2026-11-25 安全事件与恢复交接

> 读者：RoboEmail 维护者、Morrow 维护者、站长
> 状态：**RoboEmail 已恢复上线；Morrow 待重新部署**。本文不含任何密钥。

---

## 1. 一句话

服务器被暴力破解登录过一次，已于 2026-11-25 凌晨重装系统并恢复。RoboEmail 数据完整、功能正常；Morrow 的容器和代码随重装一起消失，需要重新部署。

---

## 2. 发生了什么

| 时间（2026-11-24） | 事件 |
| --- | --- |
| 22:27 | `162.14.123.146` 开始对 22 端口暴力破解 |
| 22:30 | 密码被猜中，以 `ubuntu` 身份登录成功 |
| 22:32 | 在 `authorized_keys` 里加入一把陌生密钥（持久化） |
| 22:38 | 执行 `/usr/bin/lookme`（黑帽 SEO 引流工具），腾讯云主机安全告警 |
| 当晚 | 排查：无 root 密钥、无新增用户、无恶意 cron、无 systemd 服务、无外连 |

**成因**：22 端口对全网开放 + SSH 密码认证开启 + 口令较弱。属于自动化扫描的典型命中，与站点内容无关。

**处置**：`2026-11-25 00:40–01:05` 重装系统（Ubuntu 24.04），保留原公网 IP，从备份恢复。

---

## 3. RoboEmail 现状

### 3.1 运行状态（公网实测）

```
https://rbem.online/api/health
{"ok":true,"version":"1.1.0","provider":"deepseek-chat","env":"production"}

证书  Let's Encrypt，2026-11-24 签发，2027-02-22 到期
页面  200
```

### 3.2 数据恢复情况

| 表 | 条数 |
| --- | --- |
| users | 5 |
| errors | 4 |
| professors | 576 |
| feedback | 0 |

与重装前完全一致。

### 3.3 已完成的配置

- `/srv/roboemail`：`docker compose` 两容器（`roboemail-app-1` + `roboemail-caddy-1`）
- `.env`：模型与 SMTP 全部换成**新申请的凭据**（旧 key 已在控制台吊销）
- 数据库：从 `VACUUM INTO` 快照恢复，当前无残留 `-wal` / `-shm`
- 系统：全新安装，无历史残留文件

### 3.4 待办

- [x] 系统盘快照已删除（2026-11-25）
- [x] 定时备份 `/srv/backup.sh` 与 crontab 已恢复（每日 03:00，已验证 `backup ok`）
- [x] SMTP 发信已验证（`[mailer:smtp] reset sent ... id=...@qq.com`）

**22 端口保持对公网开放**，这是有意的选择：接下来要多人在不同网络下测试。安全靠关闭密码认证来保证，见第 5 节。

---

## 4. Morrow 现状

### 4.1 现在是什么状态

```
https://calhub.asia  →  502
```

证书已被 Caddy 重新签发（`calhub.asia`，同批，2027-02-22 到期），**80/443 和 Caddy 侧配置都是好的**。502 的唯一原因是 `morrow` 容器不存在——它随系统盘一起被清空了。

### 4.2 可直接使用的备份

在站长电脑上（`D:\Download\backup-20261125\`）：

| 文件 | 内容 |
| --- | --- |
| `env.morrow` | Morrow 的环境变量（3.8 KB） |
| `morrow-data.tar.gz` | Morrow 的数据目录 `/data`（74 KB） |
| `env.roboemail` | RoboEmail 的 `.env`（已恢复，留作参考） |
| `roboemail.db` | RoboEmail 数据库快照（已恢复） |
| `crontab.txt` | 事件前的定时任务清单 |

系统盘快照已于 2026-11-25 删除，因此上表是 Morrow 目前**仅有的**恢复材料：数据在 `morrow-data.tar.gz`，环境变量在 `env.morrow`，**代码需要从自己的仓库重新部署**。

### 4.3 Morrow 需要做的事

按顺序，每一步独立完成：

1. **准备代码**：从自己的仓库部署到 `/opt/morrow`（系统盘快照已于 2026-11-25 删除，不能从这里取回）
2. **恢复环境变量**：用备份里的 `env.morrow` 覆盖，确认 `APP_ORIGIN`、CORS 白名单都是 `https://calhub.asia`
3. **恢复数据**：解压 `morrow-data.tar.gz` 到数据卷对应目录
4. **接入共享网络**（关键，不做就是 502）：

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

   容器名必须是 **`morrow`**，内部端口 **`8000`**，**不要**发布任何宿主机端口。

5. **启动并验证**：

   ```bash
   docker compose -f docker-compose.two-site.yml up -d --build
   curl -sS https://calhub.asia/api/health
   ```

6. **补备案号**：页面底部展示 `calhub.asia` 自己的 ICP 备案号，链接到 `https://beian.miit.gov.cn/`（详见 `docs/handoff-morrow-remaining.md`）

### 4.4 Morrow 不要做的事

| 不要 | 原因 |
| --- | --- |
| 起自己的 Caddy / nginx 抢 80、443 | 两个站会同时 502 |
| 改 `/srv/roboemail/Caddyfile` | 那是 RoboEmail 的仓库文件，`git pull` 会冲突 |
| 执行 `docker compose down`（在 roboemail 目录） | 会连带停掉 Caddy |
| 加 `ports:` 映射 | 绕过 HTTPS，且可能与现有端口冲突 |
| 重新加 `/etc/ssh/sshd_config.d/99-morrow.conf` | 这个文件上次把密码认证打开了，是本次事件的直接诱因之一 |

---

## 5. 安全基线（两边都要遵守）

| 项 | 要求 | 现状 |
| --- | --- | --- |
| **SSH 密码认证** | **必须关闭** | ✅ `passwordauthentication no` |
| SSH 端口 | 对公网开放（便于多人测试） | ✅ `0.0.0.0/0`，见下方说明 |
| root 登录 | 建议禁用 | 待设置 |
| 公网端口 | 只开 22 / 80 / 443 | ✅ |
| 应用端口 | 一律不发布到宿主机 | ✅ |
| 密钥轮换 | 事件后全部重发 | ✅ 模型与 SMTP 已换 |
| 备份 | 每日一次 | ✅ 已恢复 |

### 5.1 为什么 22 开放仍然安全

这次事件成立需要三个条件同时满足：**端口开放 + 密码认证开启 + 口令较弱**。

现在第二个条件被彻底关掉了。SSH 只接受密钥，扫描器试多少次都没用——这不是"风险变低了"，而是**那条攻击路径不存在了**。

因此对公众开放在当前场景下是可接受的。**唯一的红线是：任何时候都不要重新打开密码认证。**

### 5.2 开放期间的注意事项

- 测试者如果需要在服务器上执行命令，用**不带 sudo、不在 docker 组**的账号，不要共用 `ubuntu`
- 密钥一旦发给外部人员就无法收回，**给测试者单独生成一把**，结束时删除对应账号即可
- 建议装 `fail2ban`，减少扫描噪音并记录来源：`apt install -y fail2ban && systemctl enable --now fail2ban`
- 每周看一眼登录记录：`last -a | head -10`，出现不认识的 IP 或用户名立即排查

**如果 Morrow 需要从外部 SSH 进来部署**：同样用密钥，不要开密码认证；部署完成后把这把密钥删掉。上次的 `/etc/ssh/sshd_config.d/99-morrow.conf` 就是因为图方便打开密码认证，直接导致了这次事件。

---

## 6. 分工

| 事项 | 负责 |
| --- | --- |
| RoboEmail 应用、Caddy、证书、`/srv/roboemail` | RoboEmail |
| Morrow 应用、`/opt/morrow`、自己的数据与备份 | Morrow |
| 服务器重装、安全组、备案、续费、系统盘快照 | 站长 |

---

## 7. 时间线备注

- 事件前服务器运行约 26 天（2026-10-29 开通）
- 重装后公网 IP 保持不变，**两个域名的备案无需变更接入**
- 重装后 Let's Encrypt 证书重新签发，两个域名各一张，有效期至 2027-02-22
- 系统盘快照已于 2026-11-25 删除，不再计费

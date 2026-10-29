# 部署与运维

这台机器已经在跑。下面是**实际生效**的步骤，不是通用教程——国内的网络环境让通用教程里的三条命令都会失败，修正写在第一节。

## 0. 现状

| 项 | 值 |
| --- | --- |
| 服务器 | 腾讯云轻量，上海二区，2 核 2G / 3M 带宽 / 40G |
| 公网 IP | `43.142.163.248` |
| 系统 | Ubuntu 24.04 LTS |
| 访问地址 | `http://43.142.163.248:8787`（备案期间，用 IP） |
| 代码位置 | `/srv/roboemail` |
| 数据库 | `/srv/roboemail/apps/server/data/roboemail.db` |
| 运行方式 | Docker，只起 `app` 一个容器；`caddy` 等备案后再起 |

## 1. 国内三处必踩的坑

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `GET https://get.docker.com` 报 `Recv failure` | 被墙 | 改用 Ubuntu 自带的 `docker.io` |
| `git clone github.com` 报 `GnuTLS recv error` | 被墙 | 加镜像前缀 `https://ghfast.top/` |
| `docker pull node:24-slim` 报 `i/o timeout` | Docker Hub 被墙 | 配 `registry-mirrors` |
| 构建时 `ERR_PNPM_IGNORED_BUILDS` | pnpm 11 把跳过安装脚本当失败 | 加 `--ignore-scripts` |

---

## 2. 从零重装（换机器时照抄）

```bash
# 2.1 装 Docker
sudo -i
apt-get update
apt-get install -y docker.io docker-compose-v2
systemctl enable --now docker
docker --version && docker compose version
```

```bash
# 2.2 配镜像源，否则拉不到基础镜像
mkdir -p /etc/docker && cat > /etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": [
    "https://mirror.ccs.tencentyun.com",
    "https://docker.m.daocloud.io",
    "https://docker.1ms.run"
  ]
}
EOF
systemctl daemon-reload && systemctl restart docker
```

```bash
# 2.3 拉代码（GitHub 直连不通，走镜像）
mkdir -p /srv && cd /srv
git clone https://ghfast.top/https://github.com/Sherry-Qiuu/RoboEmail.git roboemail
cd roboemail
```

```bash
# 2.4 配置
cp .env.example .env
nano .env          # 填 SMTP、LLM key；APP_ORIGIN 写 http://服务器IP:8787
chmod 600 .env
```

```bash
# 2.5 构建并启动（只起 app，caddy 用不上）
nohup docker compose up -d --build app > build.log 2>&1 &
tail -f build.log
```

> 服务器 SSH 会不定期断线。用 `nohup ... &` 让构建在后台跑，断了也不影响，重连后 `tail -f build.log` 继续看。

**防火墙**：控制台 → 防火墙 → 放行 `TCP:8787`（22/80/443 默认已开）。

---

## 3. 日常运维

```bash
# 看是否在跑
docker compose ps

# 看日志（Ctrl+C 只退出查看，不影响服务）
docker compose logs -f app

# 重启（改完 .env 必须重启）
docker compose restart app

# 备份数据库
cp apps/server/data/roboemail.db /srv/backup-$(date +%F).db
```

**每天自动备份**：

```bash
mkdir -p /srv/backup && crontab -e
```

```cron
0 3 * * * cp /srv/roboemail/apps/server/data/roboemail.db /srv/backup/roboemail-$(date +\%F).db
0 4 * * * find /srv/backup -name 'roboemail-*.db' -mtime +14 -delete
```

**更新代码**：

```bash
cd /srv/roboemail
git pull
docker compose up -d --build app
```

数据库在 volume 里，重新构建不会丢。

---

## 4. 备案通过后切到域名 + HTTPS

```bash
# 4.1 DNS 加两条 A 记录：@ 和 www → 43.142.163.248
# 4.2 改 .env 里的 APP_ORIGIN
nano .env        # APP_ORIGIN=https://rbem.online
```

```bash
# 4.3 起 Caddy（自动申请证书，Caddyfile 里已写好 rbem.online）
docker compose up -d
docker compose logs -f caddy     # 等 "certificate obtained successfully"
```

```bash
# 4.4 可选：关掉 8787 的对外映射
# 编辑 docker-compose.yml，删掉 app 服务下 ports 那两行，然后
docker compose up -d
```

之后访问 `https://rbem.online`。

---

## 5. 排错

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 浏览器超时，容器是 Up | 防火墙没放行 8787 | 控制台补规则 |
| `i/o timeout` 拉镜像 | 镜像源没生效 | `docker info \| grep -A3 Mirror` 检查 |
| 构建报 `ERR_PNPM_IGNORED_BUILDS` | Dockerfile 漏了 `--ignore-scripts` | 见 2.1 |
| 502 / 容器起不来 | 看日志 | `docker compose logs app` |
| 验证码收不到 | SMTP 配置错 | 日志里搜 `[mailer:smtp] failed` |
| 页面能开但模型没反应 | key 错或过期 | 日志搜 `[polish]`；访问 `/api/health` 看 provider |
| `database is locked` | 起了两个实例 | `docker compose down` 再 `up` |

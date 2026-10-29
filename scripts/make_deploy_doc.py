from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

FONT = "微软雅黑"
CODE = "Consolas"
INK = RGBColor(0x1A, 0x1A, 0x1A)
MUTED = RGBColor(0x66, 0x66, 0x66)


def set_font(run, name, size, bold=False, color=INK):
    run.font.name = name
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = color
    run._element.rPr.rFonts.set(qn("w:eastAsia"), name)


def para(doc, text, size=10.5, bold=False, color=INK, space_after=4):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.line_spacing = 1.2
    set_font(p.add_run(text), FONT, size, bold, color)
    return p


def heading(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(9)
    p.paragraph_format.space_after = Pt(3)
    set_font(p.add_run(text), FONT, 12, True)
    return p


def bullet(doc, text):
    p = doc.add_paragraph(style="List Bullet")
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.line_spacing = 1.2
    set_font(p.add_run(text), FONT, 10.5)
    return p


def code(doc, lines):
    for line in lines:
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(0)
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.line_spacing = 1.05
        p.paragraph_format.left_indent = Cm(0.4)
        set_font(p.add_run(line), CODE, 9, color=RGBColor(0x22, 0x22, 0x22))


def table(doc, rows, widths):
    t = doc.add_table(rows=0, cols=len(rows[0]))
    t.style = "Table Grid"
    t.alignment = WD_TABLE_ALIGNMENT.LEFT
    for index, row in enumerate(rows):
        cells = t.add_row().cells
        for col, value in enumerate(row):
            cells[col].width = Cm(widths[col])
            cp = cells[col].paragraphs[0]
            cp.paragraph_format.space_after = Pt(1)
            cp.paragraph_format.space_before = Pt(1)
            set_font(cp.add_run(value), FONT, 9.5, bold=(index == 0))
    return t


doc = Document()
section = doc.sections[0]
section.top_margin = Cm(1.8)
section.bottom_margin = Cm(1.8)
section.left_margin = Cm(2.0)
section.right_margin = Cm(2.0)

title = doc.add_paragraph()
title.paragraph_format.space_after = Pt(2)
set_font(title.add_run("RoboEmail 上线记录与运维手册"), FONT, 19, True)

para(doc, "2026-10-29 · 已上线 · 腾讯云轻量 上海二区", 9, color=MUTED, space_after=8)

heading(doc, "一、现状")
table(
    doc,
    [
        ("项", "值"),
        ("公网 IP", "43.142.163.248"),
        ("访问地址", "http://43.142.163.248:8787（备案期间用 IP）"),
        ("服务器", "2 核 2G / 3M 带宽 / 40G，Ubuntu 24.04"),
        ("代码位置", "/srv/roboemail"),
        ("数据库", "apps/server/data/roboemail.db"),
        ("运行方式", "Docker，只起 app 容器；caddy 等备案后再起"),
    ],
    [3.0, 13.2],
)
para(doc, "健康检查：curl http://43.142.163.248:8787/api/health，provider 应为 deepseek-chat。", 9.5, color=MUTED, space_after=2)

heading(doc, "二、日常运维")
code(
    doc,
    [
        "cd /srv/roboemail",
        "docker compose ps                  # 是否在跑",
        "docker compose logs -f app         # 看日志，Ctrl+C 只退出查看",
        "docker compose restart app         # 改完 .env 必须重启",
    ],
)

heading(doc, "三、备份与更新")
bullet(doc, "每天自动备份数据库，保留 14 天")
code(
    doc,
    [
        "mkdir -p /srv/backup && crontab -e",
        "0 3 * * * cp /srv/roboemail/apps/server/data/roboemail.db /srv/backup/roboemail-$(date +\\%F).db",
        "0 4 * * * find /srv/backup -name 'roboemail-*.db' -mtime +14 -delete",
    ],
)
bullet(doc, "改了代码之后")
code(doc, ["cd /srv/roboemail && git pull && docker compose up -d --build app"])

heading(doc, "四、备案通过后切域名 + HTTPS")
bullet(doc, "DNS 加两条 A 记录：@ 和 www 都指向 43.142.163.248")
bullet(doc, "把 .env 里的 APP_ORIGIN 改成 https://rbem.online")
bullet(doc, "起 Caddy，它会自动申请并续期证书（Caddyfile 已写好 rbem.online）")
code(doc, ["docker compose up -d", "docker compose logs -f caddy   # 等 certificate obtained"])
para(doc, "看到证书成功就可以用 https://rbem.online 访问，8787 端口可以从 compose 里删掉。", 9.5, color=MUTED, space_after=2)

heading(doc, "五、国内必踩的四个坑（已解决）")
table(
    doc,
    [
        ("现象", "原因", "处理"),
        ("get.docker.com 连接被重置", "被墙", "改用 apt 装 docker.io"),
        ("git clone 报 GnuTLS 错误", "GitHub 被墙", "前缀加 https://ghfast.top/"),
        ("拉镜像 i/o timeout", "Docker Hub 被墙", "配 registry-mirrors 腾讯云源"),
        ("构建报 ERR_PNPM_IGNORED_BUILDS", "pnpm 11 严格模式", "install 加 --ignore-scripts"),
    ],
    [5.6, 3.8, 6.8],
)

heading(doc, "六、排错")
table(
    doc,
    [
        ("现象", "处理"),
        ("浏览器超时但容器 Up", "控制台防火墙放行 TCP:8787"),
        ("验证码收不到", "日志搜 [mailer:smtp] failed，检查 SMTP_PASS 是授权码不是密码"),
        ("页面能开但模型没反应", "日志搜 [polish]；看 /api/health 的 provider 是不是 deepseek-chat"),
        ("database is locked", "docker compose down 再 up，别开两个实例"),
    ],
    [4.6, 11.6],
)

heading(doc, "七、下一步")
bullet(doc, "备案：腾讯云控制台顶部「备案」→ 首次备案 → 网站名称写「个人邮件写作工具」")
bullet(doc, "等备案期间继续用 IP 访问，不要把域名解析过去")
bullet(doc, "通过后按第四节切 HTTPS")

doc.save(r"E:\UNNC_Y1_FAM\RoboEmail\RoboEmail-上线清单.docx")
print("saved")

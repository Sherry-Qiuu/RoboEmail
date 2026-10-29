# Build the Faculty of Science and Engineering staff workbook from scraped data.
import json
import re
from collections import Counter
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.table import Table, TableStyleInfo

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
OUT = ROOT / "UNNC_理工学院_员工信息.xlsx"

DEPT_MAP = {
    "Architecture and Built Environment": "Architecture and Built Environment",
    "Chemical and Environmental Engineering": "Chemical and Environmental Engineering",
    "Civil Engineering": "Civil Engineering",
    "Computer Science": "Computer Science",
    "Electrical and Electronic Engineering": "Electrical and Electronic Engineering",
    "Geographical Sciences": "Geographical Sciences",
    "Mathematical Sciences": "Mathematical Sciences",
    "Mechanical, Materials and Manufacturing Engineering": "Mechanical, Materials and Manufacturing Engineering",
    "Science and Engineering Education": "Science and Engineering Education",
    "Faculty of Science and Engineering": "Faculty of Science and Engineering (faculty office)",
    "FOSE Technician Team": "Faculty of Science and Engineering (faculty office)",
}

DEPT_CN = {
    "Architecture and Built Environment": "建筑与建成环境系",
    "Chemical and Environmental Engineering": "化学与环境工程系",
    "Civil Engineering": "土木工程系",
    "Computer Science": "计算机科学系",
    "Electrical and Electronic Engineering": "电气与电子工程系",
    "Geographical Sciences": "地理科学系",
    "Mathematical Sciences": "数学科学系",
    "Mechanical, Materials and Manufacturing Engineering": "机械、材料与制造工程系",
    "Science and Engineering Education": "科学与工程教育系",
    "Faculty of Science and Engineering (faculty office)": "理工学院院部",
}

TITLE_CN = {
    "Professor": "教授",
    "Associate Professor": "副教授",
    "Assistant Professor": "助理教授",
    "Lecturer": "讲师",
    "Teaching Fellow": "教学研究员",
    "Senior Tutor": "高级导师",
    "Tutor": "导师",
    "Research Fellow": "研究员",
    "Senior Research Fellow": "高级研究员",
    "Principal Research Fellow": "首席研究员",
    "Postdoctoral Research Fellow": "博士后研究员",
    "Research Assistant": "研究助理",
    "Technician": "技术员",
    "Head of Department": "系主任",
    "Dean": "院长",
    "Visiting": "访问",
    "Chair Professor": "讲座教授",
}


def title_cn(title: str) -> str:
    t = (title or "").lower()
    prefix = "访问" if "visiting" in t else ("荣誉" if "honorary" in t else "")
    checks = [
        ("chair professor", "讲座教授"),
        ("associate professor", "副教授"),
        ("assistant professor", "助理教授"),
        ("dean", "院长"),
        ("head of department", "系主任"),
        ("head of school", "院长"),
        ("provost", "教务长"),
        ("senior research fellow", "高级研究员"),
        ("principal research fellow", "首席研究员"),
        ("postdoctoral research fellow", "博士后研究员"),
        ("research fellow", "研究员"),
        ("research assistant", "研究助理"),
        ("professor", "教授"),
        ("senior tutor", "高级导师"),
        ("teaching fellow", "教学研究员"),
        ("lecturer", "讲师"),
        ("tutor", "导师"),
        ("technician", "技术员"),
        ("administrator", "行政"),
        ("officer", "专员"),
        ("manager", "经理"),
        ("director of technical services", "技术服务主任"),
        ("operations director", "运营总监"),
        ("director", "主任"),
    ]
    for en, cn in checks:
        if en in t:
            return prefix + cn
    return ""


def clip(s: str, limit: int) -> str:
    if not s:
        return ""
    s = s.strip()
    return s if len(s) <= limit else s[: limit - 1].rstrip(" ,;.") + "…"

RESEARCH_TITLES = ("Research Fellow", "Research Assistant", "Postdoctoral", "Principal Research Fellow",
                   "Senior Research Fellow", "Research Associate")
ACADEMIC_TITLES = ("Professor", "Lecturer", "Tutor", "Teaching Fellow")
SERVICE_TITLES = ("Technician", "Administrator", "Officer", "Manager", "Partner", "Coordinator",
                  "Assistant", "Secretary", "Adviser", "Librarian", "Director of", "Operations")


def norm_name(name: str) -> str:
    s = re.sub(r"\s+", " ", name or "").strip()
    # strip honorifics only when they are a separate token (case-sensitive for the
    # short forms so names such as "Drew" or "Penn" are never touched)
    s = re.sub(r"^(Professor|Prof\.?|Dr\.?|Mr\.?|Mrs\.?|Ms\.?|Miss)\s+", "", s)
    s = re.sub(r"^(PhD|Ph\.D\.)\s*,?\s*", "", s, flags=re.I)
    s = re.sub(r"^PE\b\s*,?\s*", "", s)
    return s.strip(" ,")


def fix_case(s: str) -> str:
    # normalise SHOUTED surnames from the source (e.g. "Yong SUN", "LAI Nai Yeen Gavin")
    if not s:
        return s
    out = []
    for w in s.split():
        core = re.sub(r"[^A-Za-z]", "", w)
        if len(core) >= 2 and core.isupper() and "'" not in w and "-" not in w:
            out.append(w[0].upper() + w[1:].lower())
        else:
            out.append(w)
    return " ".join(out)


def display_name(p: dict) -> str:
    listing = fix_case(norm_name(p.get("name") or ""))
    candidate = fix_case(norm_name(p.get("name_profile") or p.get("name_pure") or p.get("name_cms") or ""))
    if not candidate:
        return listing
    # The directory listing is authoritative. Reject profile names that are
    # truncated tails (e.g. "nny Hu" for "Penny Hu") or that differ materially.
    if candidate in listing and len(candidate) < len(listing):
        return listing
    if abs(len(candidate) - len(listing)) > 2:
        return listing
    if listing and set(candidate.split()) == set(listing.split()):
        return listing
    return candidate


def clean_text(s: str) -> str:
    if not s:
        return ""
    s = str(s)
    s = re.sub(r"\s*;\s*$", "", s)
    s = re.sub(r"\s+", " ", s)
    s = s.replace(" ;", ";")
    return s.strip()


def category(title: str) -> str:
    t = title or ""
    if any(k in t for k in RESEARCH_TITLES):
        return "Research staff"
    if any(k in t for k in SERVICE_TITLES) and "Professor" not in t:
        return "Professional services / technical"
    if any(k in t for k in ACADEMIC_TITLES):
        return "Academic staff"
    if "Professor" in t:
        return "Academic staff"
    return "Other"


def norm_email(email: str):
    if not email:
        return "", ""
    raw = email.strip()
    note = ""
    e = raw.replace(" ", "")
    if "," in e.split("@")[1] if "@" in e else False:
        e = e.replace(",", ".", 1)
        note = "corrected typo in source ('nottingham,edu.cn')"
    if not re.fullmatch(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}", e):
        return raw, "unrecognised format in source"
    if not e.lower().endswith("@nottingham.edu.cn"):
        note = (note + "; " if note else "") + "external address listed on profile"
    return e, note


def main():
    people = json.loads((DATA / "profiles.json").read_text(encoding="utf-8"))
    rows = []
    for p in people:
        dept_raw = (p.get("dept_raw") or "").split(" / ")[0].strip()
        dept = DEPT_MAP.get(dept_raw, dept_raw or "Not stated")
        title = clean_text(p.get("title") or p.get("title_pure") or p.get("title_cms") or "")
        title = re.sub(r"^(Dr\.?|PhD,?\s*PE,?|Ph\.D\.,?)\s+", "", title).strip(" ,")
        # collapse duplicated title segments produced by Pure
        parts = [x.strip() for x in title.split(",")]
        seen, dedup = set(), []
        for part in parts:
            key = part.lower()
            if key and key not in seen:
                seen.add(key)
                dedup.append(part)
        title = ", ".join(dedup)
        title = re.sub(r"^(Dr\.?|PhD|Ph\.D\.)\s*,?\s*", "", title).strip(" ,")

        email, email_note = norm_email(p.get("email"))
        research = clean_text(p.get("research") or p.get("research_pure") or "")
        bio = clean_text(p.get("bio") or p.get("bio_pure") or "")
        prof_info = clean_text(p.get("prof_info_pure") or "")
        if prof_info and prof_info.lower() not in bio.lower():
            bio = (prof_info + " | " + bio).strip(" |")
        quals = clean_text(p.get("qualifications") or p.get("qualifications_pure") or "")

        profile_url = p.get("profile_url") or ""
        if p.get("pure_url"):
            profile_url = p["pure_url"]
        elif p.get("recovered_url"):
            profile_url = p["recovered_url"]

        notes = []
        if not email:
            notes.append("Email: not published")
        elif email_note:
            notes.append(email_note)
        if not p.get("telephone"):
            notes.append("Phone: not published")
        if not p.get("office"):
            notes.append("Office: not published")

        rows.append({
            "name": display_name(p),
            "name_cn": "",
            "dept": dept,
            "dept_cn": DEPT_CN.get(dept, ""),
            "title": title,
            "title_cn": title_cn(title),
            "category": category(title),
            "email": email,
            "phone": clean_text(p.get("telephone") or ""),
            "office": clean_text(p.get("office") or ""),
            "research": clip(research, 300),
            "bio": clip(bio, 450),
            "quals": clip(quals, 220),
            "profile_url": profile_url,
            "notes": "; ".join(notes),
        })

    # manual fixes from source inspection
    for r in rows:
        if r["name"] == "Helen Li" and r["email"].lower().startswith("helen.li@"):
            r["email"] = "helen.li@nottingham.edu.cn"
            r["notes"] = "email typo corrected from source ('nottingham,edu.cn')"
        if r["name"] == "Gigi Lu":
            r["email"] = "Gigi.LU@nottingham.edu.cn"
            r["notes"] = r["notes"].replace("unrecognised format in source", "").strip("; ")

    # sort: department order, then academic rank, then name
    dept_order = {d: i for i, d in enumerate([
        "Architecture and Built Environment", "Chemical and Environmental Engineering", "Civil Engineering",
        "Computer Science", "Electrical and Electronic Engineering", "Geographical Sciences",
        "Mathematical Sciences", "Mechanical, Materials and Manufacturing Engineering",
        "Science and Engineering Education", "Faculty of Science and Engineering (faculty office)"])}
    rank = {"Professor": 0, "Chair": 0, "Associate Professor": 1, "Assistant Professor": 2,
            "Lecturer": 3, "Teaching Fellow": 4, "Tutor": 5, "Research": 6}

    def rank_key(r):
        t = r["title"].lower()
        if any(k in t for k in ("chair professor", "dean", "head of department", "head of school")):
            return 0
        if "associate professor" in t:
            return 2
        if "professor" in t:
            return 1
        if "assistant professor" in t:
            return 3
        if "teaching fellow" in t:
            return 4
        if "tutor" in t:
            return 5
        if "research" in t:
            return 6
        if "technician" in t:
            return 8
        return 7

    rows.sort(key=lambda r: (dept_order.get(r["dept"], 99), rank_key(r), r["name"].lower()))

    # ---------------- workbook ----------------
    wb = Workbook()
    ws = wb.active
    ws.title = "Staff List"

    headers = ["#", "Name", "姓名", "Department (English)", "系/部门（中文）", "Job Title 职称/职务",
               "职称（中文）", "Staff Category", "Email", "Telephone", "Office",
               "Research Interests 研究兴趣", "Biography 简介", "Qualifications 学历",
               "Profile Link", "Data Notes"]
    ws.append(headers)

    for i, r in enumerate(rows, start=1):
        ws.append([i, r["name"], r["name_cn"], r["dept"], r["dept_cn"], r["title"], r["title_cn"],
                   r["category"], r["email"], r["phone"], r["office"], r["research"], r["bio"],
                   r["quals"], r["profile_url"], r["notes"]])

    n = len(rows) + 1
    widths = {"A": 4.5, "B": 24, "C": 9, "D": 27, "E": 17, "F": 34, "G": 15, "H": 15,
              "I": 31, "J": 22, "K": 26, "L": 46, "M": 52, "N": 26, "O": 9, "P": 24}
    for col, w in widths.items():
        ws.column_dimensions[col].width = w

    header_fill = PatternFill("solid", fgColor="123B5E")
    header_font = Font(color="FFFFFF", bold=True, size=11, name="Calibri")
    thin = Side(style="thin", color="D3DCE4")
    for c in ws[1]:
        c.fill = header_fill
        c.font = header_font
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        c.border = Border(bottom=Side(style="medium", color="123B5E"))
    ws.row_dimensions[1].height = 34

    band = PatternFill("solid", fgColor="F2F7FB")
    link_font = Font(color="0563C1", underline="single", size=10, name="Calibri")
    body_font = Font(size=10, name="Calibri")
    wrap_cols = (4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16)
    for row in ws.iter_rows(min_row=2, max_row=n):
        for c in row:
            c.font = body_font
            c.alignment = Alignment(vertical="top", wrap_text=c.column in wrap_cols)
            c.border = Border(bottom=thin)
            if c.row % 2 == 0:
                c.fill = band
    for row in ws.iter_rows(min_row=2, max_row=n):
        email_cell = row[8]
        if email_cell.value:
            email_cell.hyperlink = "mailto:" + email_cell.value
            email_cell.font = link_font
        link_cell = row[14]
        if link_cell.value:
            link_cell.hyperlink = link_cell.value
            link_cell.value = "Profile ^"
            link_cell.font = Font(color="0563C1", underline="single", size=9, name="Calibri")
        row[1].font = Font(size=10, name="Calibri", bold=True)

    # sensible row heights for wrapped cells so no renderer clips the first line
    import math
    for r_i in range(2, n + 1):
        lines = 1
        for col_idx, width in ((2, 24), (4, 27), (6, 34), (12, 46), (13, 52), (14, 26), (16, 24)):
            val = ws.cell(r_i, col_idx).value
            if not val:
                continue
            chars_per_line = max(8, int(width * 0.92))
            est = math.ceil(len(str(val)) / chars_per_line)
            lines = max(lines, min(est, 7))
        ws.row_dimensions[r_i].height = min(15 * lines + 4, 130)

    ws.freeze_panes = "C2"
    ws.auto_filter.ref = f"A1:P{n}"
    ws.sheet_view.zoomScale = 90
    ws.print_title_rows = "1:1"
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToWidth = 1
    ws.sheet_properties.pageSetUpPr.fitToPage = True

    # ---------------- summary ----------------
    sm = wb.create_sheet("Summary")
    sm["A1"] = "University of Nottingham Ningbo China — Faculty of Science and Engineering"
    sm["A1"].font = Font(size=15, bold=True, color="123B5E")
    sm["A2"] = "员工名录汇总 / Staff directory summary"
    sm["A2"].font = Font(size=11, italic=True, color="44546A")
    sm["A3"] = "Source: nottingham.edu.cn S&E people directory (50 listing pages) + individual staff profiles"
    sm["A3"].font = Font(size=9, color="808080")

    sm["A5"] = "Metric"
    sm["B5"] = "Count"
    total_rows = len(rows)
    metrics = [
        ("Total staff", total_rows),
        ("With email address", sum(1 for r in rows if r["email"])),
        ("Without published email", sum(1 for r in rows if not r["email"])),
        ("With office room", sum(1 for r in rows if r["office"])),
        ("With telephone", sum(1 for r in rows if r["phone"])),
        ("With research interests / bio", sum(1 for r in rows if r["research"] or r["bio"])),
        ("With qualifications listed", sum(1 for r in rows if r["quals"])),
    ]
    for i, (label, val) in enumerate(metrics, start=6):
        sm.cell(row=i, column=1, value=label)
        sm.cell(row=i, column=2, value=val)
        for col in (1, 2):
            sm.cell(row=i, column=col).font = Font(size=10)
            sm.cell(row=i, column=col).border = Border(bottom=thin)

    start = 14  # leave room
    sm.cell(row=start - 1, column=1, value="By department 按系/部门").font = Font(size=11, bold=True, color="123B5E")
    sm.cell(row=start, column=1, value="Department")
    sm.cell(row=start, column=2, value="Staff")
    sm.cell(row=start, column=3, value="With email")
    for c in sm[start]:
        if c.value is not None:
            c.font = Font(bold=True, color="FFFFFF")
            c.fill = header_fill

    dept_counter = Counter(r["dept"] for r in rows)
    dept_email = Counter(r["dept"] for r in rows if r["email"])
    r_i = start + 1
    for dept in sorted(dept_counter, key=lambda d: (dept_order.get(d, 99))):
        sm.cell(row=r_i, column=1, value=dept)
        sm.cell(row=r_i, column=2, value=dept_counter[dept])
        sm.cell(row=r_i, column=3, value=dept_email[dept])
        for col in (1, 2, 3):
            sm.cell(row=r_i, column=col).font = Font(size=10)
            sm.cell(row=r_i, column=col).border = Border(bottom=thin)
        r_i += 1
    sm.cell(row=r_i, column=1, value="Total").font = Font(bold=True, size=10)
    sm.cell(row=r_i, column=2, value=sum(dept_counter.values())).font = Font(bold=True, size=10)
    sm.cell(row=r_i, column=3, value=sum(dept_email.values())).font = Font(bold=True, size=10)

    # category table to the right
    cstart = 5
    sm.cell(row=start - 1, column=cstart, value="By staff category 按人员类别").font = Font(size=11, bold=True, color="123B5E")
    sm.cell(row=start, column=cstart, value="Category")
    sm.cell(row=start, column=cstart + 1, value="Staff")
    for c in (sm.cell(row=start, column=cstart), sm.cell(row=start, column=cstart + 1)):
        c.font = Font(bold=True, color="FFFFFF")
        c.fill = header_fill
    cat_counter = Counter(r["category"] for r in rows)
    cr = start + 1
    for cat in sorted(cat_counter, key=lambda x: -cat_counter[x]):
        sm.cell(row=cr, column=cstart, value=cat).font = Font(size=10)
        sm.cell(row=cr, column=cstart + 1, value=cat_counter[cat]).font = Font(size=10)
        cr += 1

    sm.column_dimensions["A"].width = 56
    sm.column_dimensions["B"].width = 10
    sm.column_dimensions["C"].width = 12
    sm.column_dimensions["E"].width = 30
    sm.column_dimensions["F"].width = 10
    sm.sheet_view.showGridLines = False

    # ---------------- notes ----------------
    nt = wb.create_sheet("Notes")
    nt["A1"] = "Data sources & caveats 数据来源与说明"
    nt["A1"].font = Font(size=14, bold=True, color="123B5E")
    notes = [
        ("Collected", "2026-10-29 (Asia/Shanghai)"),
        ("Listing source", "https://www.nottingham.edu.cn/en/science-engineering/people/search.aspx (50 pages, 247 entries)"),
        ("Profile source", "Each staff member's own profile page: S&E Profile.aspx pages, or the Pure research portal "
                           "(research.nottingham.edu.cn / unnc.globalimpact.cn) when the S&E page redirects there."),
        ("Coverage", "247 staff of the Faculty of Science and Engineering: 9 departments/schools plus the faculty office "
                     "(administrative, technical and research staff)."),
        ("Email", "Taken from the university profile (Pure portal addresses decoded from the page's obfuscated mailto data). "
                  "23 people have no email published on their public profile - these are left blank rather than guessed."),
        ("Office / phone", "Only shown on CMS-style profiles; most Pure-only profiles do not publish a room or extension, "
                           "so those cells are blank."),
        ("Research / bio / qualifications", "Free-text sections are kept verbatim (cleaned of HTML), trimmed to 300 (research), 450 (biography) "
                                            "and 220 (qualifications) characters to keep rows readable; the Profile link opens the full text. "
                                            "Coverage is partial because many public profiles leave these sections empty."),
        ("Profile link", "The cell shows 'Profile ^' with the full URL behind the hyperlink (S&E profile page or Pure portal page)."),
        ("Staff category", "Derived from job title: Academic staff (professor/lecturer/tutor), Research staff (research fellow/"
                           "assistant/postdoc), Professional services & technical (officers, technicians, administrators)."),
        ("Corrections", "Two malformed emails in the source were corrected: 'nottingham,edu.cn' (Helen Li) and a space before "
                        "the @ (Gigi Lu). No other values were altered."),
        ("Ranking note", "Rows are grouped by department, then by seniority (head/chair -> professor -> associate -> assistant "
                         "-> teaching/tutor -> research -> professional services), then alphabetically."),
        ("Re-use", "'Staff List' is filtered and frozen; column P records why a cell is blank."),
    ]
    r = 3
    for k, v in notes:
        nt.cell(row=r, column=1, value=k).font = Font(bold=True, size=10)
        nt.cell(row=r, column=2, value=v).font = Font(size=10)
        nt.cell(row=r, column=2).alignment = Alignment(wrap_text=True, vertical="top")
        nt.row_dimensions[r].height = 30 if len(v) < 130 else 46
        r += 1
    nt.column_dimensions["A"].width = 30
    nt.column_dimensions["B"].width = 110
    nt.sheet_view.showGridLines = False

    wb.save(OUT)
    print("saved", OUT, "rows", len(rows))


if __name__ == "__main__":
    main()







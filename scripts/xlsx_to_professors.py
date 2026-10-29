"""Export the three staff workbooks to one JSON file for the Node importer.

Each workbook is a scrape of one faculty's people pages, so the job here is to
pick the columns we keep and to derive the surname the runtime needs in order
to build a correct salutation.
"""

import json
import re
from pathlib import Path

import pandas as pd

ROOT = Path(r"E:\UNNC_Y1_FAM\RoboEmail")
TARGET = ROOT / "apps/server/data/professors.json"

WORKBOOKS = [
    (
        "UNNC_理工学院_员工信息.xlsx",
        "Faculty of Science and Engineering",
        "https://www.nottingham.edu.cn/en/science-engineering/people/",
    ),
    (
        "UNNC_人文社科学院_员工信息.xlsx",
        "Faculty of Humanities and Social Sciences",
        "https://www.nottingham.edu.cn/en/humanities-social-sciences/people/",
    ),
    (
        "UNNC_商学院_员工信息.xlsx",
        "Nottingham University Business School China",
        "https://www.nottingham.edu.cn/en/business/people/",
    ),
]

PARENTHETICAL = re.compile(r"\s*\([^)]*\)")


def clean(value) -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ""
    return str(value).strip()


def surname_of(name: str) -> str:
    bare = PARENTHETICAL.sub(" ", name).split()
    return bare[-1] if bare else ""


records = []
for filename, school, source_url in WORKBOOKS:
    path = ROOT / filename
    frame = pd.read_excel(path, sheet_name="Staff List")

    for _, row in frame.iterrows():
        name = clean(row["Name"])
        if not name:
            continue

        records.append(
            {
                "nameEn": name,
                "surname": surname_of(name),
                "titleCn": clean(row["职称（中文）"]),
                "titleEn": clean(row["Job Title 职称/职务"]),
                "school": school,
                "department": clean(row["Department (English)"]),
                "email": clean(row["Email"]).lower() or None,
                "profileUrl": clean(row["Profile Link"]) or None,
                "sourceUrl": source_url,
            }
        )

TARGET.parent.mkdir(parents=True, exist_ok=True)
TARGET.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")

emails = [record["email"] for record in records if record["email"]]
duplicate_emails = len(emails) - len(set(emails))

print(f"exported {len(records)} rows -> {TARGET}")
print(f"without surname:    {sum(1 for record in records if not record['surname'])}")
print(f"without email:      {sum(1 for record in records if not record['email'])}")
print(f"without title:      {sum(1 for record in records if not record['titleCn'])}")
print(f"duplicate emails:   {duplicate_emails}")

by_school: dict[str, int] = {}
for record in records:
    by_school[record["school"]] = by_school.get(record["school"], 0) + 1
for school, count in by_school.items():
    print(f"  {count:>4}  {school}")

"""Export the offline teacher-profiles bundle for the web app.

Input  : 三院教师主页/ (data.json + photos/, produced by the profile scraper)
Output : apps/server/assets/profiles.json
         apps/server/assets/photos/<basename>.jpg  (resized for delivery)

The modal shows a portrait roughly 140 px wide, so the 600x800 originals are far
bigger than needed. Resizing to a 420 px long edge keeps them crisp on retina
screens while cutting the bundle from ~30 MB to a few MB.

Run from anywhere:

    python scripts/import_profiles.py
"""

import json
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is missing: pip install pillow")

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "三院教师主页"
TARGET_DIR = ROOT / "apps" / "server" / "assets"
PHOTO_DIR = TARGET_DIR / "photos"

MAX_EDGE = 420
QUALITY = 82

# The modal never needs the full scrape: keep only what a reader needs to write
# the email, and leave the long research dump as is (the UI clamps it).
FIELDS = ("id", "faculty", "name", "title", "titleCn", "dept", "deptCn", "email", "research")


def main() -> None:
    data = json.loads((SOURCE / "data.json").read_text(encoding="utf-8"))
    TARGET_DIR.mkdir(parents=True, exist_ok=True)
    PHOTO_DIR.mkdir(parents=True, exist_ok=True)

    rows = []
    photos_done = 0
    for person in data:
        row = {key: person.get(key) or "" for key in FIELDS}

        photo = (person.get("photo") or "").strip()
        if photo:
            source = SOURCE / photo
            if source.exists():
                target = PHOTO_DIR / Path(photo).name
                if not target.exists() or target.stat().st_mtime < source.stat().st_mtime:
                    with Image.open(source) as image:
                        image = image.convert("RGB")
                        image.thumbnail((MAX_EDGE, MAX_EDGE), Image.LANCZOS)
                        image.save(target, "JPEG", quality=QUALITY, optimize=True, progressive=True)
                row["photo"] = target.name
                photos_done += 1
            else:
                row["photo"] = ""
        else:
            row["photo"] = ""

        row["profile"] = person.get("profile") or ""
        row["pure"] = person.get("pure") or ""
        row["papers"] = [
            {
                "title": paper.get("title") or "",
                "doi": paper.get("doi") or "",
                "pure": paper.get("pure") or "",
                "year": paper.get("year") or "",
                "venue": paper.get("venue") or "",
                "type": paper.get("type") or "",
            }
            for paper in (person.get("papers") or [])[:6]
        ]
        rows.append(row)

    out = TARGET_DIR / "profiles.json"
    out.write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    papers = sum(len(row["papers"]) for row in rows)
    print(f"profiles  {len(rows)}")
    print(f"photos    {photos_done} (long edge {MAX_EDGE}px, q{QUALITY})")
    print(f"papers    {papers}")
    print(f"written   {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

// Fill missing business-school departments from the Pure organisation mapping.
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, 'data_business');
const profiles = JSON.parse(fs.readFileSync(path.join(DATA, 'profiles.json'), 'utf8'));
const { map, names } = JSON.parse(fs.readFileSync(path.join(DATA, 'org_map.json'), 'utf8'));

function slugify(s) {
  return s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
}
function stripTitles(s) {
  return s.replace(/^(prof\.?|professor|dr\.?|mr\.?|mrs\.?|ms\.?|miss)\s+/i, '').trim();
}
function variants(name) {
  const n = stripTitles(name).replace(/\s+/g, ' ').trim();
  const parts = n.split(' ');
  const out = new Set([slugify(n), slugify(parts.slice(0, 2).join(' '))]);
  if (parts.length >= 2) {
    out.add(slugify([parts[parts.length - 1], ...parts.slice(0, -1)].join(' ')));
  }
  // nickname in parentheses: "Yong (Sean) Shi" -> "yong-shi"
  out.add(slugify(n.replace(/\([^)]*\)/g, '')));
  return [...out].filter(Boolean);
}

let filled = 0;
for (const p of profiles) {
  if (p.department) continue;
  const cands = variants(p.name);
  let dept = '';
  for (const c of cands) {
    if (map[c]) { dept = map[c]; break; }
    if (names[c]) { dept = names[c]; break; }
  }
  // also try the person's own Pure URL slug
  if (!dept && p.pure_url) {
    const m = p.pure_url.match(/persons\/([a-z0-9\-%.]+)/);
    if (m && map[m[1]]) dept = map[m[1]];
  }
  if (dept) { p.department = dept; p.dept_source = 'Pure organisation page'; filled++; }
}
fs.writeFileSync(path.join(DATA, 'profiles.json'), JSON.stringify(profiles, null, 1), 'utf8');

const c = {};
for (const p of profiles) c[p.department || '(none)'] = (c[p.department || '(none)'] || 0) + 1;
console.log('filled', filled);
console.log(c);

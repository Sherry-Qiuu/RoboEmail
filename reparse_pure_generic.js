// Re-parse Pure profile HTML: read the person-profileinformation block sections
// (h3.subheader headings) which the first pass can miss.
// usage: node reparse_pure_generic.js <dataDir>
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, process.argv[2] || 'data_fhss');
const PURE = path.join(DATA, 'pure');

function decode(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&rsquo;|&#8217;/g, '\u2019').replace(/&lsquo;/g, '\u2018')
    .replace(/&mdash;/g, '\u2014').replace(/&ndash;/g, '\u2013').replace(/&hellip;/g, '\u2026');
}
function clean(h) {
  if (!h) return '';
  return decode(String(h)
    .replace(/<li[^>]*>/gi, '; ')
    .replace(/<br\s*\/?>/gi, '; ')
    .replace(/<\/p>/gi, '; ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s*;\s*(;)+/g, ';')
    .replace(/\s+/g, ' ')
    .replace(/^\s*;\s*|\s*;\s*$/g, '')
    .trim();
}

function parseBlocks(html) {
  const heads = [...html.matchAll(/<h3 class="subheader">([\s\S]*?)<\/h3>/g)];
  const out = {};
  for (let i = 0; i < heads.length; i++) {
    const key = clean(heads[i][1]).toLowerCase();
    const from = heads[i].index + heads[i][0].length;
    let to = i + 1 < heads.length ? heads[i + 1].index : Math.min(html.length, from + 6000);
    const close = html.indexOf('</section>', from);
    if (close > 0 && close < to) to = close;
    const val = clean(html.slice(from, to));
    if (key && val && !out[key]) out[key] = val;
  }
  return out;
}

const profiles = JSON.parse(fs.readFileSync(path.join(DATA, 'profiles.json'), 'utf8'));
let n = 0;
for (const p of profiles) {
  if (!p.pure_url) continue;
  const file = path.join(PURE, p.id + '.html');
  if (!fs.existsSync(file)) continue;
  const b = parseBlocks(fs.readFileSync(file, 'utf8'));
  p.bio_pure = b['personal profile'] || b['biography'] || b['profile'] || p.bio_pure || '';
  p.research_pure = b['research interests'] || p.research_pure || '';
  p.prof_info_pure = b['professional information'] || p.prof_info_pure || '';
  p.qualifications_pure = b['education/academic qualification'] || b['qualifications'] || b['education'] || p.qualifications_pure || '';
  p.teaching_pure = b['teaching'] || '';
  if (p.bio_pure || p.research_pure) n++;
}
fs.writeFileSync(path.join(DATA, 'profiles.json'), JSON.stringify(profiles, null, 1), 'utf8');
console.log(DATA, '| enriched', n,
  '| bio', profiles.filter((p) => p.bio_pure).length,
  '| research', profiles.filter((p) => p.research_pure).length,
  '| quals', profiles.filter((p) => p.qualifications_pure).length);

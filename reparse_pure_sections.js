// Re-parse the saved Pure portal HTML files for biography / research / qualifications /
// professional information blocks that the first pass missed (headings are h3.subheader).
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, 'data');
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
    .replace(/<\/div>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s*;\s*(;)+/g, ';')
    .replace(/\s+/g, ' ')
    .replace(/^\s*;\s*|\s*;\s*$/g, '')
    .trim();
}

// Split the profile-information block on h3.subheader headings and map heading -> text.
function parseBlocks(html) {
  const out = {};
  const start = html.indexOf('person-profileinformation');
  if (start < 0) return out;
  const end = html.indexOf('</section>', start);
  const chunk = html.slice(start, end > start ? end : undefined);
  const re = /<h3 class="subheader">([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3 class="subheader">|<h2\b|<\/section>|$)/g;
  let m;
  while ((m = re.exec(chunk))) {
    const key = clean(m[1]).toLowerCase();
    let val = clean(m[2]);
    val = val.replace(/^(research interests|personal profile|professional information|biography)\s*[;:]\s*/i, '');
    if (key && val) out[key] = val;
  }
  return out;
}

const profiles = JSON.parse(fs.readFileSync(path.join(DATA, 'profiles.json'), 'utf8'));
let updated = 0;
for (const p of profiles) {
  if (!p.pure_url) continue;
  const file = path.join(PURE, p.id + '.html');
  if (!fs.existsSync(file)) continue;
  const html = fs.readFileSync(file, 'utf8');
  const blocks = parseBlocks(html);
  const bio = blocks['personal profile'] || blocks['biography'] || blocks['profile'] || '';
  const research = blocks['research interests'] || blocks['research'] || '';
  const prof = blocks['professional information'] || '';
  const quals = blocks['qualifications'] || blocks['education'] || blocks['academic qualifications'] || '';
  p.bio_pure = bio;
  p.research_pure = research;
  p.prof_info_pure = prof;
  p.qualifications_pure = quals || p.qualifications_pure || '';
  if (bio || research) updated++;
}
fs.writeFileSync(path.join(DATA, 'profiles.json'), JSON.stringify(profiles, null, 1), 'utf8');
console.log('pure profiles with bio/research:', updated);
const withBio = profiles.filter((p) => p.bio_pure).length;
const withRes = profiles.filter((p) => p.research_pure).length;
console.log('bio:', withBio, 'research:', withRes);
console.log('sample:', JSON.stringify(profiles.find((p) => p.bio_pure)?.bio_pure?.slice(0, 160)));

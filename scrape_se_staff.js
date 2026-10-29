// Scrape UNNC Faculty of Science and Engineering staff directory.
// Stage 1: listing pages -> data/listing.json
// Stage 2: profile pages -> data/profiles.json
const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE = 'https://www.nottingham.edu.cn';
const OUT = path.join(__dirname, 'data');
fs.mkdirSync(OUT, { recursive: true });

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

function get(url, tries = 4) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      https.get(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-GB,en;q=0.9' }, timeout: 60000 }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          const next = res.headers.location.startsWith('http') ? res.headers.location : BASE + res.headers.location;
          return attempt.length >= 0 ? (n > 0 ? attempt(n - 1, next) : reject(new Error('redirect loop'))) : null;
        }
        if (res.statusCode !== 200) {
          res.resume();
          return n > 0 ? setTimeout(() => attempt(n - 1), 800) : reject(new Error('HTTP ' + res.statusCode + ' ' + url));
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      }).on('error', (e) => n > 0 ? setTimeout(() => attempt(n - 1), 1000) : reject(e));
      // handle redirect via second arg
    };
    // simple wrapper allowing explicit url override
    const attemptUrl = (n, u) => {
      https.get(u, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-GB,en;q=0.9' }, timeout: 60000 }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          const next = res.headers.location.startsWith('http') ? res.headers.location : BASE + res.headers.location;
          return n > 0 ? attemptUrl(n - 1, next) : reject(new Error('redirect loop'));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return n > 0 ? setTimeout(() => attemptUrl(n - 1, u), 800) : reject(new Error('HTTP ' + res.statusCode + ' ' + u));
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      }).on('error', (e) => n > 0 ? setTimeout(() => attemptUrl(n - 1, u), 1000) : reject(e));
    };
    attemptUrl(tries, url);
  });
}

function decode(s) {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&rsquo;|&#8217;/g, '\u2019').replace(/&lsquo;/g, '\u2018')
    .replace(/&mdash;/g, '\u2014').replace(/&ndash;/g, '\u2013');
}

function clean(html) {
  if (html == null) return '';
  return decode(String(html)
    .replace(/<br\s*\/?>/gi, '; ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

const ITEM_RE = /<li class="article-listing__item">([\s\S]*?)<\/li>/g;
const KEYLINE_RE = /article-listing__content--keyline">([\s\S]*?)<\/p>/;
const TITLE_RE = /article-listing__content--title">\s*<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/;
const JOB_RE = /class="jobTitle">([\s\S]*?)<\/p>/;

async function listing() {
  const rows = [];
  const pages = 50;
  const queue = Array.from({ length: pages }, (_, i) => i + 1);
  const workers = Array.from({ length: 5 }, async () => {
    while (queue.length) {
      const p = queue.shift();
      const url = `${BASE}/en/science-engineering/people/search.aspx?STFPageIndex=${p}`;
      let html;
      try {
        html = await get(url);
      } catch (e) {
        console.error('FAIL page', p, e.message);
        continue;
      }
      let m, n = 0;
      while ((m = ITEM_RE.exec(html))) {
        const block = m[1];
        const k = block.match(KEYLINE_RE);
        const t = block.match(TITLE_RE);
        const j = block.match(JOB_RE);
        if (!t) continue;
        const href = t[1].startsWith('http') ? t[1] : BASE + t[1];
        rows.push({
          page: p,
          name: clean(t[2]),
          dept_raw: k ? clean(k[1]) : '',
          title: j ? clean(j[1]) : '',
          profile_url: href,
        });
        n++;
      }
      console.log(`page ${p}: ${n} items (total ${rows.length})`);
    }
  });
  await Promise.all(workers);
  // dedupe by profile id
  const seen = new Set();
  const uniq = [];
  for (const r of rows) {
    const id = (r.profile_url.match(/id=([0-9a-f-]+)/i) || [])[1] || r.profile_url;
    if (seen.has(id)) continue;
    seen.add(id);
    r.id = id;
    uniq.push(r);
  }
  fs.writeFileSync(path.join(OUT, 'listing.json'), JSON.stringify(uniq, null, 1), 'utf8');
  console.log('LISTING TOTAL', rows.length, 'unique', uniq.length);
}

// ---------- profile parsing ----------
function section(html, anchor) {
  // content between this anchor+headline and the next anchor
  const startRe = new RegExp(`name="anchor${anchor}"[\\s\\S]{0,400}?<div class="headline">[\\s\\S]*?</div>([\\s\\S]*?)(?=<a aria-hidden="true" data-anchor=|</article>)`, 'i');
  const m = html.match(startRe);
  return m ? clean(m[1]) : '';
}

function parseProfile(html, person) {
  const out = { ...person };
  const h2 = html.match(/<h2>\s*([\s\S]*?)<\/h2>/);
  out.name_profile = h2 ? clean(h2[1]) : '';
  const dept = html.match(/<h5>([\s\S]*?)<\/h5>/);
  out.dept_title_raw = dept ? clean(dept[1]) : '';
  const job = html.match(/<\/h2>\s*<p>([\s\S]*?)<\/p>\s*<h5>/);
  out.title_profile = job ? clean(job[1]) : '';

  // contact rows
  const rows = [...html.matchAll(/key-information__details__row__cell">([\s\S]*?)<\/p>\s*<p class="key-information__details__row__cell">([\s\S]*?)<\/p>/g)];
  const contact = {};
  for (const [, k, v] of rows) contact[clean(k)] = clean(v);
  out.office = contact['Office'] || '';
  out.campus = contact['Campus'] || '';
  out.address = contact['Address'] || '';
  out.telephone = contact['Telephone'] || '';
  const mail = html.match(/href="mailto:([^"?]+)"/i);
  out.email = mail ? mail[1].trim() : (contact['Email'] || '');
  if (!out.email) {
    const e2 = html.match(/[A-Za-z0-9._%+-]+@nottingham\.edu\.cn/);
    if (e2) out.email = e2[0];
  }
  const personnel = html.match(/nottingham\.ac\.uk\/([^"'\s<>]+)/i);

  out.qualifications = section(html, 'Qualifications');
  out.research = section(html, 'Researchinterests') || section(html, 'Research');
  out.teaching = section(html, 'Teaching');
  out.bio = section(html, 'Biography') || section(html, 'biography');
  const pub = html.match(/name="anchorPublications"/i);
  out.has_publications = !!pub;
  const pi = html.indexOf('Personal links');
  out.html_len = html.length;
  return out;
}

async function profiles() {
  const people = JSON.parse(fs.readFileSync(path.join(OUT, 'listing.json'), 'utf8'));
  const results = new Array(people.length);
  let idx = 0, done = 0;
  const workers = Array.from({ length: 6 }, async () => {
    while (idx < people.length) {
      const i = idx++;
      const p = people[i];
      try {
        const html = await get(p.profile_url);
        results[i] = parseProfile(html, p);
      } catch (e) {
        console.error('FAIL profile', p.name, e.message);
        results[i] = { ...p, error: e.message };
      }
      done++;
      if (done % 20 === 0) console.log('profiles', done, '/', people.length);
    }
  });
  await Promise.all(workers);
  fs.writeFileSync(path.join(OUT, 'profiles.json'), JSON.stringify(results.filter(Boolean), null, 1), 'utf8');
  console.log('PROFILES DONE', results.filter(Boolean).length);
}

(async () => {
  const stage = process.argv[2] || 'all';
  if (stage === 'listing' || stage === 'all') await listing();
  if (stage === 'profiles' || stage === 'all') await profiles();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });

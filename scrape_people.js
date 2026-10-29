// Generic UNNC staff-directory scraper (S&E, Business School, ...).
// usage: node scrape_people.js <slug> <listingPath> <pages> [dataDir]
const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE = 'https://www.nottingham.edu.cn';
const slug = process.argv[2] || 'business';
const listingPath = process.argv[3] || '/en/business/people/search.aspx';
const pages = parseInt(process.argv[4] || '35', 10);
const DATA = path.join(__dirname, process.argv[5] || 'data_business');
fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(path.join(DATA, 'pure'), { recursive: true });

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

function get(url, hops = 0, tries = 3) {
  return new Promise((resolve, reject) => {
    if (hops > 6) return reject(new Error('too many redirects'));
    const req = https.get(url, { headers: { 'User-Agent': UA, 'Accept': 'text/html', 'Accept-Language': 'en-GB,en;q=0.9' }, timeout: 60000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(get(new URL(res.headers.location, url).href, hops + 1, tries));
      }
      if (res.statusCode !== 200) {
        res.resume();
        if (tries > 0) return setTimeout(() => resolve(get(url, hops, tries - 1)), 700);
        return reject(new Error('HTTP ' + res.statusCode + ' ' + url));
      }
      const c = [];
      res.on('data', (d) => c.push(d));
      res.on('end', () => resolve({ html: Buffer.concat(c).toString('utf8'), finalUrl: url, redirected: hops > 0 }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (e) => tries > 0 ? setTimeout(() => resolve(get(url, hops, tries - 1)), 900) : reject(e));
  });
}

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

const ITEM_RE = /<li class="article-listing__item">([\s\S]*?)<\/li>/g;
const KEYLINE_RE = /article-listing__content--keyline">([\s\S]*?)<\/p>/;
const LINK_RE = /href="([^"]*Profile\.aspx[^"]*)"[^>]*title="View the staff profile of ([^"]+)"/i;
const JOB_RE = /class="jobTitle">([\s\S]*?)<\/p>/;

async function listing() {
  const rows = [];
  const queue = Array.from({ length: pages }, (_, i) => i + 1);
  await Promise.all(Array.from({ length: 5 }, async () => {
    while (queue.length) {
      const p = queue.shift();
      let html;
      try { html = (await get(`${BASE}${listingPath}?STFPageIndex=${p}`)).html; }
      catch (e) { console.error('FAIL page', p, e.message); continue; }
      let m, n = 0;
      while ((m = ITEM_RE.exec(html))) {
        const block = m[1];
        const k = block.match(KEYLINE_RE);
        const l = block.match(LINK_RE);
        const j = block.match(JOB_RE);
        if (!l) continue;
        rows.push({
          page: p,
          name: clean(l[2]),
          dept_raw: k ? clean(k[1]) : '',
          title: j ? clean(j[1]) : '',
          profile_url: new URL(decode(l[1]), BASE).href,
        });
        n++;
      }
      console.log(`page ${p}: ${n} (total ${rows.length})`);
    }
  }));
  const seen = new Set();
  const uniq = [];
  for (const r of rows) {
    const id = (r.profile_url.match(/id=([0-9a-f-]+)/i) || [])[1] || r.profile_url;
    if (seen.has(id)) continue;
    seen.add(id);
    r.id = id;
    uniq.push(r);
  }
  fs.writeFileSync(path.join(DATA, 'listing.json'), JSON.stringify(uniq, null, 1), 'utf8');
  console.log('LISTING', rows.length, 'unique', uniq.length);
}

function section(html, anchor) {
  const startRe = new RegExp(`name="anchor${anchor}"[\\s\\S]{0,400}?<div class="headline">[\\s\\S]*?</div>([\\s\\S]*?)(?=<a aria-hidden="true" data-anchor=|</article>)`, 'i');
  const m = html.match(startRe);
  return m ? clean(m[1]) : '';
}

function parseCms(html) {
  const out = {};
  const h2 = html.match(/<h2>\s*([\s\S]*?)<\/h2>/);
  out.name_cms = h2 ? clean(h2[1]) : '';
  const dept = html.match(/<h5>([\s\S]*?)<\/h5>/);
  out.dept_title_raw = dept ? clean(dept[1]) : '';
  const job = html.match(/<\/h2>\s*<p>([\s\S]*?)<\/p>\s*<h5>/);
  out.title_cms = job ? clean(job[1]) : '';
  const rows = [...html.matchAll(/key-information__details__row__cell">([\s\S]*?)<\/p>\s*<p class="key-information__details__row__cell">([\s\S]*?)<\/p>/g)];
  const contact = {};
  for (const [, k, v] of rows) contact[clean(k)] = clean(v);
  out.office = contact['Office'] || '';
  out.campus = contact['Campus'] || '';
  out.telephone = contact['Telephone'] || '';
  const mail = html.match(/href="mailto:([^"?]+)"/i);
  out.email = mail ? mail[1].trim() : '';
  if (!out.email) {
    const e2 = html.match(/[A-Za-z0-9._%+-]+@nottingham\.edu\.cn/);
    if (e2) out.email = e2[0];
  }
  out.qualifications = section(html, 'Qualifications');
  out.research = section(html, 'Researchinterests') || section(html, 'Research');
  out.teaching = section(html, 'Teaching');
  out.bio = section(html, 'Biography');
  return out;
}

function parsePure(html) {
  const out = {};
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  out.name_pure = h1 ? clean(h1[1]) : '';
  const title = html.match(/rendering_persontitlerendererportal[^>]*>\s*<p>([\s\S]*?)<\/p>/);
  out.title_pure = title ? clean(title[1]) : '';
  const orgs = [...html.matchAll(/<li><a rel="Organisation"[^>]*><span>([\s\S]*?)<\/span><\/a><\/li>/g)].map((m) => clean(m[1]));
  out.orgs = orgs;
  out.department = orgs[0] || '';
  const md = html.match(/data-md5="([^"]+)"/);
  if (md) {
    try {
      const e = Buffer.from(md[1], 'base64').toString('utf8').match(/mailto:([^\s?]+)/);
      if (e) out.email = e[1];
    } catch (e) { /* ignore */ }
  }
  if (!out.email) {
    const e2 = html.match(/[A-Za-z0-9._%+-]+@nottingham\.edu\.cn/);
    if (e2) out.email = e2[0];
  }
  const cite = html.match(/<div class="value">(\d+)<\/div>\s*<div class="source">Scopus Citations<\/div>/);
  const hidx = html.match(/<div class="value">(\d+)<\/div>\s*<div class="source">h-index<\/div>/);
  out.scopus_citations = cite ? +cite[1] : '';
  out.h_index = hidx ? +hidx[1] : '';
  // profile-information blocks (h3.subheader inside the person-profileinformation section)
  const start = html.indexOf('person-profileinformation');
  if (start >= 0) {
    const end = html.indexOf('</section>', start);
    const chunk = html.slice(start, end > start ? end : undefined);
    const re = /<h3 class="subheader">([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3 class="subheader">|<h2\b|<\/section>|$)/g;
    const blocks = {};
    let m;
    while ((m = re.exec(chunk))) {
      const key = clean(m[1]).toLowerCase();
      let val = clean(m[2]);
      val = val.replace(/^(research interests|personal profile|professional information|biography)\s*[;:]\s*/i, '');
      if (key && val) blocks[key] = val;
    }
    out.bio_pure = blocks['personal profile'] || blocks['biography'] || blocks['profile'] || '';
    out.research_pure = blocks['research interests'] || blocks['research'] || '';
    out.prof_info_pure = blocks['professional information'] || '';
    out.qualifications_pure = blocks['qualifications'] || blocks['education'] || blocks['academic qualifications'] || '';
  }
  return out;
}

async function profiles() {
  const people = JSON.parse(fs.readFileSync(path.join(DATA, 'listing.json'), 'utf8'));
  const results = new Array(people.length);
  let idx = 0, done = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (idx < people.length) {
      const i = idx++;
      const p = people[i];
      try {
        const r = await get(p.profile_url);
        if (r.html.includes('person-profileinformation') || r.html.includes('rendering_person')) {
          Object.assign(p, parsePure(r.html), { pure_url: r.finalUrl, source: 'Pure portal' });
          fs.writeFileSync(path.join(DATA, 'pure', p.id + '.html'), r.html, 'utf8');
        } else {
          Object.assign(p, parseCms(r.html), { source: 'CMS profile' });
        }
      } catch (e) {
        p.error = e.message;
        console.error('FAIL profile', p.name, e.message);
      }
      results[i] = p;
      done++;
      if (done % 20 === 0) console.log('profiles', done, '/', people.length);
    }
  }));
  fs.writeFileSync(path.join(DATA, 'profiles.json'), JSON.stringify(results.filter(Boolean), null, 1), 'utf8');
  const noName = people.filter((p) => !p.name_cms && !p.name_pure).length;
  console.log('PROFILES DONE', people.length, '| no parsed name:', noName,
    '| with email:', people.filter((p) => p.email).length);
}

(async () => {
  const stage = process.argv[6] || 'all';
  if (stage === 'listing' || stage === 'all') await listing();
  if (stage === 'profiles' || stage === 'all') await profiles();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });


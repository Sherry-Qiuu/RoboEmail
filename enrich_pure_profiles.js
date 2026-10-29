// Refetch profiles that redirected to the Pure portal (unnc.globalimpact.cn)
// and enrich the S&E dataset with contact details parsed from Pure markup.
const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE = 'https://www.nottingham.edu.cn';
const OUT = path.join(__dirname, 'data');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

function get(url, hops = 0) {
  return new Promise((resolve, reject) => {
    if (hops > 6) return reject(new Error('too many redirects'));
    const req = https.get(url, {
      headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'en-GB,en;q=0.9' },
      timeout: 60000,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        const next = new URL(res.headers.location, url).href;
        return resolve(get(next, hops + 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode + ' ' + url)); }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ html: Buffer.concat(chunks).toString('utf8'), finalUrl: url }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

function decode(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&rsquo;|&#8217;/g, '\u2019').replace(/&mdash;/g, '\u2014').replace(/&ndash;/g, '\u2013');
}
function clean(h) {
  if (!h) return '';
  return decode(String(h).replace(/<br\s*\/?>/gi, '; ').replace(/<\/p>/gi, ' ').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ').trim();
}
function sectionFrom(html, heading) {
  // Pure profile: <h2>Heading</h2> ... up to next <h2>
  const re = new RegExp(`<h2[^>]*>\\s*${heading}\\s*</h2>([\\s\\S]*?)(?=<h2|<section class="metrics"|</div>\\s*</div>\\s*</section>)`, 'i');
  const m = html.match(re);
  return m ? clean(m[1]) : '';
}

function parsePure(html) {
  const out = {};
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  out.name_pure = h1 ? clean(h1[1]) : '';
  const title = html.match(/rendering_persontitlerendererportal[^>]*>\s*<p>([\s\S]*?)<\/p>/);
  out.title_pure = title ? clean(title[1]) : '';
  // organisations
  const orgs = [...html.matchAll(/<li><a rel="Organisation"[^>]*><span>([\s\S]*?)<\/span><\/a><\/li>/g)].map((m) => clean(m[1]));
  out.orgs = orgs;
  out.department = orgs[0] || '';
  // email (base64 encoded in data-md5)
  const md = html.match(/data-md5="([^"]+)"/);
  if (md) {
    try {
      const decoded = Buffer.from(md[1], 'base64').toString('utf8');
      const e = decoded.match(/mailto:([^\s?]+)/);
      if (e) out.email = e[1];
    } catch (e) { /* ignore */ }
  }
  if (!out.email) {
    const e2 = html.match(/[A-Za-z0-9._%+-]+@nottingham\.edu\.cn/);
    if (e2) out.email = e2[0];
  }
  // metrics
  const cite = html.match(/<div class="value">(\d+)<\/div>\s*<div class="source">Scopus Citations<\/div>/);
  const hidx = html.match(/<div class="value">(\d+)<\/div>\s*<div class="source">h-index<\/div>/);
  out.scopus_citations = cite ? +cite[1] : '';
  out.h_index = hidx ? +hidx[1] : '';
  const pubCount = html.match(/([\d,]+)\s*(?:research outputs|publications)/i);
  out.publications_count = pubCount ? pubCount[1] : '';
  // biography / research
  out.bio_pure = sectionFrom(html, 'Biography') || sectionFrom(html, 'Profile');
  out.research_pure = sectionFrom(html, 'Research interests') || sectionFrom(html, 'Research');
  out.qualifications_pure = sectionFrom(html, 'Qualifications') || sectionFrom(html, 'Education');
  out.html_len_pure = html.length;
  return out;
}

(async () => {
  const profiles = JSON.parse(fs.readFileSync(path.join(OUT, 'profiles.json'), 'utf8'));
  fs.mkdirSync(path.join(OUT, 'pure'), { recursive: true });
  const bad = profiles.filter((p) => !p.name_profile);
  console.log('redirected profiles:', bad.length);
  const queue = bad.slice();
  const workers = Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const p = queue.shift();
      try {
        const { html, finalUrl } = await get(p.profile_url);
        const pure = parsePure(html);
        Object.assign(p, pure, { pure_url: finalUrl, source: 'Pure portal' });
        fs.writeFileSync(path.join(OUT, 'pure', p.id + '.html'), html, 'utf8');
        console.log('OK', p.name, '|', pure.email || 'NO-EMAIL', '|', pure.title_pure.slice(0, 60));
      } catch (e) {
        p.pure_error = e.message;
        console.log('FAIL', p.name, e.message);
      }
    }
  });
  await Promise.all(workers);
  fs.writeFileSync(path.join(OUT, 'profiles.json'), JSON.stringify(profiles, null, 1), 'utf8');
  console.log('done; enriched', bad.filter((p) => p.name_pure).length, '/', bad.length);
})();

// Map NUBS China staff to their academic department using Pure organisation pages.
const https = require('https');
const fs = require('fs');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
function get(url, hops = 0, tries = 3) {
  return new Promise((resolve, reject) => {
    if (hops > 6) return reject(new Error('redirects'));
    https.get(url, { headers: { 'User-Agent': UA, 'Accept': 'text/html' }, timeout: 60000 }, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) { r.resume(); return resolve(get(new URL(r.headers.location, url).href, hops + 1, tries)); }
      if (r.statusCode !== 200) { r.resume(); if (tries > 0) return setTimeout(() => resolve(get(url, hops, tries - 1)), 800); return reject(new Error('HTTP ' + r.statusCode)); }
      const c = []; r.on('data', (d) => c.push(d)); r.on('end', () => resolve(Buffer.concat(c).toString('utf8')));
    }).on('error', (e) => tries > 0 ? setTimeout(() => resolve(get(url, hops, tries - 1)), 900) : reject(e));
  });
}

const ORGS = {
  'Department of Entrepreneurship, Marketing and Management Systems': 'department-of-entrepreneurship-marketing-and-management-systems',
  'Department of Finance, Accounting and Economics': 'department-of-finance-accounting-and-economics',
  'Department of International Business and Management': 'department-of-international-business-and-management',
};

function clean(s) {
  return s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

(async () => {
  const map = {};      // slug -> dept
  const names = {};    // normalized name -> dept
  for (const [dept, slug] of Object.entries(ORGS)) {
    let html;
    try { html = await get(`https://unnc.globalimpact.cn/en/organisations/${slug}/`); }
    catch (e) { console.log('FAIL', dept, e.message); continue; }
    // person cards: <a href=".../en/persons/<slug>/" ...> ... <h3 ...>Name</h3>
    const re = /href="[^"]*\/en\/persons\/([a-z0-9\-%.]+)\/"[^>]*>([\s\S]{0,600}?)<\/a>/g;
    let m, n = 0;
    while ((m = re.exec(html))) {
      const slugName = m[1];
      const nm = clean(m[2]);
      map[slugName] = dept;
      if (nm) names[nm.toLowerCase()] = dept;
      n++;
    }
    // fallback: any person slug on the page
    for (const mm of html.matchAll(/\/en\/persons\/([a-z0-9\-%.]+)\//g)) {
      if (!map[mm[1]]) map[mm[1]] = dept;
    }
    console.log(dept, '| cards', n, '| slugs', Object.keys(map).length);
  }
  fs.writeFileSync('data_business/org_map.json', JSON.stringify({ map, names }, null, 1));
  console.log('slugs mapped:', Object.keys(map).length, '| names:', Object.keys(names).length);
  console.log(Object.entries(names).slice(0, 10).map(([k, v]) => k + ' => ' + v.slice(11)).join('\n'));
})();

#!/usr/bin/env python3
"""Build old->new redirect map for mahamprint migration.

Old product URLs embed the Persian title:  /product/147/<persian-title-with-dashes>
The new catalog exposes the same Persian title plus its new slug.
Match on (a) latin model tokens (strongest) and (b) Persian token overlap.

Outputs redirect_map.csv with a confidence score so low-confidence rows can be
reviewed by hand before anything is deployed.
"""
import json, csv, re, urllib.parse, collections

AR2FA = str.maketrans({'ي': 'ی', 'ك': 'ک', 'ﻻ': 'لا', '‌': ' ', 'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ؤ': 'و', 'ة': 'ه'})
DIAC = re.compile(r'[ً-ْٰ]')


def norm(s):
    s = urllib.parse.unquote(s or '')
    s = s.translate(AR2FA)
    s = DIAC.sub('', s)
    s = s.lower()
    s = re.sub(r'[^0-9a-z؀-ۿ]+', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()


STOP = {'پرینتر', 'چاپگر', 'دستگاه', 'برند', 'مدل', 'و', 'با', 'the', 'a'}


def toks(s):
    return [t for t in norm(s).split() if t not in STOP]


def model_tokens(s):
    """Latin/numeric tokens that look like a model designation."""
    n = norm(s)
    raw = re.findall(r'[a-z0-9][a-z0-9\-]*', n)
    out = set()
    for t in raw:
        t = t.replace('-', '')
        if len(t) >= 3 and re.search(r'\d', t):
            out.add(t)
        elif len(t) >= 4 and t.isalpha():
            out.add(t)
    return out


cat = json.load(open('catalog.json', encoding='utf-8'))
for p in cat:
    p['_toks'] = set(toks(p['title']))
    p['_models'] = model_tokens(p['title']) | model_tokens(p['slug'])

# index by model token for fast candidate lookup
by_model = collections.defaultdict(list)
for p in cat:
    for m in p['_models']:
        by_model[m].append(p)

rows = list(csv.DictReader(open('url_status.csv', encoding='utf-8')))
old = [r for r in rows if '/product/' in r['url'] and str(r['status']).startswith('404')]
print(f"old 404 product URLs to map: {len(old)}")

out = open('redirect_map.csv', 'w', newline='', encoding='utf-8')
w = csv.writer(out)
w.writerow(['old_url', 'clicks', 'impressions', 'new_url', 'new_title', 'score', 'confidence', 'method'])

stats = collections.Counter()
for r in old:
    path = urllib.parse.urlparse(r['url']).path
    parts = [p for p in path.split('/') if p]
    # /product/<id>/<slug>
    old_slug = urllib.parse.unquote(parts[2]) if len(parts) >= 3 else ''
    ot, om = set(toks(old_slug)), model_tokens(old_slug)

    cands = set()
    for m in om:
        for p in by_model.get(m, []):
            cands.add(id(p))
    pool = [p for p in cat if id(p) in cands] if cands else cat

    best, bs, method = None, 0.0, ''
    for p in pool:
        ms = len(om & p['_models']) / max(len(om | p['_models']), 1)
        ts = len(ot & p['_toks']) / max(len(ot | p['_toks']), 1)
        sc = 0.65 * ms + 0.35 * ts
        if sc > bs:
            bs, best, method = sc, p, ('model+title' if om & p['_models'] else 'title-only')

    if best and bs >= 0.55:
        conf = 'high'
    elif best and bs >= 0.35:
        conf = 'medium'
    elif best and bs >= 0.20:
        conf = 'low'
    else:
        best, conf = None, 'none'
    stats[conf] += 1
    w.writerow([r['url'], r['clicks'], r['impressions'],
                ('https://mahamprint.com/products/' + best['slug']) if best else '',
                best['title'] if best else '', round(bs, 3), conf, method if best else ''])

out.close()
print("confidence breakdown:", dict(stats))
print("wrote redirect_map.csv")

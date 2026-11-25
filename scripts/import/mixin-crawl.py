"""
خزنده‌ی فروشگاه ساخته‌شده با سایت‌ساز «میکسین» (mixin.ir) — docs/guide/import-mixin.md

    python3 -I scripts/import/mixin-crawl.py https://example.ir <out-dir>

بدون ادمین کار می‌کند: هر صفحه‌ی میکسین داده‌ی کاملش را در payload خود Next.js
(`self.__next_f`) دارد. خروجی:
    <out-dir>/export.json   محصولات (ssrProductInfo کامل)، دسته‌ها، برندها، برگه‌ها، بلاگ، صفحه‌ی اول
    <out-dir>/images/       همه‌ی عکس‌ها با نام اصلی (اجرای دوباره عکس موجود را دوباره نمی‌گیرد)
    <out-dir>/html/         HTML خام برگه‌ها و مقاله‌ها (متنشان گاهی فقط در HTML است)

فقط کتابخانه‌ی استاندارد پایتون؛ بعد `scripts/import/mixin.ts` خروجی را وارد دیتابیس می‌کند.
"""
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

if len(sys.argv) != 3:
    sys.exit(__doc__)
BASE = sys.argv[1].rstrip('/')
OUT = sys.argv[2]
os.makedirs(OUT + '/images', exist_ok=True)
os.makedirs(OUT + '/html', exist_ok=True)
UA = {'User-Agent': 'Mozilla/5.0 (compatible; shop-migration)'}


def get(url, binary=False):
    err = None
    for t in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                b = r.read()
                return b if binary else b.decode('utf8')
        except Exception as e:  # شبکه‌ی کند — چند بار دوباره
            err = e
            time.sleep(2 + t * 3)
    raise err


def locs(name):
    try:
        return re.findall(r'<loc>([^<]+)</loc>', get(f'{BASE}/sitemap-{name}.xml'))
    except Exception:
        return []


def rsc(html):
    """متن payload جریانی RSC که میکسین داده‌ی صفحه را در آن می‌گذارد"""
    chunks = re.findall(r'self\.__next_f\.push\(\[1,"(.*?)"\]\)</script>', html, re.S)
    return ''.join(json.loads('"' + c + '"') for c in chunks)


def obj_at(s, start):
    """شیء JSON که از s[start] == '{' شروع می‌شود (جفت‌کردن آکولاد بیرون از رشته‌ها)"""
    depth, ins, esc = 0, False, False
    for i in range(start, len(s)):
        c = s[i]
        if ins:
            if esc:
                esc = False
            elif c == '\\':
                esc = True
            elif c == '"':
                ins = False
        elif c == '"':
            ins = True
        elif c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                return json.loads(s[start:i + 1])
    return None


def find_obj(s, key):
    i = s.find('"' + key + '":{')
    return None if i < 0 else obj_at(s, s.index('{', i))


def text_rows(s):
    """ردیف‌های متنی RSC (`id:T<len>,<html>`) — متن برگه‌ها اینجاست"""
    return re.findall(r'\n[0-9a-f]+:T[0-9a-f]+,(<.*?)(?=\n[0-9a-f]+:|\Z)', s, re.S)


def meta(html, name):
    m = re.search(r'<meta (?:name|property)="' + re.escape(name) + r'" content="([^"]*)"', html)
    return m.group(1) if m else None


def title_of(html):
    m = re.search(r'<title>([^<]*)</title>', html)
    return m.group(1) if m else None


images = {}


def img(u):
    """دانلود یک عکس (یک بار) و برگرداندن {url, file}"""
    if not u:
        return None
    full = urllib.parse.urljoin(BASE + '/', u).split('?')[0]
    if full not in images:
        fn = os.path.basename(urllib.parse.urlparse(full).path)
        p = f'{OUT}/images/{fn}'
        if not os.path.exists(p):
            try:
                b = get(full, True)
                if b[:5] == b'<?xml':  # میکسین برای فایل گم‌شده XML خطای S3 برمی‌گرداند
                    raise ValueError('missing on storage')
                with open(p, 'wb') as f:
                    f.write(b)
            except Exception as e:
                print('  ⚠️ عکس نیامد', full, e)
                fn = None
        images[full] = fn
    return {'url': full, 'file': images[full]}


def id_of(url, kind):
    m = re.search(r'/' + kind + r'/(\d+)/', url)
    return int(m.group(1)) if m else None


data = {'source': BASE, 'crawledAt': time.strftime('%Y-%m-%dT%H:%M:%S'),
        'products': [], 'categories': [], 'brands': [], 'pages': [], 'blog': [], 'home': {}}

# ── محصولات ─────────────────────────────────────────────────────────────
for u in locs('product'):
    s = rsc(get(u))
    p = find_obj(s, 'ssrProductInfo')
    if not p:
        print('  ⚠️ داده ندارد', u)
        continue
    p['_url'], p['_id'] = u, id_of(u, 'product')
    for im in p.get('images', []):
        im['local'] = img(im['image_url'])
    data['products'].append(p)
    print('محصول', p['_id'], p['name'][:60])

# ── دسته‌ها (درخت کامل در searchData هر صفحه‌ی دسته هست) ──────────────────
cat_urls = locs('category')
if cat_urls:
    s = rsc(get(cat_urls[0]))
    sd = find_obj(s, 'searchData') or {}
    menu = (find_obj(s, 'data') or {}).get('categories', [])
    pos = {c['id']: i for i, c in enumerate(menu)}

    def walk(nodes, parent):
        for c in nodes:
            c['parentId'] = parent
            c['menuOrder'] = pos.get(c['id'])
            c['imageLocal'] = img(c.get('image'))
            try:
                h = get(BASE + c['url'])
                c['title'] = title_of(h)
                c['metaDescription'] = meta(h, 'description')
            except Exception:
                pass
            kids = c.pop('children', []) or []
            data['categories'].append(c)
            walk(kids, c['id'])
    walk(sd.get('all_categories', []), None)
    print('دسته‌ها', len(data['categories']))

# ── برندها (نام از نشانی نقشه‌ی سایت؛ لوگو از صفحه‌ی برند) ──────────────────
for u in locs('brand'):
    h = get(u)
    name = urllib.parse.unquote(u.rstrip('/').split('/')[-1]).replace('-', ' ')
    logo = None
    s = rsc(h)
    info = find_obj(s, 'brand')
    if info and info.get('image_url'):
        logo = img(info['image_url'])
    data['brands'].append({'_id': id_of(u, 'brand'), '_url': u, 'name': name, 'logo': logo,
                           'title': title_of(h), 'metaDescription': meta(h, 'description')})
print('برندها', len(data['brands']))

# ── برگه‌ها و مقاله‌ها ──────────────────────────────────────────────────
for kind, key in (('page', 'pages'), ('blog', 'blog')):
    for u in locs(kind):
        i = id_of(u, kind)
        if i is None:
            continue  # /blog/ خود فهرست است
        h = get(u)
        fn = f'html/{kind}-{i}.html'
        with open(f'{OUT}/{fn}', 'w') as f:
            f.write(h)
        rows = [t for t in text_rows(rsc(h)) if len(t) < 90000]  # ردیف بزرگ، قالب سایت است
        og = meta(h, 'og:image')
        data[key].append({'_id': i, '_url': u, 'title': title_of(h), 'metaDescription': meta(h, 'description'),
                          'contentHtml': rows[0] if rows else None, 'htmlFile': fn,
                          'ogImage': img(og) if og and 'shop-logos' not in og else None})
        print(kind, i, title_of(h))

# ── صفحه‌ی اول: عکس‌ها به ترتیب، با لینک و نزدیک‌ترین تیتر ───────────────────
h = get(BASE + '/')
with open(f'{OUT}/html/home.html', 'w') as f:
    f.write(h)
data['home']['enamad'] = meta(h, 'enamad')
body = re.sub(r'<script.*?</script>', '', h[h.find('<body'):], flags=re.S)
seen, blocks = set(), []
for m in re.finditer(r'<img[^>]*?src="([^"]+)"[^>]*>', body):
    src = m.group(1)
    if 'shop-resources' not in src or 'product-images' in src or '_shared' in src:
        continue
    key = src.split('?')[0]
    if key in seen:
        continue
    seen.add(key)
    pre = body[max(0, m.start() - 1500):m.start()]
    href = re.findall(r'href="([^"]+)"', pre)
    heads = re.findall(r'<h[1-6][^>]*>([^<]{1,120})<', pre)
    blocks.append({'image': img(key), 'href': href[-1] if href else None, 'heading': heads[-1] if heads else None})
data['home']['images'] = blocks
data['home']['headings'] = [re.sub(r'<[^>]+>', '', x).strip()
                            for x in re.findall(r'<h[1-6][^>]*>(.*?)</h[1-6]>', body, re.S)]
data['home']['phones'] = sorted(set(re.findall(r'href="tel:([^"]+)"', body)))
data['home']['emails'] = sorted(set(re.findall(r'href="mailto:([^"]+)"', body)))

with open(f'{OUT}/export.json', 'w') as f:
    json.dump(data, f, ensure_ascii=False, indent=1)
print('✅', {k: len(v) for k, v in data.items() if isinstance(v, list)}, 'عکس', len(images))

#!/usr/bin/env python3
"""Check HTTP status of every URL Google knows about (from GSC), ranked by impressions.
Read-only: issues GET requests with a normal UA, no writes to the server.
Gentle concurrency so production is not stressed."""
import json, csv, time, threading, queue, urllib.request, urllib.error, ssl

SRC = 'gsc_pages.json'
OUT = 'url_status.csv'
CONC = 6
TIMEOUT = 30

d = json.load(open(SRC, encoding='utf-8'))
rows = d['rows']
# rank by impressions desc so the most valuable URLs are checked first
rows.sort(key=lambda r: (-r['impressions'], -r['clicks']))
items = [(r['keys'][0], r['clicks'], r['impressions'], r['position']) for r in rows]

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

q = queue.Queue()
for it in items:
    q.put(it)

lock = threading.Lock()
fh = open(OUT, 'w', newline='', encoding='utf-8')
w = csv.writer(fh)
w.writerow(['url', 'clicks', 'impressions', 'position', 'status', 'final_url', 'hops', 'secs'])
done = [0]


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise urllib.error.HTTPError(req.full_url, code, msg, headers, fp)


def fetch(url, follow):
    op = urllib.request.build_opener(urllib.request.HTTPSHandler(context=ctx),
                                     *([] if follow else [NoRedirect]))
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (compatible; SEO-Audit/1.0; +site-owner-check)'})
    return op.open(req, timeout=TIMEOUT)


def worker():
    while True:
        try:
            url, cl, im, pos = q.get_nowait()
        except queue.Empty:
            return
        t0 = time.time()
        status, final, hops = 0, '', 0
        try:
            r = fetch(url, follow=False)
            status, final = r.status, r.url
            r.read(1)
            r.close()
        except urllib.error.HTTPError as e:
            status = e.code
            loc = e.headers.get('Location', '') if e.headers else ''
            if status in (301, 302, 307, 308) and loc:
                final, hops = loc, 1
                try:  # resolve the chain end
                    r2 = fetch(urllib.parse.urljoin(url, loc) if '://' not in loc else loc, follow=True)
                    final = r2.url
                    status = f"{status}->{r2.status}"
                    r2.read(1); r2.close()
                except urllib.error.HTTPError as e2:
                    status = f"{status}->{e2.code}"
                except Exception as e2:
                    status = f"{status}->ERR"
        except Exception as e:
            status = 'ERR:' + type(e).__name__
        secs = round(time.time() - t0, 2)
        with lock:
            w.writerow([url, cl, im, pos, status, final, hops, secs])
            done[0] += 1
            if done[0] % 100 == 0:
                fh.flush()
                print(f"{done[0]}/{len(items)}", flush=True)
        q.task_done()


import urllib.parse
ts = [threading.Thread(target=worker, daemon=True) for _ in range(CONC)]
for t in ts:
    t.start()
for t in ts:
    t.join()
fh.flush(); fh.close()
print("DONE", done[0], flush=True)

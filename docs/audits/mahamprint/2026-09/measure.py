#!/usr/bin/env python3
"""
سنجش دوره‌ای اثر کارهای سئوی مهام پرینت در برابر خط مبنای ۱۴۰۵/۰۷/۰۷ (baseline.json)

اجرا روی لپ‌تاپ (گوگل آی‌پی ایران را ۴۰۳ می‌دهد — تونل VPN روشن باشد):

    ~/.claude/skills/seo/.venv/bin/python docs/audits/mahamprint/2026-09/measure.py
    ~/.claude/skills/seo/.venv/bin/python docs/audits/mahamprint/2026-09/measure.py --end 2026-11-25 --inspect

- ۲۸ روز آخرِ نهایی‌شده (پایان پیش‌فرض: ۳ روز قبل از امروز) را با ۲۸ روز مبنا مقایسه می‌کند
- جایگاه کلمه‌های هدف (۹۰ روز) را کنار عدد مبنا می‌گذارد
- صفحه‌های لندینگ و مقاله‌های کارها را جدا نشان می‌دهد
- `--inspect` همان ۲۰ محصول نمونه‌ی مبنا را دوباره با URL Inspection می‌سنجد
- عکس لحظه‌ای را در data/snapshots/<تاریخ>.json نگه می‌دارد تا دوره‌ی بعد هم قابل مقایسه باشد

اعتبارنامه: ~/.config/claude-seo/service-account.json (از طریق google_auth اسکیل seo)
"""
import argparse
import json
import os
import sys
from datetime import date, timedelta

sys.path.insert(0, os.path.expanduser("~/.claude/skills/seo/scripts"))
from google_auth import get_oauth_credentials  # noqa: E402
from googleapiclient.discovery import build  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = "https://mahamprint.com/"

# صفحه‌هایی که کارهای این ممیزی رویشان کار می‌کنند — اثرشان جدا دیده شود
TARGET_PAGES = [
    "https://mahamprint.com/collections/kharid-printer-se-kare",
    "https://mahamprint.com/collections/kharid-printer-chahar-kare",
    "https://mahamprint.com/collections/kharid-printer-tak-kare",
    "https://mahamprint.com/collections/kharid-printer-rangi",
    "https://mahamprint.com/collections/kharid-printer-siah-sefid",
    "https://mahamprint.com/categories/printer",
    "https://mahamprint.com/categories/label-printer",
    "https://mahamprint.com/categories/pademza",
    "https://mahamprint.com/",
]


def svc():
    creds = get_oauth_credentials(["https://www.googleapis.com/auth/webmasters.readonly"])
    return build("searchconsole", "v1", credentials=creds)


def query(s, dims, start, end):
    rows, start_row = [], 0
    while True:
        body = {"startDate": start, "endDate": end, "dimensions": dims, "rowLimit": 25000,
                "startRow": start_row, "dataState": "final"}
        r = s.searchanalytics().query(siteUrl=SITE, body=body).execute().get("rows", [])
        rows += r
        if len(r) < 25000:
            return rows
        start_row += 25000


def totals(rows):
    c = sum(r["clicks"] for r in rows)
    i = sum(r["impressions"] for r in rows)
    p = sum(r["position"] * r["impressions"] for r in rows) / max(i, 1)
    return {"clicks": int(c), "impressions": int(i), "ctr": round(c / max(i, 1) * 100, 2), "avgPosition": round(p, 1)}


def pct(new, old):
    if not old:
        return "—"
    return f"{(new - old) / old * 100:+.0f}٪"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--end", help="پایان بازه YYYY-MM-DD (پیش‌فرض: ۳ روز قبل)")
    ap.add_argument("--inspect", action="store_true", help="بازرسی ایندکس ۲۰ محصول نمونه")
    a = ap.parse_args()

    base = json.load(open(os.path.join(HERE, "baseline.json")))
    end = date.fromisoformat(a.end) if a.end else date.today() - timedelta(days=3)
    s28, s90 = (end - timedelta(days=27)).isoformat(), (end - timedelta(days=89)).isoformat()
    e = end.isoformat()
    s = svc()

    daily = query(s, ["date"], s28, e)
    t28 = totals(daily)
    q90 = {r["keys"][0]: r for r in query(s, ["query"], s90, e)}
    p28 = {r["keys"][0]: r for r in query(s, ["page"], s28, e)}

    b28 = base["gsc"]["last28d"]
    pre = base["gsc"]["preMigration4m"]
    print(f"# سنجش سئوی مهام پرینت — ۲۸ روز تا {e}\n")
    print("| شاخص | مبنا (۲۸ روز تا ۲۰۲۶-۰۹-۲۶) | الان | تغییر | ماهانه‌ی قبل از مهاجرت |")
    print("|---|---|---|---|---|")
    for k, label in [("clicks", "کلیک"), ("impressions", "نمایش"), ("ctr", "CTR ٪"), ("avgPosition", "میانگین جایگاه")]:
        prem = round(pre[k] / 4) if k in ("clicks", "impressions") else pre[k]
        print(f"| {label} | {b28[k]} | {t28[k]} | {pct(t28[k], b28[k]) if k != 'avgPosition' else f'{t28[k] - b28[k]:+.1f}'} | {prem} |")
    print(f"| صفحه‌های دارای نمایش (۲۸ روز) | — | {len(p28)} | | |")

    print("\n## کلمه‌های هدف (۹۰ روز)\n")
    print("| کلمه | جایگاه مبنا | جایگاه الان | نمایش مبنا | نمایش الان | کلیک الان |")
    print("|---|---|---|---|---|---|")
    snap_kw = {}
    for kw, b in base["gsc"]["keywords90d"].items():
        r = q90.get(kw)
        now = {"clicks": int(r["clicks"]), "impressions": int(r["impressions"]), "position": round(r["position"], 1)} if r else None
        snap_kw[kw] = now
        print(f"| {kw} | {b['position'] if b else '—'} | {now['position'] if now else '—'} | "
              f"{b['impressions'] if b else 0} | {now['impressions'] if now else 0} | {now['clicks'] if now else 0} |")

    print("\n## صفحه‌های هدف کارها (۲۸ روز)\n")
    print("| صفحه | کلیک | نمایش | جایگاه |")
    print("|---|---|---|---|")
    for u in TARGET_PAGES:
        r = p28.get(u)
        print(f"| {u.replace('https://mahamprint.com', '') or '/'} | {int(r['clicks']) if r else 0} | "
              f"{int(r['impressions']) if r else 0} | {round(r['position'], 1) if r else '—'} |")

    mags = sorted((r for u, r in p28.items() if "/mag/" in u), key=lambda r: -r["impressions"])[:15]
    print("\n## ۱۵ مقاله‌ی پرنمایش (۲۸ روز)\n")
    for r in mags:
        print(f"- {r['keys'][0].replace('https://mahamprint.com', '')} — {int(r['clicks'])} کلیک، {int(r['impressions'])} نمایش، جایگاه {round(r['position'], 1)}")

    snap = {"end": e, "last28d": t28, "keywords90d": snap_kw, "pagesWithImpr28d": len(p28)}

    if a.inspect:
        sample = json.load(open(os.path.join(HERE, "data", "inspect.json")))
        urls = [x["url"] for x in sample if "/products/" in x["url"]][:22]
        res = {}
        for u in urls:
            try:
                r = s.urlInspection().index().inspect(body={"inspectionUrl": u, "siteUrl": SITE}).execute()
                res[u] = r["inspectionResult"]["indexStatusResult"].get("coverageState")
            except Exception as ex:  # سهمیه یا خطای شبکه نباید کل گزارش را خراب کند
                res[u] = f"error: {str(ex)[:80]}"
        indexed = sum(1 for v in res.values() if v == "Submitted and indexed")
        print(f"\n## ایندکس نمونه‌ی محصولات\n\n{indexed} از {len(res)} ایندکس (مبنا: ۸ از ۲۰)")
        snap["indexSample"] = res

    os.makedirs(os.path.join(HERE, "data", "snapshots"), exist_ok=True)
    out = os.path.join(HERE, "data", "snapshots", f"{e}.json")
    json.dump(snap, open(out, "w"), ensure_ascii=False, indent=1)
    print(f"\n_عکس لحظه‌ای: {os.path.relpath(out)}_")


if __name__ == "__main__":
    try:
        main()
    except Exception as ex:
        if "403" in str(ex) and "Forbidden" in str(ex):
            sys.exit("✗ گوگل ۴۰۳ داد — آی‌پی ایران مسدود است؛ تونل VPN را روشن کنید و دوباره اجرا کنید.")
        raise

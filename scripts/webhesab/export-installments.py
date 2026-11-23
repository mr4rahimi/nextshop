#!/usr/bin/env python3
"""
خروجی اقساط «وب حساب» برای «اقساط سازمانی ← انتقال از وب حساب» — docs/plans/org-installments.md بخش ۷.
⚠️ فقط خواندنی: ورود و «گزارش اقساط مشتریان» (sales/inquiry/leasing_inquiry.php) با همه‌ی تاریخ‌ها و
همه‌ی وضعیت‌ها (فقط دکمه‌ی «جستجو»). هیچ فرمی ثبت نمی‌شود.

    python3 -I scripts/webhesab/export-installments.py --env "/path/to/acc.env" --out installments.csv

فایل env: ACC_URL، ACC_USER، ACC_PASS، ACC_COMPANY (رمز چاپ نمی‌شود).
خروجی CSV (UTF-8 با BOM): یک سطر برای هر قسط. مبلغ‌ها **ریال** (همان وب حساب)؛ پنل خودش تومان می‌کند.
ستون «کد تفصیل» از پیوند «استعلام حساب تفصیل مشتری» خوانده می‌شود (کلید تطبیق با شخص در پنل).
سازمان در وب حساب ستون ندارد (معرف و گروه اقساط خالی‌اند)؛ داخل نام مشتری است: «علیخانی (منابع طبیعی)».
"""
import argparse
import csv
import html
import re
import sys
import urllib.parse
import urllib.request
import http.cookiejar

COLS = ["کد قرارداد", "کد تفصیل", "مشتری", "موبایل", "نقطه فروش", "شماره قسط", "سررسید", "تاریخ سند",
        "مبلغ قسط", "پرداخت شده", "آخرین بازپرداخت", "سند پرداخت", "باقیمانده", "شرح"]


def read_env(path):
    env = {}
    for line in open(path, encoding="utf-8"):
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.strip().split("=", 1)
            env[k.strip()] = v.strip().strip("\"'")
    return env


class Client:
    def __init__(self, base):
        self.base = base.rstrip("/")
        self.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def get(self, path):
        with self.op.open(f"{self.base}/{path.lstrip('/')}", timeout=900) as r:
            return r.read().decode("utf-8", "replace")

    def post(self, path, data):
        body = urllib.parse.urlencode(data).encode("utf-8")
        with self.op.open(f"{self.base}/{path.lstrip('/')}", body, timeout=1800) as r:
            return r.read().decode("utf-8", "replace")


def csrf(page):
    m = re.search(r"name=['\"]csrf_token['\"][^>]*value=['\"]([^'\"]*)", page) or re.search(r"value=['\"]([^'\"]*)['\"][^>]*name=['\"]csrf_token", page)
    return m.group(1) if m else ""


def login(c, env):
    page = c.get("index.php")
    home = c.post("index.php", {
        "csrf_token": csrf(page),
        "user_name_entry_field": env["ACC_USER"],
        "password": env["ACC_PASS"],
        "company_login_name": env.get("ACC_COMPANY", "0"),
        "ui_mode": "1",
    })
    if "loginform" in home:
        sys.exit("ورود ناموفق — ACC_USER/ACC_PASS/ACC_COMPANY را ببینید")


def cell(c):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", c))).strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--env", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    env = read_env(a.env)
    c = Client(env["ACC_URL"])
    login(c, env)
    path = "sales/inquiry/leasing_inquiry.php"
    page = c.get(path)
    print("گزارش اقساط مشتریان (همه‌ی تاریخ‌ها) — چند دقیقه طول می‌کشد…", file=sys.stderr)
    page = c.post(path, {
        "csrf_token": csrf(page), "customer_id": "", "leasing_representative_id": "", "leasing_representative2_id": "",
        "installment_group_id": "", "date_type": "invoice", "from_date": "1380/01/01", "to_date": "1420/12/29",
        "view_type": "all", "pos_id": "-1", "search": "1",
    })
    tables = re.findall(r"<table[^>]*>.*?</table>", page, re.S)
    if not tables:
        sys.exit("جدول گزارش پیدا نشد")
    big = max(tables, key=len)
    rows = re.findall(r"<tr[^>]*>(.*?)</tr>", big, re.S)
    out = []
    for tr in rows:
        tds = re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S)
        # گزارش گاهی همه‌ی سطرها را در یک <tr> می‌ریزد (HTML شکسته) — ۲۱ خانه برای هر قسط
        for i in range(0, len(tds) - 17, 21):
            t = tds[i:i + 21]
            if not cell(t[0]).isdigit():
                continue
            code = re.search(r"person_id=(\d+)", t[2])
            out.append([
                cell(t[6]), code.group(1) if code else "", cell(t[2]), cell(t[5]), cell(t[1]), cell(t[8]),
                cell(t[9]), cell(t[10]), cell(t[11]).replace(",", ""), cell(t[12]).replace(",", ""),
                cell(t[13]), cell(t[14]), cell(t[15]).replace(",", ""), cell(t[17]),
            ])
    if not out:
        sys.exit("هیچ قسطی خوانده نشد — ستون‌بندی گزارش عوض شده؟")
    with open(a.out, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(COLS)
        w.writerows(out)
    contracts = len({r[0] for r in out})
    rem = sum(int(r[12] or 0) for r in out)
    print(f"✓ {len(out)} قسط، {contracts} قرارداد، باقیمانده {rem:,} ریال ← {a.out}", file=sys.stderr)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
خروجی کارت‌های اشتراک «وب حساب» برای «باشگاه ← کارت اشتراک ← ورود از نرم‌افزار قبلی».
docs/plans/webhesab-parity.md بخش ۲۳.

⚠️ فقط خواندنی: ورود، یک جستجوی گزارش و باز کردن صفحه‌ی «استعلام تراکنش‌های کارت» هر
مشتری. هیچ فرمی ثبت نمی‌شود.

    python3 -I scripts/webhesab/export-club-cards.py --env "/path/to/acc.env" --out cards.csv [--limit 20]

فایل env: ACC_URL، ACC_USER، ACC_PASS، ACC_COMPANY (رمز چاپ نمی‌شود).
خروجی CSV (UTF-8): یک سطر برای هر شارژ باز (مانده > ۰) با تاریخ انقضای خودش؛ مبلغ به **ریال**
(در صفحه‌ی ورود «ریال» را انتخاب کنید). جمع هر مشتری با «مبلغ امتیاز» فهرست وب حساب
سنجیده می‌شود؛ اگر نخواند، یک سطر با کل مانده و دیرترین انقضا نوشته و گزارش می‌شود.
"""

import argparse
import csv
import html
import http.cookiejar
import re
import sys
import time
import urllib.parse
import urllib.request


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
        self.jar = http.cookiejar.CookieJar()
        self.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))

    def get(self, path):
        with self.op.open(f"{self.base}/{path}", timeout=120) as r:
            return r.read().decode("utf-8", "replace")

    def post(self, path, data):
        body = urllib.parse.urlencode(data).encode("utf-8")
        with self.op.open(f"{self.base}/{path}", body, timeout=300) as r:
            return r.read().decode("utf-8", "replace")


def form_fields(page):
    """مقدار پیش‌فرض همه‌ی فیلدهای فرم (برای جستجو با همان پیش‌فرض‌ها)"""
    data = {}
    for m in re.finditer(r"<input[^>]*>", page):
        t = m.group(0)
        name = re.search(r"name=['\"]([^'\"]*)", t)
        typ = (re.search(r"type=['\"]?(\w+)", t) or [None, "text"])[1].lower()
        val = re.search(r"value=['\"]([^'\"]*)", t)
        if not name or typ in ("submit", "button", "image", "file") or (typ == "checkbox" and "checked" not in t):
            continue
        data[name.group(1)] = html.unescape(val.group(1)) if val else ""
    for m in re.finditer(r"<select[^>]*name=['\"]([^'\"]*)['\"].*?</select>", page, re.S):
        opts = re.findall(r"<option([^>]*)>", m.group(0))
        pick = next((o for o in opts if re.search(r"\bselected\b", o)), opts[0] if opts else None)
        val = re.search(r"value=['\"]([^'\"]*)", pick) if pick else None
        if val:
            data[m.group(1)] = html.unescape(val.group(1))
    return data


def rows_of(page):
    out = []
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", page, re.S):
        cells = re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", tr, re.S)
        out.append([re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", c))).strip() for c in cells])
    return out


num = lambda s: int((s or "0").replace(",", "").replace("٬", "") or 0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--env", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--limit", type=int, default=0, help="فقط N مشتری اول (آزمون)")
    ap.add_argument("--pause", type=float, default=0.3, help="مکث بین درخواست‌ها (ثانیه)")
    a = ap.parse_args()
    env = read_env(a.env)
    c = Client(env["ACC_URL"])

    login = c.get("index.php")
    tok = re.search(r"name='csrf_token' value='([^']*)'", login)
    home = c.post("index.php", {
        "csrf_token": tok.group(1) if tok else "",
        "user_name_entry_field": env["ACC_USER"],
        "password": env["ACC_PASS"],
        "company_login_name": env.get("ACC_COMPANY", "0"),
        "ui_mode": "1",
        "SubmitUser": "ورود",
    })
    if "loginform" in home:
        sys.exit("ورود ناموفق — ACC_USER/ACC_PASS/ACC_COMPANY را ببینید")
    # امروزِ خود وب حساب (پاصفحه: «1405/08/19 14:36») — شارژ تاریخ‌گذشته در مانده‌اش نیست
    today = (re.search(r"(1[34]\d\d/\d\d/\d\d) \d\d:\d\d", home) or [None, ""])[1]
    print(f"امروز وب حساب: {today or 'نامعلوم'}", file=sys.stderr)

    # فهرست مشتریان دارای کارت — جستجوی فقط نمایشی، بی فیلتر تاریخ
    page = c.get("crm/inquiry/customers_cards.php")
    data = form_fields(page)
    data.update({"no_date_filter": "1", "show": "جستجو"})
    page = c.post("crm/inquiry/customers_cards.php", data)
    head = None
    members = []
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", page, re.S):
        cells = [re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", x))).strip() for x in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", tr, re.S)]
        if "شماره کارت" in cells and "موبایل" in cells:
            head = cells
            continue
        if not head or len(cells) != len(head) or not cells[0].isdigit():
            continue
        cid = re.search(r"customer_id=(\d+)", tr)
        g = lambda k: cells[head.index(k)] if k in head else ""
        members.append({"id": cid.group(1) if cid else None, "name": g("نام مشتری"), "mobile": g("موبایل"), "card": g("شماره کارت"), "group": g("گروه"), "amount": num(g("مبلغ امتیاز (ریال)"))})
    if a.limit:
        members = members[: a.limit]
    print(f"{len(members)} مشتری دارای کارت", file=sys.stderr)

    out_rows, mismatch, inactive, total = [], 0, 0, 0
    for i, m in enumerate(members, 1):
        lots = []
        status = ""
        if m["id"]:
            time.sleep(a.pause)
            tx = c.get(f"crm/inquiry/customers_cart_transactions.php?customer_id={m['id']}")
            rows = rows_of(tx)
            for r in rows:
                if "وضعیت:" in r:
                    status = r[r.index("وضعیت:") + 1] if r.index("وضعیت:") + 1 < len(r) else ""
            h = next((r for r in rows if "تاریخ اعتبار" in r and "مبلغ امتیاز" in r), None)
            if h:
                for r in rows:
                    if len(r) != len(h) or not r[0].isdigit():
                        continue
                    v = lambda k: r[h.index(k)] if k in h else ""
                    amount = num(v("مبلغ امتیاز"))
                    if amount <= 0:
                        continue
                    # مانده‌ی هر شارژ = مبلغ − تخصیص‌خورده − سوخته (امتیاز سوخته به ریالِ همان نسبت)
                    burned = num(v("امتیاز سوخته")) * 10
                    left = amount - num(v("تخصیص")) - burned
                    exp = v("تاریخ اعتبار")
                    if today and exp and exp < today:
                        continue  # منقضی: وب حساب هم حسابش نمی‌کند
                    if left > 0:
                        lots.append((left, exp))
        if sum(x for x, _ in lots) != m["amount"]:
            mismatch += 1
            print(f"  ⚠ {m['card'][-4:]}: جمع شارژها {sum(x for x, _ in lots):,} ≠ مانده {m['amount']:,} — یک سطر با کل مانده", file=sys.stderr)
            lots = [(m["amount"], max((e for _, e in lots), default=""))] if m["amount"] > 0 else []
        if status and status != "فعال":
            inactive += 1
        total += m["amount"]
        if not lots:
            lots = [(0, "")]  # کارت بی مانده هم وارد شود
        for amount, exp in lots:
            out_rows.append([m["card"], m["mobile"], m["name"], m["group"], amount, exp])
        if i % 25 == 0:
            print(f"  {i}/{len(members)}", file=sys.stderr)

    with open(a.out, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["شماره کارت", "موبایل", "نام", "گروه", "مبلغ امتیاز (ریال)", "تاریخ انقضاء"])
        w.writerows(out_rows)
    print(f"نوشته شد: {len(out_rows)} سطر، {len(members)} مشتری، جمع {total:,} ریال ({total // 10:,} تومان)؛ "
          f"ناهمخوان {mismatch}، کارت غیرفعال {inactive}", file=sys.stderr)


if __name__ == "__main__":
    main()

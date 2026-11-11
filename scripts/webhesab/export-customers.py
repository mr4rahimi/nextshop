#!/usr/bin/env python3
"""
خروجی مشتریان «وب حساب» برای «باشگاه ← انتقال مشتریان» — docs/plans/webhesab-parity.md بخش ۲۴.

⚠️ فقط خواندنی: ورود، صفحه‌به‌صفحه خواندن «لیست مشتریان فروشگاه» (جستجوی نمایشی)، و دو گزارش
«لیست مشتریان» (۱۲۲) و «میزان خرید مشتریان» (۱۲۳) به‌صورت اکسل. هیچ فرمی ثبت نمی‌شود.

    python3 -I scripts/webhesab/export-customers.py --env "/path/to/acc.env" --out customers.csv
        [--since 1405/08/01]   فقط مشتری‌های ثبت‌شده از این تاریخ (اجرای تکراری سریع)
        [--pages 3]            فقط چند صفحه‌ی اول (آزمون)

فایل env: ACC_URL، ACC_USER، ACC_PASS، ACC_COMPANY (رمز چاپ نمی‌شود).
خروجی CSV (UTF-8 با BOM): یک سطر برای هر مشتری (کلید = کد تفصیل)، مبلغ خرید به **ریال**.
گزارش‌ها کد ندارند؛ با موبایل (و برای بی‌موبایل‌ها با نام یکتا) به مشتری وصل می‌شوند.
خرید موبایلی که چند کد دارد فقط به اولین کد می‌نشیند تا دوبار شمرده نشود.
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

FA = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")


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

    def get(self, path, raw=False):
        with self.op.open(f"{self.base}/{path.lstrip('/')}", timeout=900) as r:
            b = r.read()
            return b if raw else b.decode("utf-8", "replace")

    def post(self, path, data):
        body = urllib.parse.urlencode(data).encode("utf-8")
        with self.op.open(f"{self.base}/{path.lstrip('/')}", body, timeout=900) as r:
            return r.read().decode("utf-8", "replace")


def form_fields(page):
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


def cell_text(c):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", c))).strip()


def mobile_key(v):
    d = re.sub(r"\D", "", (v or "").translate(FA))
    for p in ("0098", "98", "0"):
        if d.startswith(p) and len(d) - len(p) == 10:
            d = d[len(p):]
            break
    return "0" + d if re.fullmatch(r"9\d{9}", d) else None


def name_key(v):
    return re.sub(r"[\s.\u200c]+", "", (v or "").replace("ي", "ی").replace("ك", "ک"))


def login(c, env):
    page = c.get("index.php")
    tok = re.search(r"name='csrf_token' value='([^']*)'", page)
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


def list_customers(c, since, max_pages, pause):
    """«لیست مشتریان فروشگاه» با غیرفعال‌ها، همه‌ی انبارها؛ صفحه‌به‌صفحه (۵۰تایی)"""
    path = "sales/inquiry/customers_list.php"
    page = c.get(path)
    today = (re.search(r"(1[34]\d\d/\d\d/\d\d)(?:&nbsp;|\s)\d\d:\d\d", page) or [None, ""])[1]
    d = form_fields(page)
    d.update({"show_customer_inactive": "1", "default_location": "0", "area": "0", "search": "جستجو"})
    if since:
        d.update({"register_from_date": since, "register_to_date": today or d.get("register_to_date", "")})
        d.pop("no_date_filter", None)
    else:
        d["no_date_filter"] = "1"
    page = c.post(path, d)
    out, head, n = [], None, 0
    while True:
        n += 1
        for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", page, re.S):
            cells = [cell_text(x) for x in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", tr, re.S)]
            if "کد تفصیل" in cells and "موبایل" in cells:
                head = cells
                continue
            if not head or len(cells) != len(head) or not cells[0].isdigit():
                continue
            g = lambda k: cells[head.index(k)] if k in head else ""
            dn = re.search(r"debtor_no=(\d+)", tr)
            out.append({
                "code": g("کد تفصیل"), "sourceId": dn.group(1) if dn else "", "name": g("مشتری"), "mobile": g("موبایل"),
                "phone": g("تلفن"), "birth": g("تاریخ تولد"), "region": g("منطقه فروش"), "store": g("انبار پیش فرض"),
                "group": g("گروه امتیازدهی"), "card": g("شماره کارت اشتراک"), "registered": g("تاریخ ثبت"),
                "address": g("آدرس"), "status": g("وضعیت"),
            })
        m = re.search(r"ردیف های\s*(\d+)\s*تا\s*(\d+)\s*از\s*(\d+)", page)
        if n == 1 or n % 25 == 0:
            print(f"  فهرست: {m.group(2) if m else len(out)} از {m.group(3) if m else '?'}", file=sys.stderr)
        if not m or int(m.group(2)) >= int(m.group(3)) or (max_pages and n >= max_pages):
            break
        time.sleep(pause)
        d2 = form_fields(page)
        d2.pop("search", None)
        d2["trans_tbl_page_next"] = "1"
        page = c.post(path, d2)
    return out, today


def run_report(c, rep_id, params):
    """گزارش اکسل (XML اسپردشیت) — همان POST فرم گزارش؛ سطرها با رعایت ss:Index"""
    path = f"reporting/reports_main.php?Class=0&rep_id={rep_id}"
    page = c.get(path)
    d = {k: v for k, v in form_fields(page).items() if k.startswith("PARAM_") or k in ("REP_ID", "csrf_token")}
    d.update(params)
    d[f"Rep{rep_id}"] = "نمایش"
    r = c.post(path, d)
    m = re.search(r"url=([^'\"]+)['\"]", r)
    if not m:
        print(f"  ⚠ گزارش {rep_id} خروجی نداد", file=sys.stderr)
        return []
    xml = c.get(m.group(1).replace(" ", "%20"), raw=True).decode("utf-8", "replace")
    rows = []
    for row in re.findall(r"<Row[^>]*>(.*?)</Row>", xml, re.S):
        cells = []
        for cm in re.finditer(r"<Cell([^>]*)>(.*?)</Cell>", row, re.S):
            idx = re.search(r'ss:Index="(\d+)"', cm.group(1))
            if idx:
                while len(cells) < int(idx.group(1)) - 1:
                    cells.append("")
            cells.append(cell_text(cm.group(2)))
        rows.append(cells)
    return rows


def table_after(rows, first_two):
    i = next((k for k, r in enumerate(rows) if r[:2] == first_two), None)
    if i is None:
        return None, []
    return rows[i], [r for r in rows[i + 1:] if r and r[0].isdigit()]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--env", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--since", default="", help="فقط مشتری‌های ثبت‌شده از این تاریخ شمسی (۱۴۰۵/۰۸/۰۱)")
    ap.add_argument("--pages", type=int, default=0, help="فقط N صفحه‌ی اول فهرست (آزمون)")
    ap.add_argument("--pause", type=float, default=0.2, help="مکث بین صفحه‌ها (ثانیه)")
    a = ap.parse_args()
    env = read_env(a.env)
    c = Client(env["ACC_URL"])
    login(c, env)

    custs, today = list_customers(c, a.since.translate(FA), a.pages, a.pause)
    print(f"{len(custs)} مشتری در فهرست (امروز وب حساب: {today or 'نامعلوم'})", file=sys.stderr)

    # جنسیت و تاریخ‌ها از «لیست مشتریان» (فقط فعال‌ها)
    start = a.since.translate(FA) or "1380/01/01"
    end = today or "1499/12/29"
    h122, r122 = table_after(run_report(c, 122, {"PARAM_0": start, "PARAM_1": end, "PARAM_3": "1"}), ["ردیف", "نام"])
    info = {}
    if h122:
        g = lambda r, k: r[h122.index(k)] if k in h122 and h122.index(k) < len(r) else ""
        for r in r122:
            k = mobile_key(g(r, "تلفن همراه"))
            if k and k not in info:
                info[k] = {"gender": g(r, "جنسیت"), "birth": g(r, "تاریخ تولد"), "marriage": g(r, "تاریخ ازدواج")}
    print(f"گزارش لیست مشتریان: {len(r122)} سطر", file=sys.stderr)

    # خلاصه‌ی خرید از اول (همه‌ی انبارها) — هر مشتری ممکن است برای هر انبار یک سطر داشته باشد
    h123, r123 = table_after(run_report(c, 123, {"PARAM_0": "1380/01/01", "PARAM_1": end, "PARAM_3": "1"}), ["ردیف", "نام مشتری"])
    buys = {}
    if h123:
        g = lambda r, k: r[h123.index(k)] if k in h123 and h123.index(k) < len(r) else ""
        for r in r123:
            key = mobile_key(g(r, "موبایل")) or "n:" + name_key(g(r, "نام مشتری"))
            b = buys.setdefault(key, {"n": 0, "amount": 0.0, "last": "", "store": "", "best": -1.0})
            amt = float((g(r, "مبلغ خرید") or "0").replace(",", "") or 0)
            b["n"] += int(float(g(r, "تعداد فاکتور") or 0))
            b["amount"] += amt
            b["last"] = max(b["last"], g(r, "تاریخ آخرین خرید"))
            if amt > b["best"]:
                b["best"], b["store"] = amt, g(r, "انبار")
    total_buy = sum(b["amount"] for b in buys.values())
    print(f"گزارش میزان خرید: {len(r123)} سطر، جمع {total_buy:,.0f} ریال", file=sys.stderr)

    # وصل کردن: موبایل، وگرنه نام یکتا میان بی‌موبایل‌ها
    names = {}
    for cu in custs:
        if not mobile_key(cu["mobile"]):
            names.setdefault(name_key(cu["name"]), []).append(cu["code"])
    used, matched = set(), 0.0
    rows = []
    for cu in custs:
        k = mobile_key(cu["mobile"])
        key = k if k else ("n:" + name_key(cu["name"]) if len(names.get(name_key(cu["name"]), [])) == 1 else None)
        b = buys.get(key) if key and key not in used else None
        if b:
            used.add(key)
            matched += b["amount"]
        i = info.get(k, {}) if k else {}
        rows.append([
            cu["code"], cu["sourceId"], cu["name"], cu["mobile"], cu["phone"], cu["address"], cu["region"], cu["store"] or (b or {}).get("store", ""),
            cu["group"], cu["card"], cu["registered"], cu["status"], i.get("gender", ""), cu["birth"] or i.get("birth", ""), i.get("marriage", ""),
            b["n"] if b else 0, f"{b['amount']:.0f}" if b else 0, b["last"] if b else "",
        ])

    with open(a.out, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["کد", "شناسه وب حساب", "نام", "موبایل", "تلفن", "آدرس", "منطقه", "انبار", "گروه", "شماره کارت", "تاریخ ثبت", "وضعیت",
                    "جنسیت", "تاریخ تولد", "تاریخ ازدواج", "تعداد فاکتور", "مبلغ خرید (ریال)", "آخرین خرید"])
        w.writerows(rows)
    unmatched = total_buy - matched
    print(f"نوشته شد: {len(rows)} مشتری؛ خرید وصل‌شده {matched:,.0f} ریال ({matched / total_buy * 100 if total_buy else 0:.1f}٪)، "
          f"وصل‌نشده {unmatched:,.0f} ریال (مشتری بی موبایل با نام تکراری یا بیرون از فهرست)", file=sys.stderr)


if __name__ == "__main__":
    main()

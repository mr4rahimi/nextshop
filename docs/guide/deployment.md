# استقرار (Deployment)

یک کدبیس، چند سایت. هر سایت یک سرور/مسیر/پروسه‌ی pm2/دیتابیس جدا دارد و فقط
با `.env` خودش از بقیه متمایز می‌شود.

منبع حقیقت فهرست سایت‌ها: [`scripts/deploy/targets.json`](../../scripts/deploy/targets.json)

## سایت‌های مستقر

| نام | دامنه | سرور | مسیر | پروسه pm2 | پورت | tier |
|-----|-------|------|------|-----------|------|------|
| `9dm` | 9dm.ir | 185.164.73.224 | `/var/www/9dm` | `9dm` | 3003 | demo |
| `mahamprint` | mahamprint.com | 185.164.73.224 | `/var/www/mahamprinter` | `mahamprinter` | 3002 | production |
| `bartarjanebi` | bartar-janebi.com | 185.164.73.224 | `/var/www/bartarjanebi` | `bartarjanebi` | 3001 | production |
| `mymonta` | mymonta.ir | 5.159.49.243 | `/var/www/mymonta` | `mymonta-shop` | 3000 | production |
| `uniqquestar` | uniqquestar.com | 109.122.246.96 | `/var/www/uniqquestar` | `uniqquestar` | 3000 | production |

> سه سایت اول روی یک سرور مشترک‌اند — هرگز `pm2 restart all` نزنید و به دیتابیس
> سایت‌های دیگر دست نزنید.

## روند آپدیت روزمره

```bash
# همیشه اول dry-run
node scripts/deploy/deploy.mjs uniqquestar --dry-run

# استقرار واقعی
node scripts/deploy/deploy.mjs uniqquestar
```

اسکریپت به‌ترتیب: اتصال را چک می‌کند → از دیتابیس `pg_dump` می‌گیرد → از کد فعلی
`tar` می‌گیرد → rsync می‌کند (`--delete` ولی `.env`، `public/uploads`، `docs`،
`node_modules` و `ecosystem.config.js` مستثنا) → اگر `pnpm-lock.yaml` تغییر کرده
`node_modules` را منتقل می‌کند → `prisma generate` + `migrate deploy` + `next build`
→ `pm2 restart` → health check؛ و اگر سایت بالا نیامد خودکار به بکاپ برمی‌گردد.

برای سایت‌های `production` دو تأیید دستی می‌خواهد (`yes` و `backup-ok`).
با `--yes` رد می‌شود و با `--tier demo` می‌توان گروهی اجرا کرد.

> استقرار پروداکشن دستی انجام می‌شود — Claude آماده‌سازی و بکاپ می‌کند، فرمان
> نهایی با خود شماست.

## راه‌اندازی سرور جدید از صفر

مرجع عملی: همان کاری که برای `uniqquestar` روی Ubuntu 24.04 انجام شد.

### ۱) دسترسی SSH
```bash
# اگر پسورد روت منقضی شده، اول با TTY تغییرش دهید، بعد کلید را نصب کنید
ssh-copy-id -i ~/.ssh/id_ed25519.pub root@<IP>
ssh -o BatchMode=yes root@<IP> 'echo ok'   # باید بدون پسورد جواب دهد
```
`deploy.mjs` با `-o BatchMode=yes` وصل می‌شود؛ تا وقتی ورود بی‌پسورد کار نکند
استقرار شکست می‌خورد.

### ۲) سیستم‌عامل و swap
رم کم (≤۲ گیگ) برای `next build` کافی نیست — قبل از هر چیز swap بسازید:
```bash
fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
timedatectl set-timezone Asia/Tehran
```

### ۳) پکیج‌ها
```bash
apt-get install -y build-essential git curl unzip ufw nginx \
  postgresql postgresql-contrib redis-server certbot python3-certbot-nginx jq
```
Node 22 از مخزن NodeSource (کلید در `/etc/apt/keyrings/nodesource.gpg`)، سپس:
```bash
npm install -g pm2
corepack enable && corepack prepare pnpm@10 --activate
pm2 startup systemd -u root --hp /root
```

> **اگر سرور به `registry.npmjs.org` دسترسی ندارد** (روی سرورهای ایران رایج است)
> رجیستری را عوض کنید: `npm config set registry https://registry.npmmirror.com/`.
> برای خودِ استقرار مهم نیست — `node_modules` از لوکال منتقل می‌شود و `npx` هم
> باینری‌های محلی را بدون شبکه پیدا می‌کند.

### ۴) دیتابیس
```bash
sudo -u postgres psql -c "CREATE ROLE <name> LOGIN PASSWORD '<pass>';"
sudo -u postgres createdb -O <name> <name>
sudo -u postgres psql -d <name> -c "ALTER SCHEMA public OWNER TO <name>;"
```
PostgreSQL فقط روی localhost گوش می‌دهد؛ همین کافی است.

### ۵) فایروال
```bash
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable
```

### ۶) nginx
هر سایت یک فایل در `/etc/nginx/sites-available/<name>`:
ریدایرکت ۸۰ → ۴۴۳، پراکسی `/` به `127.0.0.1:<port>`، سرو مستقیم
`/_next/static/` و `/uploads/` از دیسک، و `location ^~ /.well-known/acme-challenge/`
که **نباید** ریدایرکت شود (وگرنه تمدید گواهی می‌شکند).

> nginx نسخه‌ی ۱.۲۴ اوبونتو دستور `http2 on;` را نمی‌شناسد — از
> `listen 443 ssl http2;` استفاده کنید.

### ۷) گواهی SSL روی خود سرور (حتی وقتی CDN دارید)
دامنه پشت CDN (پارس‌پک) است و CDN گواهی خودش را دارد، ولی origin هم گواهی
مستقل می‌خواهد تا اتصال CDN→سرور رمزنگاری شود.

اول مطمئن شوید CDN مسیر چالش را پاس می‌دهد:
```bash
mkdir -p /var/www/letsencrypt/.well-known/acme-challenge
echo test > /var/www/letsencrypt/.well-known/acme-challenge/probe
curl -s http://<domain>/.well-known/acme-challenge/probe   # باید test برگردد
```
سپس:
```bash
certbot certonly --webroot -w /var/www/letsencrypt \
  -d <domain> -d www.<domain> --agree-tos --register-unsafely-without-email -n
```
و یک hook تمدید بگذارید، وگرنه nginx گواهی نو را برنمی‌دارد:
```bash
printf '#!/bin/sh\nsystemctl reload nginx\n' \
  > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
certbot renew --dry-run
```

### ۸) اولین استقرار (دستی)
`deploy.mjs` برای سایت موجود نوشته شده — وجود `.env` و پروسه‌ی pm2 را شرط
می‌داند و از دیتابیس بکاپ می‌گیرد. بار اول این‌ها هنوز نیستند، پس دستی:

```bash
# کد (همان excludes اسکریپت)
rsync -az --exclude=.git --exclude=.env --exclude=node_modules --exclude=.next \
      --exclude=docs --exclude='*.md' --exclude=public/uploads \
      ./ root@<IP>:/var/www/<name>/

# وابستگی‌ها — rsync نه tar، چون قابل ادامه است اگر اینترنت قطع شد
rsync -az --partial node_modules/ root@<IP>:/var/www/<name>/node_modules/

# ساخت و بالا آوردن
ssh root@<IP> 'cd /var/www/<name> && npx prisma generate && npx prisma migrate deploy \
  && NODE_OPTIONS="--max-old-space-size=2048" npx next build \
  && pm2 start ecosystem.config.js && pm2 save'
```

بعد `.deps-hash` را بنویسید تا استقرار بعدی بی‌دلیل ۷۰۰ مگابایت جابه‌جا نکند:
```bash
ssh root@<IP> "sha256sum /var/www/<name>/pnpm-lock.yaml | cut -c1-16 > /var/www/<name>/.deps-hash"
```

### ۹) ثبت سایت در اسکریپت
یک رکورد به `scripts/deploy/targets.json` اضافه کنید (`name`, `host`, `user`,
`path`, `pm2`, `port`, `url`, `tier`). از این به بعد `deploy.mjs` کار می‌کند.

## `.env` هر سایت — حداقل لازم

خود فایل در rsync مستثناست و **فقط روی سرور** وجود دارد.

| متغیر | توضیح |
|-------|-------|
| `DATABASE_URL` | دیتابیس همان سایت |
| `NEXT_PUBLIC_SITE_URL` / `SITE_URL` / `NEXT_PUBLIC_BASE_URL` | دامنه‌ی عمومی |
| `INTERNAL_BASE_URL` | `http://127.0.0.1:<port>` — مسیرهای داخلی کش ریدایرکت |
| `JWT_SECRET` | احراز هویت ادمین |
| `PASSWORD_SALT` | هش پسورد |
| `REDIRECT_CACHE_TOKEN` | محافظ `app/api/internal/*` — **در هر سرور دستی** |
| `INTEGRATION_ENCRYPTION_KEY` | hex ۶۴ کاراکتری؛ در production **اجباری** وگرنه بالا نمی‌آید |
| `INTEGRATION_WORKER_SECRET` | محافظ endpoint دستی worker |
| `REDIS_URL` | صف worker باشگاه مشتریان |
| `NEXT_PUBLIC_STORE_NAME` | نام فروشگاه |

اختیاری بسته به سرویس‌ها: `IRANPAYAMAK_*`، `GAPGPT_API_KEY`، `TOROB_WEBHOOK_TOKEN`،
`INDEXNOW_KEY`، `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`.

## عیب‌یابی

| نشانه | علت محتمل |
|-------|-----------|
| `مسیر، فایل .env یا پروسه pm2 یافت نشد` | ورود بی‌پسورد کار نمی‌کند، یا نام pm2 در `targets.json` با سرور فرق دارد |
| build وسط کار kill می‌شود (کد ۱۳۷) | رم کم — swap اضافه کنید |
| health check رد می‌شود | `pm2 logs <name> --err` روی سرور؛ اسکریپت خودش به بکاپ برگردانده |
| بعد از تمدید گواهی، مرورگر گواهی قدیمی می‌بیند | hook ری‌لود nginx نصب نشده |
| ACME تمدید نمی‌شود | CDN مسیر `/.well-known/acme-challenge/` را پاس نمی‌دهد یا nginx ریدایرکتش می‌کند |

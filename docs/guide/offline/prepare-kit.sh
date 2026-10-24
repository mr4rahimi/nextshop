#!/usr/bin/env bash
# ساخت «بسته‌ی آفلاین» روی لپ‌تاپ — تا وقتی اینترنت جهانی هست اجرا کنید.
# بعد از قطعی، نصب سرور تازه فقط با همین پوشه ممکن است.
#
#   bash docs/guide/offline/prepare-kit.sh                 # پیش‌فرض: ~/gardanos-offline-kit
#   bash docs/guide/offline/prepare-kit.sh /media/usb/kit  # مسیر دلخواه
#
# اگر Docker Hub در دسترس نیست:  DOCKER_MIRROR=docker.arvancloud.ir bash …
# اگر فقط یک نسخه‌ی اوبونتو لازم است:  UBUNTU_RELEASES="24.04" bash …
#
# راهنما: docs/guide/offline/install-guide.html (بخش «بسته‌ی آفلاین»)
set -euo pipefail

NEXTSHOP="$(cd "$(dirname "$0")/../../.." && pwd)"
GARDANOS="${GARDANOS:-$HOME/Projects/gardanos}"
KIT="${1:-$HOME/gardanos-offline-kit}"
UBUNTU_RELEASES="${UBUNTU_RELEASES:-24.04 26.04}"
NODE_VER="$(node -v)"           # همان نسخه‌ی لپ‌تاپ — node_modules با همین ساخته شده
PNPM_VER="$(pnpm -v)"

# بسته‌های سیستمی سرور — build-essential لازم نیست چون node_modules آماده منتقل می‌شود
APT_PKGS="nginx postgresql postgresql-contrib redis-server rsync curl jq unzip ufw \
  certbot python3-certbot-nginx chrony ca-certificates openssl gzip tar xz-utils"

step() { printf '\n\033[1;36m── %s\033[0m\n' "$*"; }
mkdir -p "$KIT"/{node,pm2,pnpm,debs,app,gardanos,secrets}

step "۱) Node $NODE_VER"
f="node-$NODE_VER-linux-x64.tar.xz"
[ -s "$KIT/node/$f" ] || curl -fL --retry 3 -o "$KIT/node/$f" "https://nodejs.org/dist/$NODE_VER/$f"

step "۲) pm2 (با همه‌ی وابستگی‌ها)"
if [ ! -s "$KIT/pm2/pm2-kit.tgz" ]; then
  tmp="$(mktemp -d)"
  (cd "$tmp" && npm init -y >/dev/null && npm install --no-audit --no-fund pm2 >/dev/null \
    && tar -czf "$KIT/pm2/pm2-kit.tgz" node_modules package.json)
  rm -rf "$tmp"
fi

step "۳) pnpm $PNPM_VER (فقط برای مواقع اضطرار — استقرار عادی لازمش ندارد)"
(cd "$KIT/pnpm" && ls pnpm-*.tgz >/dev/null 2>&1 || npm pack "pnpm@$PNPM_VER" >/dev/null)

step "۴) بسته‌های apt برای اوبونتو: $UBUNTU_RELEASES"
if command -v docker >/dev/null; then
  for rel in $UBUNTU_RELEASES; do
    out="$KIT/debs/$rel"; mkdir -p "$out"
    if ls "$out"/*.deb >/dev/null 2>&1; then echo "  $rel: از قبل هست"; continue; fi
    img="${DOCKER_MIRROR:+$DOCKER_MIRROR/}ubuntu:$rel"
    docker run --rm -v "$out:/out" "$img" bash -c "
      apt-get update -qq &&
      DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --download-only $APT_PKGS &&
      cp /var/cache/apt/archives/*.deb /out/ && chown -R $(id -u):$(id -g) /out" \
      || echo "  ⚠️ $rel دانلود نشد — بعداً با DOCKER_MIRROR دوباره اجرا کنید"
  done
else
  echo "  ⚠️ docker نیست — این مرحله رد شد (راهنما: «apt بدون اینترنت»)"
fi

step "۵) کد و node_modules فروشگاه (nextshop)"
git -C "$NEXTSHOP" bundle create "$KIT/app/nextshop.bundle" --all
tar -C "$NEXTSHOP" -czf "$KIT/app/node_modules.tgz" node_modules
cp "$NEXTSHOP/pnpm-lock.yaml" "$KIT/app/"
sha256sum "$NEXTSHOP/pnpm-lock.yaml" | cut -c1-16 > "$KIT/app/deps-hash.txt"
git -C "$NEXTSHOP" log -1 --format='%h %s' > "$KIT/app/commit.txt"

step "۶) سایت گردانوس"
if [ -d "$GARDANOS/.git" ]; then
  git -C "$GARDANOS" bundle create "$KIT/gardanos/gardanos.bundle" --all
  tar -C "$GARDANOS" -czf "$KIT/gardanos/node_modules.tgz" node_modules
  [ -d "$GARDANOS/dist" ] && tar -C "$GARDANOS" -czf "$KIT/gardanos/dist.tgz" dist
else
  echo "  ⚠️ $GARDANOS پیدا نشد — رد شد"
fi

step "۷) راهنما"
cp "$NEXTSHOP/docs/guide/offline/install-guide.html" "$KIT/"
cp "$0" "$KIT/"

step "۸) رازها (رمزگذاری‌شده با gpg)"
echo "  فهرست سایت‌ها، کلید امضای نسخه، کلید SSH و پیکربندی SSH — یک رمز بدهید و جای امن نگه دارید."
secrets=()
for p in "$NEXTSHOP/scripts/deploy/targets.json" "$NEXTSHOP/release-keys" "$HOME/.ssh/config" \
         "$HOME/.ssh/id_ed25519" "$HOME/.ssh/id_ed25519.pub"; do
  [ -e "$p" ] && secrets+=("$p")
done
if [ ${#secrets[@]} -gt 0 ] && command -v gpg >/dev/null; then
  tar -czf - "${secrets[@]}" 2>/dev/null | gpg --batch --yes -c -o "$KIT/secrets/secrets.tgz.gpg" \
    || echo "  ⚠️ رمزگذاری انجام نشد"
fi

step "۹) checksum"
(cd "$KIT" && find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS)

du -sh "$KIT"
echo -e "\n✅ بسته آماده است: $KIT"
echo "   آزمون سلامت هر زمان:  (cd $KIT && sha256sum -c --quiet SHA256SUMS && echo سالم)"

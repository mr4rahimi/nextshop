This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

⚠️ License & Usage Notice 🚫 Unauthorized use is strictly prohibited

This repository is NOT open-source.

You are NOT allowed to:

Use this project or its source code in other projects

Copy, redistribute, or publish any part of it

Modify or fork the repository

Use it for commercial or non-commercial purposes

✅ You ARE allowed to:

View the source code

Review the project structure and architecture

Evaluate implementation ideas without copying code


## create Admin Example

cd /home/mehdi/Projects/mymonta/shop
DATABASE_URL="postgresql://root:password@localhost:54321/mymonta" npx tsx scripts/create-admin.ts

node -e "
async function hashPassword(password) {
  const data = new TextEncoder().encode(password + 'mymonta-salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}
hashPassword('535318193@Mr').then(h => console.log(h));
"

PGPASSWORD="password" psql -h localhost -p 54321 -U root -d mymonta << 'EOF'
INSERT INTO "User" (id, phone, "passwordHash", role, "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  '09999936488',
  '0f2d7914f3b6a20e5814b4489d2d301f310bba7eec3c77406237dab97167bb90',
  'ADMIN',
  true,
  now(),
  now()
)
ON CONFLICT (phone) DO UPDATE SET
  "passwordHash" = '0f2d7914f3b6a20e5814b4489d2d301f310bba7eec3c77406237dab97167bb90',
  role = 'ADMIN',
  "isActive" = true,
  "updatedAt" = now();
SELECT id, phone, role FROM "User" WHERE phone = '09999936488';
EOF


📄 This project is protected under a custom restrictive license. See the LICENSE file for full legal terms.

📩 Permission Requests For permission requests or inquiries, contact:

📱 Telegram / WhatsApp / Call

📞 +98 9916352600# astro-site-builder# nextshop

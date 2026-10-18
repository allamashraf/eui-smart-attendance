# Deploying online (GitHub + Supabase + Vercel)

GitHub Pages only serves static files. This project needs a server (`app/api/`), a PostgreSQL
database and private secrets, so it runs like this:

| Part            | Service  | Cost |
| --------------- | -------- | ---- |
| Code            | GitHub   | Free |
| Database        | Supabase | Free |
| Website + API   | Vercel   | Free (Hobby) |

## 0. Turn off GitHub Pages

Repository → **Settings → Pages → Source → None**. Otherwise the README stays public as a page.

## 1. Database (Supabase)

1. https://supabase.com/dashboard → **New project**. Save the database password.
2. Project → **Connect** → copy the **Transaction pooler** connection string (port `6543`).
3. Replace `[YOUR-PASSWORD]` with the database password (URL-encode `@ # / ?` if it has them).

## 2. Create the tables from your computer

```
npm install
cp .env.example .env.local
```

Edit `.env.local`:

```env
DATABASE_URL="postgresql://postgres.XXXX:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres"
AUTH_SECRET="...random 64 hex..."
QR_SECRET="...a different random 64 hex..."
DEMO_PASSWORD="a password you choose, 10+ characters"
```

Make each secret with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

Then:

```
npm run db:setup
npm run db:seed
```

## 3. Website (Vercel)

1. https://vercel.com → sign in with GitHub → **Add New → Project** → import `eui-smart-attendance`.
2. Framework is detected as **Next.js**. Leave build settings as they are.
3. **Environment Variables** — add these three (same values as `.env.local`):
   `DATABASE_URL`, `AUTH_SECRET`, `QR_SECRET`
   (`DEMO_PASSWORD` is not needed on Vercel; it is only used by the seed script.)
4. **Deploy**. You get an `https://….vercel.app` address.
5. Check `https://….vercel.app/api/health` — it should report the database as OK.

Every `git push` to `main` deploys again automatically.

## Safety

- Synthetic data only. No real student records.
- Share the address and `DEMO_PASSWORD` only with the people testing it.
- To change the password later: edit `DEMO_PASSWORD` in `.env.local` and run `npm run db:seed` again.

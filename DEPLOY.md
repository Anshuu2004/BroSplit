# Brosplit — Deploy Guide (Vercel + Supabase)

Goal: ship the live URL of Brosplit at `https://your-app.vercel.app` (or your custom domain) in ~10 minutes.

## 0. Prerequisites

- Supabase project already provisioned and migrations applied (you've done this).
- A GitHub account.
- A Vercel account (sign in with GitHub — free Hobby tier is fine for MVP).

## 1. Push the code to GitHub

```bash
cd c:\Users\abhis\Desktop\BroSplit
git init
git add .
git commit -m "Brosplit MVP"
```

Then on github.com:

1. Create a new **private** repo named `brosplit` (private — your code references your Supabase project).
2. Don't initialize with README/license — we already have one.
3. Push:

```bash
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/brosplit.git
git push -u origin main
```

> **Important:** `.env.local` is gitignored, so your service-role key is **not** pushed. You'll set env vars in Vercel directly.

## 2. Import the project into Vercel

1. Go to https://vercel.com/new.
2. Click **Import Git Repository** → pick `brosplit`.
3. Framework preset auto-detects **Next.js** — leave the build/output settings as-is.
4. Expand **Environment Variables** and add these four (copy from your local `.env.local`):

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://pmessfszmaivhgnkjign.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (your `eyJ…` anon key) |
| `SUPABASE_SERVICE_ROLE_KEY` | (your `eyJ…` service-role key) |
| `NEXT_PUBLIC_SITE_URL` | leave blank for now — fill after first deploy |

5. Click **Deploy**. First build takes ~2 minutes.

## 3. Update Supabase URL configuration

After the first deploy you'll have a URL like `https://brosplit-abc123.vercel.app`.

### a) Add the production URL to Vercel env

- Vercel dashboard → your project → **Settings → Environment Variables**.
- Edit `NEXT_PUBLIC_SITE_URL` and set it to your Vercel URL (no trailing slash).
- **Redeploy** (Deployments tab → most recent → ⋯ menu → Redeploy).

### b) Allow the production URL in Supabase Auth

Supabase needs to know which redirect URLs are valid for confirmation emails / OAuth.

1. Open the Supabase dashboard → **Authentication → URL Configuration**.
2. Set **Site URL** to `https://brosplit-abc123.vercel.app` (or your custom domain).
3. Add to **Redirect URLs (Additional)**:
   - `https://brosplit-abc123.vercel.app/auth/callback`
   - `https://brosplit-abc123.vercel.app/**` (wildcard — accepts any path)
   - keep `http://localhost:3000/auth/callback` for local dev
4. Save.

## 4. Custom domain (optional but recommended)

If you have a domain (e.g. `brosplit.app`):

1. Vercel → **Settings → Domains** → add your domain → follow the DNS instructions.
2. Once verified:
   - Update `NEXT_PUBLIC_SITE_URL` to `https://brosplit.app`.
   - Update Supabase **Site URL** + **Redirect URLs** to the new domain.
   - Redeploy.

## 5. Smoke test on production

Open the production URL in a fresh browser (or incognito):

1. **Sign up** → "Check your inbox" — confirm email.
2. **Create group** → invite a second user.
3. **Add expense** → split → verify balance.
4. **Settle up** → request → accept on the lender side.

If any step fails, check:
- Vercel **Logs** (Deployments → Runtime Logs) — server-side errors show here.
- Browser console — client-side errors.
- Supabase **Logs → API** — RLS / database errors with full details.

## 6. Future deploys

Every push to `main` auto-deploys. PRs get a **preview URL**.

```bash
git add -A && git commit -m "your message" && git push
```

Vercel posts the new URL in the GitHub commit/PR.

## 7. Things to do before you tell anyone about it

- **Rotate the Supabase service-role key** (you shared one in chat earlier). Project Settings → API → "Generate new service_role secret". Copy the new value into Vercel env vars and redeploy.
- **Custom SMTP** in Supabase Auth → SMTP Settings. The default email sender is rate-limited to ~3 emails/hour and will hit users' spam. Brevo/Resend/SendGrid all have free tiers good enough for early users.
- **Enable Captcha** on signup (Supabase Auth → Providers → Email → Enable Captcha) before sharing the link publicly.
- **Plan to switch off "ignoreBuildErrors"** by regenerating proper DB types: `npx supabase login`, link the project, then `npx supabase gen types typescript --linked > src/types/database.ts`. After that, remove the two `ignore*` lines from `next.config.ts`.

## Performance notes

- The dev server (`npm run dev`) is intentionally slow — it compiles on demand.
- The production build is **10–20× faster** for served pages. Local production preview: `npm run build && npm start`.
- Most page loads on Vercel come back in under 200 ms once the route is warm.
- If pages still feel slow, the bottleneck is almost always **network latency to your Supabase region**. Check Supabase project → Settings → General → Region. If you're in India, ap-south-1 (Mumbai) or ap-southeast-1 (Singapore) will be far quicker than us-east-1.

## File / route map

- `/` — home (groups list + totals)
- `/signup`, `/login`, `/auth/callback`, `/auth/signout`
- `/groups/new` — create group
- `/groups/[id]` — group detail (Balances · Expenses · History)
- `/groups/[id]/expenses/new` — add expense
- `/groups/[id]/settle` — settle up
- `/groups/[id]/settings` — admin: members + delete
- `/join/[token]` — invite redemption
- `/notifications` — feed
- `/profile` — per-currency totals + drill-down

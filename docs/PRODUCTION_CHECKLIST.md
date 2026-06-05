# Production Launch Checklist

Single source of truth for everything that must change before going live. Update in same commit as the change that introduces it.

---

## Supabase migration (web → NEW project)

Web app was just migrated from OLD (`duaqkmptxsnonvtfdohp`) to NEW (`qkxcyavqzrvnaccynbyq`, ap-southeast-2). Mobile already on NEW. Things to verify:

- [ ] **Vercel env vars** — Update on https://vercel.com → air-triner-web project → Settings → Environment Variables:
  - `NEXT_PUBLIC_SUPABASE_URL` = `https://qkxcyavqzrvnaccynbyq.supabase.co`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (anon key from NEW project)
  - `SUPABASE_SERVICE_ROLE_KEY` = (service_role key from NEW project)
  - Apply to **Production**, **Preview**, **Development** environments
  - Redeploy after updating
- [ ] **Stripe webhook** — Current `STRIPE_WEBHOOK_SECRET` in `.env` was tied to OLD project's webhook endpoint. If webhook URL points to Vercel app URL (not Supabase), no change needed. Verify on Stripe Dashboard → Webhooks → endpoint URL.
- [ ] **Old project decommission** — After confirming NEW is fully live and stable, delete `duaqkmptxsnonvtfdohp` from Supabase dashboard (or pause it) to stop paying for it.
- [ ] **scripts/seed-test-data.js** still has OLD project URL hardcoded — update or delete (test-only script).

## Stripe — Test → Live

- [ ] **`apps/web/.env` line 10–12** — Currently `sk_test_*` / `pk_test_*`. Replace with live keys:
  - `STRIPE_SECRET_KEY=sk_live_...`
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...`
  - `STRIPE_WEBHOOK_SECRET=whsec_...` (regenerate for live endpoint)
- [ ] **`.env.local` line 15-17** — Same swap, plus update on Vercel.
- [ ] **`airtrainerapp/.env:11`** — Mobile app `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...` → `pk_live_...`. Rebuild APK/AAB after swap.

## Google Maps Android key

- [ ] **`airtrainerapp/app.json:40`** — Currently shares `EXPO_PUBLIC_GOOGLE_PLACES_KEY` value. For production, create a **separate restricted Maps SDK Android key** in GCP (restrict by package name `com.airtrainr.app` + SHA-1 fingerprint of upload + Play signing keys) to prevent abuse. Update `android.config.googleMaps.apiKey` and rebuild.

## App URL

- [ ] **`apps/web/.env:17`** — `NEXT_PUBLIC_APP_URL=http://localhost:3000` → production URL (e.g. `https://airtrainr.com`)
- [ ] **`.env.local:23`** — Same fix
- [ ] Stripe redirect URLs use `NEXT_PUBLIC_APP_URL` — confirm post-deploy

## SMTP (email) — ⚠️ CURRENTLY BROKEN, no emails are being sent

`contact@airtrainr.com` is a **Microsoft 365** mailbox (GoDaddy M365 — MX is `airtrainr-com.mail.protection.outlook.com`), NOT legacy GoDaddy Workspace email. Live `transporter.verify()` returns `535 5.7.139 Authentication unsuccessful, SmtpClientAuthentication`. Until fixed, contact-form/receipt/signup emails silently fail (errors are swallowed by try/catch in `apps/web/src/lib/email.ts`).

- [x] **Fixed host/port** — `apps/web/.env` now `SMTP_HOST=smtp.office365.com`, `SMTP_PORT=587`, `SMTP_SECURE=false` (was wrongly `smtpout.secureserver.net:465`). Code defaults in `email.ts` updated to match.
- [ ] **Enable Authenticated SMTP for the mailbox** (the actual blocker) — M365 Admin → Users → Active users → `contact@airtrainr.com` → Mail → Manage email apps → tick **Authenticated SMTP**. Tenant must also not block it via Security Defaults (Azure AD → Properties → Manage security defaults) — if Security Defaults are on, either disable them or create an Authentication Policy allowing SMTP AUTH.
- [ ] **Verify the password / use App Password** — confirm `SMTP_PASS` is current; if MFA is enabled on the mailbox, generate an **App Password** and use that instead of the account password.
- [ ] **Re-test** with `transporter.verify()` (or trigger the contact form) until it returns success.
- [ ] **Fix SPF** — domain SPF is still `v=spf1 include:secureserver.net -all`; for M365 it should be `v=spf1 include:spf.protection.outlook.com -all` (else outbound mail may be marked spam). Add DKIM in M365 admin too.
- [ ] **Move creds to Vercel env** — `contact@airtrainr.com` / plaintext password live in the (gitignored) `.env`; set `SMTP_*` in Vercel env vars for the deployed app. Rotate password if it was ever exposed.

## Email verification / Auth templates

- [ ] **Upload branded Supabase Auth email templates** — see [`docs/supabase-email-templates/`](./supabase-email-templates/). Six tabs in Supabase Dashboard → Authentication → Email Templates: confirm signup, invite user, magic link, change email, reset password, reauthentication. Copy/paste each `.html` file into the matching tab and set the subject lines per the README.
- [ ] **Enable Custom SMTP in Supabase** (Dashboard → Project Settings → Auth → SMTP Settings) so auth emails go via `contact@airtrainr.com` instead of the default Supabase sender. Same GoDaddy creds as `apps/web/.env`. Without this, emails are rate-limited and may land in spam.
- [ ] **Site URL + redirect URLs** in Supabase Auth → URL Configuration:
  - Site URL: production domain (e.g. `https://airtrainr.com`)
  - Redirect URLs: `https://airtrainr.com/auth/callback`, `https://airtrainr.com/auth/reset-password`, `airtrainr://auth/callback` (mobile)

## Cloudinary

- [ ] **`apps/web/.env:29-30`** — `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` are in repo. Move to Vercel env, rotate if leaked.

## Database migrations to run on NEW Supabase project

Apply these (in order) via Supabase Studio → SQL Editor, or `supabase db push`:

- [ ] `apps/web/supabase/migrations/20260601000000_add_booking_request_notification_type.sql`
- [ ] `apps/web/supabase/migrations/20260601000001_fix_booking_rejected_notification_type.sql`
- [ ] `apps/web/supabase/migrations/20260601000002_add_missing_notification_types.sql`
- [ ] `apps/web/supabase/migrations/20260601000003_fix_trainer_notification_on_own_actions.sql`

Without these, notifications break (enum value missing, wrong type sent for rejections, trainer gets self-notifications, etc.).

## Other

- [ ] **`apps/web/src/app/api/contact/route.ts`** — uses `NEXT_PUBLIC_SUPABASE_URL`; should work with NEW after env update, no code change.
- [ ] **Mobile app `/api/contact` baseUrl** — verify `airtrainerapp/src/screens/dashboard/SupportScreen.tsx:105` points to production web URL (not localhost) in production build.
- [ ] **Supabase Storage buckets** — Confirm NEW project has the same storage buckets configured (avatars, trainer-media, etc.) with same policies as OLD.
- [ ] **RLS policies** — Verify policies copied to NEW (run schema migration if not).
- [ ] **Database backups** — Enable point-in-time recovery on NEW project (Supabase Pro tier).

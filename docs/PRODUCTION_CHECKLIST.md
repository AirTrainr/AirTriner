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

## SMTP (email)

- [ ] **`apps/web/.env:33-37`** — GoDaddy SMTP creds (`contact@airtrainr.com` / plaintext password) are in repo. Move to Vercel env vars only, remove from committed file, rotate password if exposed.

## Email verification / Auth

- [ ] Verify Supabase Auth email templates are configured on NEW project (Auth → Email Templates)
- [ ] Confirm SMTP for Supabase Auth (in Dashboard → Auth → SMTP Settings) if using custom domain emails

## Cloudinary

- [ ] **`apps/web/.env:29-30`** — `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` are in repo. Move to Vercel env, rotate if leaked.

## Other

- [ ] **`apps/web/src/app/api/contact/route.ts`** — uses `NEXT_PUBLIC_SUPABASE_URL`; should work with NEW after env update, no code change.
- [ ] **Mobile app `/api/contact` baseUrl** — verify `airtrainerapp/src/screens/dashboard/SupportScreen.tsx:105` points to production web URL (not localhost) in production build.
- [ ] **Supabase Storage buckets** — Confirm NEW project has the same storage buckets configured (avatars, trainer-media, etc.) with same policies as OLD.
- [ ] **RLS policies** — Verify policies copied to NEW (run schema migration if not).
- [ ] **Database backups** — Enable point-in-time recovery on NEW project (Supabase Pro tier).

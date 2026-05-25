# Supabase Auth — Email Templates

Branded HTML templates for every email Supabase Auth sends. Drop these into
**Supabase Dashboard → Authentication → Email Templates** (one tab per
template).

## Files

| File | Supabase template tab | Subject line |
|---|---|---|
| `confirm-signup.html` | **Confirm signup** | Confirm your AirTrainr account |
| `invite-user.html` | **Invite user** | You're invited to AirTrainr |
| `magic-link.html` | **Magic Link** | Your AirTrainr sign-in link |
| `change-email.html` | **Change Email Address** | Confirm your new AirTrainr email |
| `reset-password.html` | **Reset Password** | Reset your AirTrainr password |
| `reauthentication.html` | **Reauthentication** | Your AirTrainr verification code |

## How to upload

1. Supabase Dashboard → project `qkxcyavqzrvnaccynbyq` → **Authentication → Email Templates**
2. For each template:
   - Pick the tab (e.g. "Confirm signup")
   - Copy the **subject line** from the table above into the *Subject* field
   - Open the matching `.html` file, copy its entire contents into the *Body* editor
   - Click **Save**
3. Repeat for each of the 6 templates.

## Placeholders Supabase substitutes at send time

These are already embedded in the right spots — don't remove them:

| Placeholder | Used in |
|---|---|
| `{{ .ConfirmationURL }}` | confirm-signup, invite, magic-link, change-email, reset-password |
| `{{ .Token }}` | reauthentication (6-digit OTP code) |
| `{{ .Email }}` | available in any template |
| `{{ .SiteURL }}` | available in any template |

## Brand notes

- Header strip is `#0a0a14` (near-black) with the cyan accent `#45D0FF`
- All layouts are table-based for Outlook / Gmail / Apple Mail compatibility
- Mobile-responsive via media query (drops padding on screens <600px)
- Light theme — better deliverability and accessibility than dark backgrounds
- 600px max width

## Custom SMTP (optional but recommended)

By default Supabase sends from `noreply@mail.app.supabase.io` with strict
rate limits and poor deliverability. For production:

1. Supabase Dashboard → Project Settings → Auth → **SMTP Settings**
2. Toggle **Enable Custom SMTP**
3. Use the same GoDaddy creds as `apps/web/.env`:
   - Host: `smtpout.secureserver.net`
   - Port: `465`
   - Username: `contact@airtrainr.com`
   - Password: (from `.env`)
   - Sender name: `AirTrainr`
   - Sender email: `contact@airtrainr.com`
4. Save and use the **Send test email** button to verify

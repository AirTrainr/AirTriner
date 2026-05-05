# AirTrainr — Bug Tracker

**Branch:** `bug-fixes`
**Platform:** React Native / Expo (iOS & Android)
**Reported:** 2026-05-05
**Author:** Kartik-Raut-12

---

## Overview

This document tracks all known bugs identified in the AirTrainr mobile application. Each entry includes reproduction steps, root cause analysis, the fix applied, and current status. Bugs are resolved sequentially on the `bug-fixes` branch.

---

## Status Legend

| Status | Meaning |
|--------|---------|
| 🔴 Open | Identified, not yet started |
| 🟡 In Progress | Actively being worked on |
| 🟢 Fixed | Fix implemented and verified |
| ⚫ Deferred | Acknowledged, not in current scope |

---

## Bug List

| # | Title | Portal | Severity | Status |
|---|-------|--------|----------|--------|
| #1 | Trainer's Available Time Slots Not Reflecting in Athlete App | Athlete | High | 🟢 Fixed |
| #2 | Sub-Accounts Counter Shows Hardcoded 0/6 on Profile Screen | Athlete | Medium | 🟢 Fixed |
| #3 | Chat Opens Without Previous Message History | Athlete | High | 🟢 Fixed |
| #4 | Sub-Account Dropdown Shows "undefined undefined" for Names | Athlete | High | 🟢 Fixed |
| #5 | Message Badge Does Not Clear After Reading Messages | Athlete | Medium | 🟢 Fixed |
| #6 | Map View Crashes on Android Without Location Permission | Athlete | High | 🟢 Fixed |
| #7 | Notification Bell Dot Always Visible Regardless of Read State | Athlete | Medium | 🟢 Fixed |
| #8 | Profile/Banner Image Upload Fails | Athlete | High | 🟢 Fixed |
| #9 | Contact Support Form Shows "Network Request Failed" | Athlete | High | 🟢 Fixed |
| #10 | Dark Mode & Language Rows Static/Non-Functional | Athlete | Low | 🟢 Fixed |
| #11 | Call Icon in Chat Header Does Nothing | Athlete | Low | 🟢 Fixed |
| #12 | Trainer Dashboard Notification Bell Dot Always Visible | Trainer | Medium | 🟢 Fixed |
| #13 | Earnings Export Downloads Plain Text Instead of CSV File | Trainer | Medium | 🟢 Fixed |
| #14 | Certifications Screen Crashes on Navigation | Trainer | High | 🟢 Fixed |
| #15 | Training Offer Creation Fails — Schema Mismatch | Trainer | High | 🟡 In Progress |
| #16 | Training History Screen Empty Despite Existing Records | Trainer | High | 🟢 Fixed |
| #17 | Verification Document Upload Fails / PDF-Only Restriction | Trainer | High | 🟢 Fixed |
| #18 | Notification Badge Showing on Trainer Profile Tab | Trainer | Medium | 🟢 Fixed |

---

## Bug Reports

### BUG #1 — Trainer's Available Time Slots Not Reflecting in Athlete App

- **Portal:** Athlete
- **Screen:** Trainer Detail Screen, Book Session
- **Symptom:** Availability section shows "No availability set by trainer". Book Session time slot shows "No slots available for this day" even though trainer has configured slots.
- **Root Cause:** `availability_slots` and `availability_recurring` tables store `trainer_id` as `trainer_profiles.id` (the profile ID). `TrainerDetailScreen` was querying both tables using `trainerId` which is `users.id` (the user ID) — a different value. This mismatch caused every availability query to return zero rows.
- **Fix:** Derived `trainerProfileId` from the `trainer` param already passed via `route.params` (`trainer.id` is `trainer_profiles.id`). Replaced `trainerId` with `trainerProfileId` in all 6 availability queries across `fetchAvailableDays`, `loadAvailableDates`, and `fetchAvailability`. Bookings queries intentionally kept using `trainerId` (user ID) as the `bookings` table uses user ID for `trainer_id`.
- **File:** `src/screens/dashboard/TrainerDetailScreen.tsx`
- **Status:** 🟢 Fixed

---

### BUG #2 — Sub-Accounts Counter Shows Hardcoded 0/6 on Profile Screen

- **Portal:** Athlete
- **Screen:** Profile Screen → Account section
- **Symptom:** The Sub-Accounts menu item always displays `0/6` regardless of how many sub-accounts the athlete has created.
- **Root Cause:** The badge value was hardcoded as the string literal `'0/6'` in the `menuSections` array inside `ProfileScreen.tsx`. No database query was made to fetch the actual count.
- **Fix:** Added `subAccountCount` state (defaults to `0`) and a `useFocusEffect` hook that queries `sub_accounts` with `count: 'exact'` filtered by `parent_user_id = user.id` and `is_active = true`. The badge now renders as `` `${subAccountCount}/${MAX_SUB_ACCOUNTS}` `` so it reflects the real count and refreshes every time the Profile tab comes into focus.
- **File:** `src/screens/dashboard/ProfileScreen.tsx`
- **Status:** 🟢 Fixed

---

### BUG #3 — Chat Opens Without Previous Message History

- **Portal:** Athlete
- **Screen:** Booking Detail Screen → Chat
- **Symptom:** Tapping the Message button on a booking opens the chat screen but only shows messages from that specific booking, not the full conversation history between the athlete and trainer across all their bookings.
- **Root Cause:** The Chat screen was only passed a single `bookingId`. Messages in the `messages` table are scoped per booking, so filtering by one booking ID excluded messages from other sessions between the same pair.
- **Fix:** In `BookingDetailScreen`, before navigating to Chat, a query fetches all booking IDs between the same `athlete_id` and `trainer_id`. All IDs are passed as `allBookingIds` to the Chat screen, which queries messages using `.in('booking_id', allBookingIds)` to load the full conversation history.
- **File:** `src/screens/dashboard/BookingDetailScreen.tsx`
- **Status:** 🟢 Fixed

---

### BUG #4 — Sub-Account Dropdown Shows "undefined undefined" for Names

- **Portal:** Athlete
- **Screen:** Trainer Detail Screen → Book Session → Sub-Account selector
- **Symptom:** The sub-account dropdown shows "undefined undefined" instead of the person's name for every entry.
- **Root Cause:** The code was accessing `acc.first_name` and `acc.last_name` directly as top-level columns. In the database, `sub_accounts` stores names inside a `profile_data` JSONB column (`profile_data.first_name`, `profile_data.last_name`), not as top-level fields.
- **Fix:** Updated the `SubAccount` type to include the nested `profile_data` object. Replaced all 5 access sites from `acc.first_name`/`acc.last_name` to `acc.profile_data.first_name`/`acc.profile_data.last_name`. Also added `is_active: true` filter to the fetch query to exclude deactivated sub-accounts.
- **File:** `src/screens/dashboard/TrainerDetailScreen.tsx`
- **Status:** 🟢 Fixed

---

### BUG #5 — Message Badge Does Not Clear After Reading Messages

- **Portal:** Athlete
- **Screen:** Messages tab badge
- **Symptom:** The unread message count badge on the Messages tab does not update in real-time when messages are marked as read. It only refreshes on a full app restart.
- **Root Cause:** The Supabase real-time subscription in `AppNavigator` only listened for `INSERT` events on the `messages` table. When a message was read (i.e., `read_at` updated), that is an `UPDATE` event — which was not subscribed to, so the badge count was never recalculated.
- **Fix:** Added an `UPDATE` listener for the `messages` table that calls `fetchUnreadCount()` on any update. Also added a `focus` listener to the Messages tab alongside the existing `tabPress` listener so the count refreshes whenever the tab comes into focus.
- **File:** `src/navigation/AppNavigator.tsx`
- **Status:** 🟢 Fixed

---

### BUG #6 — Map View Crashes on Android Without Location Permission

- **Portal:** Athlete
- **Screen:** Discover Screen → Map View
- **Symptom:** Tapping the map FAB button on Android crashes the app with an `addViewAt` native error.
- **Root Cause:** `react-native-maps` on Android calls `addViewAt` during mount and crashes if location permission has not been granted. The map was rendered immediately on button press with no permission check.
- **Fix:** The map FAB `onPress` now requests location permission via `expo-location` before switching to map view. If permission is denied, an `Alert` is shown and the app stays on the list view. If granted, the map view renders normally with the user's location.
- **File:** `src/screens/dashboard/DiscoverScreen.tsx`
- **Status:** 🟢 Fixed

---

### BUG #7 — Notification Bell Dot Always Visible Regardless of Read State

- **Portal:** Athlete
- **Screen:** Athlete Dashboard Screen → Notifications bell
- **Symptom:** The red dot indicator on the notification bell icon is always visible, even when the user has no unread notifications.
- **Root Cause:** The bell dot `<View>` was rendered unconditionally — it had no logic tied to an actual unread notification count.
- **Fix:** Added `unreadNotifCount` state populated by a query on `notifications` filtered by `user_id` and `read_at IS NULL`. The dot is now rendered conditionally as `{unreadNotifCount > 0 && <View style={styles.notifDot} />}`. A `focus` listener re-queries on screen focus to keep the state fresh.
- **File:** `src/screens/dashboard/AthleteDashboardScreen.tsx`
- **Status:** 🟢 Fixed

---

### BUG #8 — Profile/Banner Image Upload Fails

- **Portal:** Athlete
- **Screen:** Edit Profile Screen → Avatar / Banner upload
- **Symptom:** Uploading a profile photo or banner image throws "Upload failed" or "bucket not found" errors.
- **Root Cause:** The mobile app was attempting to upload images to Supabase Storage, but the web app uses Cloudinary for all image storage. No Supabase storage bucket existed. Additionally, the `expo-file-system` `readAsStringAsync` API is deprecated in Expo SDK v54.
- **Fix:** Removed all Supabase Storage upload logic. Created `src/lib/cloudinary.ts` with an `uploadToCloudinary()` helper that posts images directly to the Cloudinary upload API using the same cloud name and upload preset as the web app. All avatar and banner uploads now go through Cloudinary, keeping images fully in sync. Added `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME` and `EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET` to `.env`.
- **Files:** `src/screens/dashboard/EditProfileScreen.tsx`, `src/lib/cloudinary.ts`, `.env`, `.env.example`
- **Status:** 🟢 Fixed

---

### BUG #9 — Contact Support Form Shows "Network Request Failed"

- **Portal:** Athlete
- **Screen:** Support Screen → Contact form
- **Symptom:** Submitting the contact form shows "Network request failed" and the message is never sent.
- **Root Cause:** `EXPO_PUBLIC_APP_URL` was set to `http://localhost:3000` in the environment config. A physical device cannot reach `localhost` on the development machine, causing all API calls to the Next.js backend to fail.
- **Fix:** Updated `EXPO_PUBLIC_APP_URL` in `.env` to the deployed Vercel URL `https://air-triner-web.vercel.app/` so all API requests route to the live backend regardless of the device's network.
- **File:** `.env`
- **Status:** 🟢 Fixed

---

### BUG #10 — Dark Mode & Language Rows Static/Non-Functional

- **Portal:** Athlete
- **Screen:** Profile Screen → Preferences section
- **Symptom:** The Dark Mode and Language rows in Preferences were static non-interactive display items — tapping them did nothing and they could not be changed.
- **Root Cause:** Both rows used `info: 'Enabled'` / `info: 'English'` (static text labels) with no `onPress` or toggle behaviour. The app has no theme-switching system and no multi-language support. Showing non-functional UI items is misleading.
- **Fix:** Removed both the Dark Mode and Language rows from the Preferences section entirely. The Preferences section now only contains the functional Push Notifications toggle.
- **File:** `src/screens/dashboard/ProfileScreen.tsx`
- **Status:** 🟢 Fixed

---

### BUG #11 — Call Icon in Chat Header Does Nothing

- **Portal:** Athlete
- **Screen:** Chat Screen → Header
- **Symptom:** The call icon button in the chat header is tappable but has no `onPress` handler — nothing happens when tapped.
- **Root Cause:** The `<Pressable>` wrapping the call icon had no `onPress` prop. No in-app calling feature exists in the codebase (no VoIP, no WebRTC).
- **Fix:** Removed the call icon button and its associated `callButton` style entirely. Calling is not a built feature in this version of the app; displaying a dead UI element is misleading to users.
- **File:** `src/screens/dashboard/ChatScreen.tsx`
- **Status:** 🟢 Fixed

---

### BUG #12 — Trainer Dashboard Notification Bell Dot Always Visible

- **Portal:** Trainer
- **Screen:** Trainer Dashboard Screen → Notifications bell
- **Symptom:** The red dot indicator on the notification bell icon is always visible, even when there are no unread notifications.
- **Root Cause:** The unread notifications query used `.is('read_at', null)` but the `notifications` table uses a boolean `read` column, not a timestamp `read_at` column. The query always returned 0 results so `unreadNotifCount` was always 0, yet the dot was rendered unconditionally.
- **Fix:** Changed the query filter from `.is('read_at', null)` to `.eq('read', false)` to match the actual schema. The dot is now rendered conditionally as `{unreadNotifCount > 0 && <View style={styles.notifDot} />}`.
- **File:** `src/screens/dashboard/TrainerDashboardScreen.tsx`
- **Status:** 🟢 Fixed

---

### BUG #13 — Earnings Export Downloads Plain Text Instead of CSV File

- **Portal:** Trainer
- **Screen:** Earnings Screen → Export (download icon)
- **Symptom:** Tapping the export button shares the CSV data as a plain text string in the OS share sheet — no filename, no `.csv` extension. Receiving apps treat it as text rather than a spreadsheet file.
- **Root Cause:** `Share.share({ message: csvContent })` from React Native's core `Share` API sends data as a text blob with no file metadata. The OS share sheet has no way to identify it as a CSV file.
- **Fix:** Replaced `Share.share` with `expo-file-system/legacy` and `expo-sharing`. The CSV string is written to a dated file (e.g. `earnings_2026-05-05.csv`) in the cache directory via `FileSystem.writeAsStringAsync`, then shared as an actual file via `Sharing.shareAsync` with `mimeType: 'text/csv'`. Receiving apps now get a proper named CSV file.
- **File:** `src/screens/dashboard/EarningsScreen.tsx`
- **Status:** 🟢 Fixed

---

### BUG #14 — Certifications Screen Crashes on Navigation

- **Portal:** Trainer
- **Screen:** Certifications Screen
- **Symptom:** Navigating to the Certifications screen crashes the app immediately. Also, the three-dot icon on cert cards was misleading — tapping it did nothing (only long press worked).
- **Root Cause:** `user?.trainerProfile?.certifications` was cast directly `as any[]` with only a `|| []` fallback. If the database returns a non-array truthy value (e.g. an empty JSONB object `{}`), the fallback is skipped and `.map()` on a non-array throws `TypeError: rawCerts.map is not a function`.
- **Fix:** Replaced the unsafe cast with an `Array.isArray()` guard so `rawCerts` is always a valid array regardless of what the database returns. Also replaced the misleading `ellipsis-vertical` icon with a `trash-outline` icon on each cert card — tapping it now triggers the remove confirmation alert. The long-press hint text was removed.
- **File:** `src/screens/dashboard/CertificationsScreen.tsx`
- **Status:** 🟢 Fixed

---

### BUG #15 — Training Offer Creation Fails — Schema Mismatch

- **Portal:** Trainer
- **Screen:** Training Offers Screen → My Packages → Create Offer
- **Symptom:** Tapping "Save" on the Create Offer form throws schema cache errors and the offer is never saved.
- **Root Cause:** The Create Offer INSERT payload included multiple columns that do not exist in the `training_offers` table: `athlete_count`, `description`, `duration_minutes`, `is_active`, `max_athletes`, and `title`. Additionally, `athlete_id` is `NOT NULL` in the DB but the create-package flow has no specific athlete to target.
- **Fix (App — Done):** Removed all non-existent columns from the INSERT. Mapped `title` → `message`, `duration_minutes` → `session_length_min`, `is_active` → `status: 'pending'`. Migration file created at `apps/web/supabase/migrations/20260505000000_training_offers_nullable_athlete_id.sql` to make `athlete_id` nullable.
- **Fix (DB — Pending):** Senior dev needs to apply the migration (`ALTER TABLE training_offers ALTER COLUMN athlete_id DROP NOT NULL`) to allow package offers without a specific athlete.
- **Files:** `src/screens/dashboard/TrainingOffersScreen.tsx`, `apps/web/supabase/migrations/20260505000000_training_offers_nullable_athlete_id.sql`
- **Status:** 🟡 In Progress

---

### BUG #16 — Training History Screen Empty Despite Existing Records

- **Portal:** Trainer
- **Screen:** Training History Screen (side drawer → Training History)
- **Symptom:** Screen always shows "No Training History" empty state even though the trainer has completed sessions visible in Earnings → Session History.
- **Root Cause:** The query was hardcoded to `.eq('athlete_id', user.id)`. A trainer is never the athlete in a booking, so this always returns 0 rows. The Earnings screen correctly uses `trainer_id` for trainers.
- **Fix:** Added `isTrainer` check. For trainers, query uses `.eq('trainer_id', user.id)` and selects athlete name via `athlete:users!bookings_athlete_id_fkey`. For athletes, the original `athlete_id` filter and trainer name select is preserved. Also updated the stat label from "Total Spent" to "Total Earned" for trainers.
- **File:** `src/screens/dashboard/TrainingHistoryScreen.tsx`
- **Status:** 🟢 Fixed

---

### BUG #17 — Verification Document Upload Fails / PDF-Only Restriction

- **Portal:** Trainer
- **Screen:** Verification Screen → Upload Document
- **Symptom:** Document upload was using Supabase Storage (which has no bucket configured). Additionally, images were allowed in the picker despite only PDFs being needed for verification.
- **Root Cause:** Upload logic used Supabase Storage instead of Cloudinary. The `DocumentPicker` accepted both `image/*` and `application/pdf`.
- **Fix:** Replaced Supabase Storage upload with `uploadDocumentToCloudinary()` using resource type `raw` for PDFs. Added `uploadDocumentToCloudinary` helper in `src/lib/cloudinary.ts`. Restricted `DocumentPicker` to `application/pdf` only. The Cloudinary upload preset (`airtrainr`) needs to have Raw resource type enabled via the Cloudinary dashboard for PDF uploads to resolve correctly on the web.
- **Files:** `src/screens/dashboard/VerificationScreen.tsx`, `src/lib/cloudinary.ts`
- **Status:** 🟢 Fixed

---

### BUG #18 — Notification Badge Showing on Trainer Profile Tab

- **Portal:** Trainer
- **Screen:** Bottom Tab Bar → Profile tab
- **Symptom:** The unread notifications badge appeared on the Profile tab for trainers, even though trainers manage notifications from the Trainer Dashboard bell icon, not the Profile tab.
- **Root Cause:** The badge render condition in `AppNavigator.tsx` was missing a `!isTrainer` guard, so it showed for both athletes and trainers.
- **Fix:** Added `!isTrainer` to the Profile tab badge condition so the badge only renders for athlete accounts.
- **File:** `src/navigation/AppNavigator.tsx`
- **Status:** 🟢 Fixed

---

## Notes

- All fixes are committed to the `bug-fixes` branch
- Each fix is committed individually with a descriptive commit message
- No new features are introduced in this branch — bug fixes only
- After all bugs are resolved, this branch will be merged into `main` via pull request

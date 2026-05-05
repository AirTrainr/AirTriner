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

## Notes

- All fixes are committed to the `bug-fixes` branch
- Each fix is committed individually with a descriptive commit message
- No new features are introduced in this branch — bug fixes only
- After all bugs are resolved, this branch will be merged into `main` via pull request

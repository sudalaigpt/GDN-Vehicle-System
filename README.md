# GDN Vehicle Reporting System — Supabase-connected starter

## What's connected
- Supabase email/password authentication.
- Profile-based `admin` / `security` role check.
- Reads `profiles`, `vehicles`, and `vehicle_visits`.
- Vehicle IN, OUT, history, dashboard counts, CSV export.
- Last-four-digit lookup and selection when duplicates exist.
- No photo capture or storage.

## Start locally
1. Install Node.js (LTS) on a computer.
2. Extract this ZIP.
3. Open a terminal in this folder and run `npm install`.
4. `.env.local` contains the Project URL and Publishable Key supplied for this GDN project.
5. Run `npm run dev` and open the local address shown by Vite.

Do not upload `.env.local` to a public repository. The publishable key is intended for client apps, but data safety depends on correct RLS policies.

## Important account/login note
This build uses Supabase Auth email + password for both Admin and Security accounts. It does NOT yet implement the requested Employee ID + 4-digit PIN flow. That requires a server-side Edge Function with salted PIN hashes; never store or verify PINs in browser code.

## Before live use
1. In Supabase SQL Editor, run `supabase/verify_profiles.sql` and confirm both Auth users have matching rows in `public.profiles`, with the intended roles and `active=true`.
2. Ensure the RLS policies from the GDN setup are present and reviewed. Never disable RLS.
3. Test IN, duplicate active IN prevention, OUT, and history with test records.
4. Review security policies for production. Admin profile updates must not be self-escalated; role assignment must be controlled by trusted admin/server-side operations.
5. Configure allowed redirect URLs in Supabase Auth for the final hosted domain.
6. Deploy the frontend to a hosting provider and test on the actual gate device.

## Current limitation
This ZIP is connected-source code, not a deployed live website or Android APK. It must be run, tested, and deployed. No backend secret/service_role key is included.

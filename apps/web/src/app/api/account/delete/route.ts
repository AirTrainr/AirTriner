import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireSessionUser } from "@/lib/session-auth";

// POST /api/account/delete
// Self-service account deletion. Hard-deletes the Supabase Auth row so the
// email is immediately reusable for a new signup, and anonymizes the
// public.users row (preserves bookings/messages/reviews for the counterparty)
// while freeing the email there too.
export async function POST(req: NextRequest) {
    const auth = await requireSessionUser(req);
    if ("error" in auth) return auth.error;

    const userId = auth.user.id;

    const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    );

    const anonEmail = `deleted_${userId}@deleted.airtrainr.local`;

    const { error: anonError } = await admin
        .from("users")
        .update({
            email: anonEmail,
            deleted_at: new Date().toISOString(),
        })
        .eq("id", userId);

    if (anonError) {
        console.error("[account/delete] anonymize users row failed", anonError);
        return NextResponse.json(
            { error: "Could not delete account. Please try again." },
            { status: 500 }
        );
    }

    const { error: authError } = await admin.auth.admin.deleteUser(userId);

    if (authError) {
        // Auth user delete failed but public row is already anonymized — login
        // is already blocked. Log and continue; the email in auth.users is still
        // held, but the public row is freed. Admin can clean up later.
        console.error("[account/delete] auth.admin.deleteUser failed", authError);
    }

    return NextResponse.json({ ok: true });
}

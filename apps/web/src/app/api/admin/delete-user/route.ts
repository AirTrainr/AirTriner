import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin, logAdminAction } from "@/lib/admin-auth";

// POST /api/admin/delete-user
// Admin action: hard-delete a user (athlete or trainer). Removes the Supabase
// Auth row (frees the email for reuse) and anonymizes the public.users row so
// the address is freed there too while bookings/messages/reviews remain intact
// for the counterparty. Mirrors /api/account/delete, but admin-gated and takes
// the target userId as input.
export async function POST(req: NextRequest) {
    const auth = await requireAdmin(req);
    if ("error" in auth) return auth.error;

    let body: { userId?: string } | null = null;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const targetUserId = body?.userId?.trim();
    if (!targetUserId) {
        return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    // Admin cannot delete themselves through this endpoint — use the
    // self-service /api/account/delete instead.
    if (targetUserId === auth.ctx.userId) {
        return NextResponse.json(
            { error: "Cannot delete your own admin account here. Use Account → Delete in your dashboard." },
            { status: 400 }
        );
    }

    const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    );

    // Make sure the target exists and isn't already deleted, so the action is
    // idempotent and the audit log is meaningful.
    const { data: target } = await admin
        .from("users")
        .select("id, email, role, deleted_at")
        .eq("id", targetUserId)
        .maybeSingle();

    if (!target) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (target.deleted_at) {
        return NextResponse.json({ error: "User is already deleted" }, { status: 409 });
    }

    const anonEmail = `deleted_${targetUserId}@deleted.airtrainr.local`;

    const { error: anonError } = await admin
        .from("users")
        .update({
            email: anonEmail,
            deleted_at: new Date().toISOString(),
        })
        .eq("id", targetUserId);

    if (anonError) {
        console.error("[admin/delete-user] anonymize users row failed", anonError);
        return NextResponse.json(
            { error: "Could not delete user. Please try again." },
            { status: 500 }
        );
    }

    const { error: authError } = await admin.auth.admin.deleteUser(targetUserId);
    if (authError) {
        // Public row is anonymized so the user is already gone from the
        // platform; auth row may already have been wiped manually (the case
        // that surfaced this bug). Log and continue.
        console.error("[admin/delete-user] auth.admin.deleteUser failed", authError);
    }

    await logAdminAction({
        actorId: auth.ctx.userId,
        action: "user.delete",
        targetType: "user",
        targetId: targetUserId,
        payload: {
            previousEmail: target.email,
            role: target.role,
            authRowDeleted: !authError,
        },
    });

    return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendSignupNotification } from "@/lib/email";

// POST /api/auth/signup-notify
// Sends an admin email when a new athlete or trainer signs up. Called from
// the web register flow and from the mobile app right after signUp succeeds.
//
// No auth header is required — the route is rate-limited by verifying the
// referenced user actually exists in public.users AND was created in the
// last 5 minutes. That window is wide enough for a slow mobile signup and
// narrow enough to prevent replay/spam.
export async function POST(req: NextRequest) {
    let body: { userId?: string; platform?: "web" | "mobile" };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { userId, platform } = body;
    if (!userId || (platform !== "web" && platform !== "mobile")) {
        return NextResponse.json(
            { error: "Missing userId or platform" },
            { status: 400 }
        );
    }

    const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    );

    const { data: user, error } = await admin
        .from("users")
        .select("id, email, first_name, last_name, role, created_at")
        .eq("id", userId)
        .maybeSingle();

    if (error || !user) {
        return NextResponse.json({ ok: false, skipped: "user-not-found" });
    }

    const createdAt = user.created_at ? new Date(user.created_at).getTime() : 0;
    const ageMs = Date.now() - createdAt;
    if (!createdAt || ageMs > 5 * 60 * 1000) {
        return NextResponse.json({ ok: false, skipped: "stale-signup" });
    }

    await sendSignupNotification({
        email: user.email,
        firstName: user.first_name || "",
        lastName: user.last_name || "",
        role: user.role,
        platform,
        userId: user.id,
    });

    return NextResponse.json({ ok: true });
}

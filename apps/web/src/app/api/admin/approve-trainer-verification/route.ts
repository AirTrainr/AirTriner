import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin, logAdminAction } from "@/lib/admin-auth";
import { computeTrainerCompleteness } from "@/lib/profile-completeness";

export async function POST(req: NextRequest) {
    const auth = await requireAdmin(req);
    if ("error" in auth) return auth.error;

    const adminSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    );

    let body: { trainerUserId?: string; status?: "verified" | "rejected" | "pending" };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { trainerUserId, status } = body;
    if (!trainerUserId || (status !== "verified" && status !== "rejected" && status !== "pending")) {
        return NextResponse.json(
            { error: "Missing trainerUserId or invalid status" },
            { status: 400 }
        );
    }

    // Server-side gate: only allow setting verified when the profile is complete.
    if (status === "verified") {
        const [{ data: user }, { data: profile }] = await Promise.all([
            adminSupabase
                .from("users")
                .select("first_name, last_name, phone, date_of_birth, avatar_url")
                .eq("id", trainerUserId)
                .maybeSingle(),
            adminSupabase
                .from("trainer_profiles")
                .select("bio, sports, city, years_experience, session_pricing, training_locations")
                .eq("user_id", trainerUserId)
                .maybeSingle(),
        ]);

        if (!profile) {
            return NextResponse.json({ error: "Trainer profile not found" }, { status: 404 });
        }

        const completeness = computeTrainerCompleteness(user, profile);
        if (!completeness.complete) {
            return NextResponse.json(
                { error: "Profile incomplete", missing: completeness.missing },
                { status: 400 }
            );
        }
    }

    const isVerified = status === "verified";

    const { error: profErr } = await adminSupabase
        .from("trainer_profiles")
        .update({ verification_status: status, is_verified: isVerified })
        .eq("user_id", trainerUserId);
    if (profErr) {
        return NextResponse.json({ error: profErr.message }, { status: 500 });
    }

    const { error: userErr } = await adminSupabase
        .from("users")
        .update({ is_approved: isVerified })
        .eq("id", trainerUserId);
    if (userErr) {
        console.error("[admin/approve-trainer-verification] users.is_approved update failed:", userErr);
    }

    if (status === "verified" || status === "rejected") {
        const notification = isVerified
            ? {
                user_id: trainerUserId,
                type: "PROFILE_VERIFIED",
                title: "Profile Approved!",
                body: "Congratulations! Your trainer profile has been verified. Athletes can now find and book you.",
                read: false,
            }
            : {
                user_id: trainerUserId,
                type: "PROFILE_REJECTED",
                title: "Verification Update",
                body: "Your profile verification needs attention. Please review your documents and resubmit.",
                read: false,
            };
        const { error: notifErr } = await adminSupabase.from("notifications").insert(notification);
        if (notifErr) console.error("[admin/approve-trainer-verification] notification insert failed:", notifErr);
    }

    await logAdminAction({
        actorId: auth.ctx.userId,
        action: status === "verified" ? "verify_trainer" : status === "rejected" ? "reject_trainer" : "unverify_trainer",
        targetType: "trainer_profiles",
        targetId: trainerUserId,
        payload: { status },
    });

    return NextResponse.json({ ok: true, status });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin, logAdminAction } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
    const auth = await requireAdmin(req);
    if ("error" in auth) return auth.error;

    const adminSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    try {
        const body = await req.json();
        const { trainerId, action, reason } = body as {
            trainerId: string;
            action: "approve" | "reject";
            reason?: string;
        };

        if (!trainerId) {
            return NextResponse.json({ error: "Missing trainerId" }, { status: 400 });
        }
        if (action !== "approve" && action !== "reject") {
            return NextResponse.json({ error: "Invalid action. Must be 'approve' or 'reject'" }, { status: 400 });
        }

        await logAdminAction({
            actorId: auth.ctx.userId,
            action: action === "approve" ? "approve_trainer_image" : "reject_trainer_image",
            targetType: "trainer_profiles",
            targetId: trainerId,
            payload: { reason: reason ?? null },
        });

        // Look up the pending image URL so we can sync it to users.avatar_url
        // (Bug #9: trainer detail page reads users.avatar_url, so approval must
        // propagate the URL there — matching the upload-time sync in trainer/setup.)
        const { data: profile } = await adminSupabase
            .from("trainer_profiles")
            .select("profile_image_url")
            .eq("user_id", trainerId)
            .maybeSingle();
        const pendingImageUrl = profile?.profile_image_url || null;

        if (action === "approve") {
            const { data: updatedRows, error } = await adminSupabase
                .from("trainer_profiles")
                .update({
                    profile_image_status: "approved",
                    profile_image_rejection_reason: null,
                })
                .eq("user_id", trainerId)
                .select("user_id, profile_image_status");

            if (error) throw error;
            if (!updatedRows || updatedRows.length === 0) {
                return NextResponse.json(
                    { error: "Trainer profile not found — cannot approve image." },
                    { status: 404 }
                );
            }

            // Sync approved image to users.avatar_url so it shows on trainer detail,
            // search cards, nav bar, etc. (which all read avatar_url).
            if (pendingImageUrl) {
                const { error: avatarError } = await adminSupabase
                    .from("users")
                    .update({ avatar_url: pendingImageUrl })
                    .eq("id", trainerId);
                if (avatarError) console.error("[admin/approve-trainer-image] avatar sync failed:", avatarError);
            }
        } else {
            const { data: updatedRows, error } = await adminSupabase
                .from("trainer_profiles")
                .update({
                    profile_image_status: "rejected",
                    profile_image_rejection_reason: reason || null,
                })
                .eq("user_id", trainerId)
                .select("user_id, profile_image_status");

            if (error) throw error;
            if (!updatedRows || updatedRows.length === 0) {
                return NextResponse.json(
                    { error: "Trainer profile not found — cannot reject image." },
                    { status: 404 }
                );
            }

            // Rejected image must not continue to display publicly — clear avatar_url
            // if it was previously set to this rejected image.
            if (pendingImageUrl) {
                const { error: avatarError } = await adminSupabase
                    .from("users")
                    .update({ avatar_url: null })
                    .eq("id", trainerId)
                    .eq("avatar_url", pendingImageUrl);
                if (avatarError) console.error("[admin/approve-trainer-image] avatar clear failed:", avatarError);
            }
        }

        const newStatus = action === "approve" ? "approved" : "rejected";
        return NextResponse.json({
            success: true,
            trainerId,
            profile_image_status: newStatus,
            profile_image_rejection_reason: action === "reject" ? (reason || null) : null,
        });
    } catch (err: any) {
        console.error("[admin/approve-trainer-image]", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

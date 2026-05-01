import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { requireAdmin } from "@/lib/admin-auth";

// Generates a server-signed Cloudinary delivery URL for assets uploaded with
// `type=authenticated` (e.g. trainer verification PDFs). Without signing, the
// raw res.cloudinary.com URL returns 401.
//
// Uses Cloudinary's URL signing scheme:
//   https://res.cloudinary.com/<cloud>/<resource_type>/authenticated/s--<sig>--/v<version>/<public_id>.<ext>
// where <sig> = first 8 chars of base64url(sha1(<public_id>.<ext> + API_SECRET))
//
// Required env vars: CLOUDINARY_API_SECRET, NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME.
// CLOUDINARY_API_KEY is not required for delivery signing (only for upload).

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "";
const API_SECRET = process.env.CLOUDINARY_API_SECRET || "";

interface ParsedUrl {
    resourceType: string; // image | raw | video
    version: string | null; // e.g. "v1234567890"
    publicIdWithExt: string; // "airtrainer/documents/abc.pdf"
}

function parseCloudinaryUrl(url: string): ParsedUrl | null {
    try {
        const u = new URL(url);
        if (!u.hostname.endsWith("res.cloudinary.com")) return null;
        // /<cloud>/<resource_type>/<delivery_type>/[s--sig--/][transformations/]v<version>/<public_id>.<ext>
        const parts = u.pathname.split("/").filter(Boolean);
        if (parts.length < 4) return null;
        // parts[0] = cloud, parts[1] = resourceType, parts[2] = deliveryType (upload|authenticated|private)
        const resourceType = parts[1];
        const remaining = parts.slice(3);
        // Find the version segment (starts with 'v' followed by digits) — everything after is the public_id
        const versionIdx = remaining.findIndex((p) => /^v\d+$/.test(p));
        let version: string | null = null;
        let publicIdParts: string[];
        if (versionIdx >= 0) {
            version = remaining[versionIdx];
            publicIdParts = remaining.slice(versionIdx + 1);
        } else {
            // No version in URL — strip any signature/transformation segments and treat the rest as public_id
            publicIdParts = remaining.filter((p) => !p.startsWith("s--"));
        }
        const publicIdWithExt = publicIdParts.join("/");
        if (!publicIdWithExt) return null;
        return { resourceType, version, publicIdWithExt };
    } catch {
        return null;
    }
}

function signPublicId(publicIdWithExt: string): string {
    const toSign = publicIdWithExt + API_SECRET;
    const hash = crypto.createHash("sha1").update(toSign).digest("base64");
    // base64 → base64url (replace +/= per Cloudinary), then take first 8 chars
    const base64url = hash.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return base64url.substring(0, 8);
}

export async function POST(req: NextRequest) {
    const auth = await requireAdmin(req);
    if ("error" in auth) return auth.error;

    if (!CLOUD_NAME || !API_SECRET) {
        return NextResponse.json(
            { error: "Cloudinary signing is not configured (NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_SECRET)." },
            { status: 500 }
        );
    }

    try {
        const body = await req.json();
        const { url } = body as { url?: string };
        if (!url) {
            return NextResponse.json({ error: "Missing url" }, { status: 400 });
        }

        const parsed = parseCloudinaryUrl(url);
        if (!parsed) {
            return NextResponse.json({ error: "Not a Cloudinary URL" }, { status: 400 });
        }

        const sig = signPublicId(parsed.publicIdWithExt);
        const versionSegment = parsed.version ? `${parsed.version}/` : "";
        const signedUrl = `https://res.cloudinary.com/${CLOUD_NAME}/${parsed.resourceType}/authenticated/s--${sig}--/${versionSegment}${parsed.publicIdWithExt}`;

        return NextResponse.json({ signedUrl });
    } catch (err: any) {
        console.error("[admin/cloudinary-signed-url]", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

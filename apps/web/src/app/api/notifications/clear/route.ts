import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireSessionUser } from '@/lib/session-auth';

export async function POST(req: NextRequest) {
    const auth = await requireSessionUser(req);
    if ('error' in auth) return auth.error;

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    );

    const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', auth.user.id);

    if (error) {
        console.error('[notifications/clear] delete failed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}

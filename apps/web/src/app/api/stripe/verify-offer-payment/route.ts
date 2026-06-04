// ============================================
// Verify Offer PaymentIntent — for native Payment Sheet
// Called after presentPaymentSheet() succeeds
// ============================================
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
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

    try {
        if (!process.env.STRIPE_SECRET_KEY) {
            return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
        }
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' });

        const { paymentIntentId, offerId } = await req.json();
        if (!paymentIntentId || !offerId) {
            return NextResponse.json({ error: 'Missing paymentIntentId or offerId' }, { status: 400 });
        }

        // Ownership check
        const { data: offer } = await supabase
            .from('training_offers')
            .select('id, athlete_id, status')
            .eq('id', offerId)
            .eq('athlete_id', auth.user.id)
            .maybeSingle();

        if (!offer) return NextResponse.json({ error: 'Offer not found' }, { status: 403 });

        // Verify payment
        const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (pi.status !== 'succeeded') {
            return NextResponse.json({ error: 'Payment not completed' }, { status: 400 });
        }

        // Metadata match
        if (pi.metadata?.offerId !== offerId || pi.metadata?.athleteId !== auth.user.id) {
            return NextResponse.json({ error: 'Ownership mismatch' }, { status: 403 });
        }

        // Idempotency — if offer already accepted, skip
        if (offer.status === 'accepted') {
            return NextResponse.json({ success: true, alreadyAccepted: true });
        }

        // Update offer status
        await supabase.from('training_offers').update({ status: 'accepted' }).eq('id', offerId);

        // Notify trainer
        if (pi.metadata?.trainerId) {
            await supabase.from('notifications').insert({
                user_id: pi.metadata.trainerId,
                type: 'OFFER_ACCEPTED',
                title: 'Offer Accepted & Payment Received',
                body: `Athlete has accepted your training offer and paid $${Number(pi.metadata.totalAmount || 0).toFixed(2)}.`,
                data: { offer_id: offerId },
                read: false,
            });
        }

        return NextResponse.json({ success: true });

    } catch (err: any) {
        console.error('[verify-offer-payment] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

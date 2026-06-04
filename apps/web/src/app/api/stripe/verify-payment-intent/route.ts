// ============================================
// Verify PaymentIntent — for native Payment Sheet
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

        const { paymentIntentId, bookingId } = await req.json();
        if (!paymentIntentId || !bookingId) {
            return NextResponse.json({ error: 'Missing paymentIntentId or bookingId' }, { status: 400 });
        }

        // Ownership: booking must belong to authenticated athlete
        const { data: booking } = await supabase
            .from('bookings')
            .select('athlete_id, trainer_id, status')
            .eq('id', bookingId)
            .eq('athlete_id', auth.user.id)
            .maybeSingle();

        if (!booking) {
            return NextResponse.json({ error: 'Booking not found or not authorized' }, { status: 403 });
        }

        // Verify PaymentIntent with Stripe
        const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (pi.status !== 'succeeded') {
            return NextResponse.json({ error: 'Payment not completed' }, { status: 400 });
        }

        // Validate metadata matches booking
        if (pi.metadata?.bookingId !== bookingId || pi.metadata?.athleteId !== auth.user.id) {
            return NextResponse.json({ error: 'Booking ownership mismatch' }, { status: 403 });
        }

        // Idempotency: skip if already recorded
        const { data: existing } = await supabase
            .from('payment_transactions')
            .select('id')
            .eq('booking_id', bookingId)
            .maybeSingle();

        if (existing) {
            return NextResponse.json({ success: true, alreadyRecorded: true });
        }

        const { amount, platformFee, stripeFee, taxAmount, taxLabel, trainerPayout, trainerId } = pi.metadata || {};

        // Hold period
        const { count: completedCount } = await supabase
            .from('bookings')
            .select('*', { count: 'exact', head: true })
            .eq('trainer_id', trainerId)
            .eq('status', 'completed');
        const holdHours = (completedCount ?? 0) >= 10 ? 24 : 72;
        const holdUntil = new Date(Date.now() + holdHours * 60 * 60 * 1000);

        // Create payment transaction
        const { error: txError } = await supabase
            .from('payment_transactions')
            .insert({
                booking_id: bookingId,
                stripe_payment_intent_id: paymentIntentId,
                amount: Number(amount),
                platform_fee: Number(platformFee || 0),
                stripe_fee: Number(stripeFee || 0),
                tax_amount: Number(taxAmount || 0),
                tax_label: taxLabel || null,
                trainer_payout: Number(trainerPayout || 0),
                status: 'held',
                hold_until: holdUntil.toISOString(),
            });

        if (txError) {
            console.error('[verify-payment-intent] Failed to create transaction:', txError);
            return NextResponse.json({ error: txError.message }, { status: 500 });
        }

        // Update booking status
        await supabase
            .from('bookings')
            .update({ status: 'confirmed', updated_at: new Date().toISOString() })
            .eq('id', bookingId)
            .eq('status', 'confirmed'); // Only if still confirmed (prevents overwriting completed)

        // Notify trainer
        if (trainerId) {
            await supabase.from('notifications').insert({
                user_id: trainerId,
                type: 'PAYMENT_RECEIVED',
                title: 'Payment Received',
                body: `Payment received! Funds are held in escrow until session completion.`,
                data: { booking_id: bookingId },
                read: false,
            });
        }

        return NextResponse.json({ success: true });

    } catch (err: any) {
        console.error('[verify-payment-intent] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

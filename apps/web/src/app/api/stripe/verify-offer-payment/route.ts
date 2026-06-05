// ============================================
// Verify Offer PaymentIntent — for native Payment Sheet
// Called after presentPaymentSheet() succeeds
// Creates booking + payment_transaction (escrow) from the paid offer.
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
            .select('id, athlete_id, trainer_id, status, sport, price, session_length_min, message, proposed_dates')
            .eq('id', offerId)
            .eq('athlete_id', auth.user.id)
            .maybeSingle();

        if (!offer) return NextResponse.json({ error: 'Offer not found' }, { status: 403 });

        // Verify PaymentIntent with Stripe
        const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (pi.status !== 'succeeded') {
            return NextResponse.json({ error: 'Payment not completed' }, { status: 400 });
        }

        // Metadata ownership match
        if (pi.metadata?.offerId !== offerId || pi.metadata?.athleteId !== auth.user.id) {
            return NextResponse.json({ error: 'Ownership mismatch' }, { status: 403 });
        }

        // Idempotency: if offer already accepted, booking was already created
        if (offer.status === 'accepted') {
            // Return the existing booking if possible
            const { data: existingBooking } = await supabase
                .from('bookings')
                .select('id')
                .eq('athlete_id', auth.user.id)
                .eq('trainer_id', offer.trainer_id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            return NextResponse.json({ success: true, alreadyAccepted: true, bookingId: existingBooking?.id });
        }

        const {
            trainerId,
            sport,
            scheduledAt,
            sessionLengthMin,
            message,
            price,
            platformFee,
            stripeFee,
            taxAmount,
            taxLabel,
            totalAmount,
            campName,
        } = pi.metadata || {};

        const bookingScheduledAt = scheduledAt || new Date().toISOString();

        // 1. Create booking from offer
        const { data: newBooking, error: bookingError } = await supabase
            .from('bookings')
            .insert({
                athlete_id: auth.user.id,
                trainer_id: trainerId,
                sport: sport || 'General Training',
                scheduled_at: bookingScheduledAt,
                duration_minutes: Number(sessionLengthMin) || 60,
                price: Number(price),
                platform_fee: Number(platformFee || 0),
                stripe_fee: Number(stripeFee || 0),
                tax_amount: Number(taxAmount || 0),
                tax_label: taxLabel || null,
                total_paid: Number(totalAmount),
                status: 'pending',
                athlete_notes: message ? `Accepted offer: ${message}` : null,
            })
            .select('id')
            .single();

        if (bookingError || !newBooking) {
            console.error('[verify-offer-payment] Failed to create booking:', bookingError);
            return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 });
        }

        // 2. Create payment_transaction (escrow)
        const { count: completedCount } = await supabase
            .from('bookings')
            .select('*', { count: 'exact', head: true })
            .eq('trainer_id', trainerId)
            .eq('status', 'completed');
        const holdHours = (completedCount ?? 0) >= 10 ? 24 : 72;
        const holdUntil = new Date(Date.now() + holdHours * 60 * 60 * 1000);

        await supabase.from('payment_transactions').insert({
            booking_id: newBooking.id,
            stripe_payment_intent_id: paymentIntentId,
            amount: Number(totalAmount),
            platform_fee: Number(platformFee || 0),
            stripe_fee: Number(stripeFee || 0),
            tax_amount: Number(taxAmount || 0),
            tax_label: taxLabel || null,
            trainer_payout: Number(price),
            status: 'held',
            hold_until: holdUntil.toISOString(),
        });

        // 3. Update offer status to accepted
        await supabase
            .from('training_offers')
            .update({ status: 'accepted' })
            .eq('id', offerId);

        // 4. Update athlete's offer notification so Accept/Pay buttons disappear
        const { data: offerNotifs } = await supabase
            .from('notifications')
            .select('id, data')
            .eq('user_id', auth.user.id)
            .contains('data', { offer_id: offerId });

        if (offerNotifs?.length) {
            for (const notif of offerNotifs) {
                await supabase
                    .from('notifications')
                    .update({ data: { ...(notif.data as any), offer_status: 'accepted' } })
                    .eq('id', notif.id);
            }
        }

        // 5. Camp spot management
        if (campName && trainerId) {
            let resolvedUserId = trainerId;
            const probe = await supabase
                .from('trainer_profiles')
                .select('user_id')
                .eq('user_id', trainerId)
                .maybeSingle();
            if (!probe.data) {
                const fallback = await supabase
                    .from('trainer_profiles')
                    .select('user_id')
                    .eq('id', trainerId)
                    .maybeSingle();
                if (fallback.data?.user_id) resolvedUserId = fallback.data.user_id;
            }

            await supabase.rpc('book_camp_spot', {
                p_user_id: resolvedUserId,
                p_camp_name: campName,
                p_idempotency_key: newBooking.id,
            }).then(({ error }) => {
                if (error) console.error('[verify-offer-payment] book_camp_spot failed:', error);
            });
        }

        // 6. Notify trainer
        if (trainerId) {
            await supabase.from('notifications').insert({
                user_id: trainerId,
                type: 'PAYMENT_RECEIVED',
                title: 'Offer Accepted & Payment Received',
                body: `Athlete accepted your training offer and paid $${Number(totalAmount).toFixed(2)}. Funds held in escrow.`,
                data: { booking_id: newBooking.id, offer_id: offerId },
                read: false,
            });
        }

        return NextResponse.json({ success: true, bookingId: newBooking.id });

    } catch (err: any) {
        console.error('[verify-offer-payment] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

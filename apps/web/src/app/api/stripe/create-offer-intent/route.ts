// ============================================
// Stripe PaymentIntent — Offer Accept (native Payment Sheet)
// Same validation as create-offer-payment but returns clientSecret
// ============================================
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { calculateFees } from '@/lib/fees';
import { stripeCurrency } from '@/lib/currency';
import { requireSessionUser } from '@/lib/session-auth';

export async function POST(req: NextRequest) {
    const auth = await requireSessionUser(req);
    if ('error' in auth) return auth.error;

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    try {
        if (!process.env.STRIPE_SECRET_KEY) {
            return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
        }
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' });

        const { offerId, athleteEmail } = await req.json();
        const athleteId = auth.user.id;

        if (!offerId || !athleteEmail) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Fetch + validate offer
        const { data: offer } = await supabase
            .from('training_offers')
            .select('*')
            .eq('id', offerId)
            .eq('athlete_id', athleteId)
            .eq('status', 'pending')
            .maybeSingle();

        if (!offer) {
            return NextResponse.json({ error: 'Offer not found or not authorized' }, { status: 404 });
        }

        // Resolve trainer
        let resolvedTrainerUserId = offer.trainer_id;
        const { data: trainer } = await supabase.from('users').select('first_name, last_name').eq('id', offer.trainer_id).single();
        if (!trainer) {
            const { data: tp } = await supabase.from('trainer_profiles').select('user_id').eq('id', offer.trainer_id).maybeSingle();
            if (tp?.user_id) resolvedTrainerUserId = tp.user_id;
        }

        // Fees
        const { data: settings } = await supabase.from('platform_settings').select('platform_fee_percentage').maybeSingle();
        const fees = calculateFees({
            price: Number(offer.price),
            platformFeePercentage: settings?.platform_fee_percentage,
        });

        const amountCents = Math.round(fees.totalPaid * 100);
        if (amountCents < 50) return NextResponse.json({ error: 'Offer amount too small' }, { status: 400 });

        // Create/get Stripe customer
        const customers = await stripe.customers.list({ email: athleteEmail, limit: 1 });
        const customer = customers.data.length > 0
            ? customers.data[0]
            : await stripe.customers.create({ email: athleteEmail });

        const ephemeralKey = await stripe.ephemeralKeys.create(
            { customer: customer.id },
            { apiVersion: '2026-02-25.clover' }
        );

        const proposed = offer.proposed_dates as any || {};
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amountCents,
            currency: stripeCurrency(),
            customer: customer.id,
            metadata: {
                type: 'offer_accept',
                offerId,
                athleteId,
                trainerId: resolvedTrainerUserId,
                sport: offer.sport || 'General Training',
                scheduledAt: proposed.scheduledAt || '',
                sessionLengthMin: String(offer.session_length_min || 60),
                message: (offer.message || '').slice(0, 450),
                price: String(fees.sessionFee),
                platformFee: String(fees.platformFee),
                stripeFee: String(fees.stripeFee),
                taxAmount: String(fees.taxAmount),
                taxLabel: fees.taxLabel || '',
                totalAmount: String(fees.totalPaid),
                campName: proposed?.camp?.name || '',
            },
        }, { idempotencyKey: `offer-${offerId}-${athleteId}` });

        return NextResponse.json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            ephemeralKey: ephemeralKey.secret,
            customerId: customer.id,
        });

    } catch (err: any) {
        console.error('[create-offer-intent] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

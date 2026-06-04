// ============================================
// Stripe PaymentIntent — for native Payment Sheet
// Returns clientSecret for @stripe/stripe-react-native
// ============================================
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { calculateFees } from '@/lib/fees';
import { stripeCurrency } from '@/lib/currency';
import { trainerPublicGate } from '@/lib/trainer-gate';
import { requireSessionUser } from '@/lib/session-auth';
import { normalizeSessionPricing, priceFor } from '@/lib/session-pricing';

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

        const { bookingId, athleteEmail } = await req.json();
        const athleteId = auth.user.id;

        if (!bookingId || !athleteEmail) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Fetch booking + validate ownership
        const { data: booking } = await supabase
            .from('bookings')
            .select('*, users!bookings_trainer_id_fkey(id, role, is_suspended, deleted_at, first_name, last_name)')
            .eq('id', bookingId)
            .eq('athlete_id', athleteId)
            .eq('status', 'confirmed')
            .maybeSingle();

        if (!booking) {
            return NextResponse.json({ error: 'Booking not found or not authorized' }, { status: 404 });
        }

        // Prevent double payment
        const { data: existing } = await supabase
            .from('payment_transactions')
            .select('id')
            .eq('booking_id', bookingId)
            .maybeSingle();
        if (existing) {
            return NextResponse.json({ error: 'Booking already paid' }, { status: 409 });
        }

        const trainerUser = booking.users;
        const { data: trainerProfile } = await supabase
            .from('trainer_profiles')
            .select('verification_status, subscription_status, bio, sports, city, years_experience, session_pricing, hourly_rate, training_locations, country')
            .eq('user_id', booking.trainer_id)
            .maybeSingle();

        const gate = trainerPublicGate({ user: trainerUser, trainerProfile });
        if (!gate.ok) {
            return NextResponse.json({ error: "This trainer isn't accepting bookings right now." }, { status: 409 });
        }

        // Server-side price calculation
        const sp = normalizeSessionPricing(trainerProfile?.session_pricing, trainerProfile?.hourly_rate);
        const canonicalPrice = priceFor(sp, Number(booking.duration_minutes));
        if (canonicalPrice == null) {
            return NextResponse.json({ error: 'Trainer does not offer this duration' }, { status: 400 });
        }

        const { data: settings } = await supabase
            .from('platform_settings')
            .select('platform_fee_percentage')
            .maybeSingle();

        const fees = calculateFees({
            price: canonicalPrice,
            platformFeePercentage: settings?.platform_fee_percentage,
            trainerCountry: trainerProfile?.country,
        });

        const amountCents = Math.round(fees.totalPaid * 100);
        if (amountCents < 50) {
            return NextResponse.json({ error: 'Booking amount too small' }, { status: 400 });
        }

        // Create or get Stripe customer
        const customers = await stripe.customers.list({ email: athleteEmail, limit: 1 });
        const customer = customers.data.length > 0
            ? customers.data[0]
            : await stripe.customers.create({ email: athleteEmail });

        // Create ephemeral key for Payment Sheet
        const ephemeralKey = await stripe.ephemeralKeys.create(
            { customer: customer.id },
            { apiVersion: '2026-02-25.clover' }
        );

        // Create PaymentIntent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amountCents,
            currency: stripeCurrency(),
            customer: customer.id,
            metadata: {
                type: 'booking',
                bookingId,
                athleteId,
                trainerId: booking.trainer_id,
                amount: String(fees.totalPaid),
                sessionFee: String(fees.sessionFee),
                platformFee: String(fees.platformFee),
                stripeFee: String(fees.stripeFee),
                taxAmount: String(fees.taxAmount),
                taxLabel: fees.taxLabel || '',
                trainerCountry: fees.trainerCountry || '',
                trainerPayout: String(fees.trainerPayout),
                serverPriceCanonical: String(canonicalPrice),
            },
        });

        return NextResponse.json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            ephemeralKey: ephemeralKey.secret,
            customerId: customer.id,
            publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
        });

    } catch (error: any) {
        console.error('[create-payment-intent] Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to create payment intent' }, { status: 500 });
    }
}

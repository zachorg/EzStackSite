import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

const planToPriceEnv: Record<string, string> = {
  pro: process.env.PLAN_PRO_PRICE_ID || "",
  scale: process.env.PLAN_SCALE_PRICE_ID || "",
};

export async function POST(req: Request) {
  if (!stripeSecretKey) {
    return NextResponse.json(
      { error: { code: "configuration_error", message: "Missing STRIPE_SECRET_KEY" } },
      { status: 500 }
    );
  }

  const stripe = new Stripe(stripeSecretKey);

  try {
    const body = await req.json();
    const planId = String(body?.planId || "");
    if (!planId || !planToPriceEnv[planId]) {
      return NextResponse.json(
        { error: { code: "validation_error", message: "Invalid planId" } },
        { status: 400 }
      );
    }

    const priceId = planToPriceEnv[planId];
    if (!priceId) {
      return NextResponse.json(
        { error: { code: "configuration_error", message: "Missing price id for plan" } },
        { status: 500 }
      );
    }

    const origin = new URL(req.url).origin;
    const successUrl = `${origin}/plans/success`;
    const cancelUrl = `${origin}/plans/cancel`;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "internal_error", message: "Unable to create checkout session" } },
      { status: 500 }
    );
  }
}



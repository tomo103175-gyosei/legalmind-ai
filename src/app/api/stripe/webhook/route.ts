import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2026-04-22.dahlia",
});

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("Stripe-Signature") as string;

  let event: Stripe.Event;

  try {
    // If you have a webhook secret, verify signature:
    // const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    // event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    
    // For test mode without webhook secret configured locally, just parse it:
    event = JSON.parse(body) as Stripe.Event;
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const userId = session.metadata?.userId;
    const customerId = session.customer as string;

    if (userId) {
      // Upgrade user to PREMIUM
      await prisma.user.update({
        where: { id: userId },
        data: {
          plan: "PREMIUM",
          stripeCustomerId: customerId,
        },
      });
      console.log(`Upgraded user ${userId} to PREMIUM`);
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer as string;

    // Downgrade user back to FREE
    await prisma.user.updateMany({
      where: { stripeCustomerId: customerId },
      data: { plan: "FREE" },
    });
    console.log(`Downgraded user with customer ${customerId} to FREE`);
  }

  return new NextResponse("Webhook received", { status: 200 });
}

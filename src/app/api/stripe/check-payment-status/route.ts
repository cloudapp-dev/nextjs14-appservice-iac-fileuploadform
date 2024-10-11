import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-09-30.acacia",
});

export async function GET(req: NextRequest) {
  const sessionId = req.cookies.get("session_id")?.value; // Assuming session ID is stored in cookies

  if (!sessionId) {
    return NextResponse.json({ paid: false });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return NextResponse.json({ paid: session.payment_status === "paid" });
  } catch (error) {
    console.error("Error retrieving session from Stripe:", error);
    return NextResponse.json({ paid: false });
  }
}

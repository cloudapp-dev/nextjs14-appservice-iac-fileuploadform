// /app/api/stripe/success/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getToken } from "next-auth/jwt";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-09-30.acacia",
});

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.json(
      { error: "Session ID is required" },
      { status: 400 }
    );
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status === "paid") {
    const authtoken = await getToken({ req });

    if (!authtoken || authtoken.role !== "Admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Logic to create a storage account after payment.
    // Access session data and create Azure storage account.
    return NextResponse.json({
      message: "Payment successful, storage account creation is now possible!",
    });
  } else {
    return NextResponse.json(
      { error: "Payment not verified" },
      { status: 400 }
    );
  }
}

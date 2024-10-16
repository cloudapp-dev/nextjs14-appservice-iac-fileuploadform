import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-09-30.acacia",
});

export async function GET(req: NextRequest) {
  try {
    const products = await stripe.products.list({
      expand: ["data.default_price"],
    });

    return NextResponse.json({ products: products.data });
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json({ error: "Error fetching products" });
  }
}

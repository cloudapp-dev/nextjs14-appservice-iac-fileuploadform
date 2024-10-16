"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import getStripe from "@/lib/get-stripe";

export default function Subscriptions() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Fetch products from Stripe
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch("/api/stripe/get-products");
        const data = await res.json();
        setProducts(data.products);
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const handlePayment = async (priceId: any) => {
    const res = await fetch("/api/stripe/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceId }),
    });
    const { id } = await res.json();
    const stripe = (await getStripe()) as any;
    const { error } = await stripe.redirectToCheckout({ sessionId: id });
    if (error) console.error("Stripe checkout failed:", error);
    else router.push("/dashboard");
  };

  if (loading) return <p>Loading subscriptions...</p>;
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 text-center">
        Choose Your Subscription
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {products.map((product: any) => (
          <div
            key={product.id}
            className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md"
          >
            {product.images.length > 0 && (
              <img
                src={product.images[0]}
                alt={product.name}
                className="w-full h-48 object-cover rounded-lg mb-4"
              />
            )}
            <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">
              {product.name}
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              {product.description}
            </p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-200 mb-6">
              {product.default_price.unit_amount / 100}{" "}
              {product.default_price.currency.toUpperCase()} /{" "}
              {product.default_price.recurring.interval}
            </p>
            <button
              onClick={() => handlePayment(product.default_price.id)}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
            >
              Choose {product.name}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

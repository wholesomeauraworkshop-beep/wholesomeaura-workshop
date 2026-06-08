// /api/create-checkout.js
// Vercel Serverless Function — 创建 Stripe Checkout Session

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const products = require("../config/products").products;

module.exports = async (req, res) => {
  // 只允许 POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { productId, lang } = req.body;
    const product = products[productId];

    if (!product) {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    const isZh = lang === "zh";
    const successUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/thank-you.html?product=${productId}&lang=${lang || "en"}`;
    const cancelUrl  = `${process.env.NEXT_PUBLIC_BASE_URL}/#shop`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: isZh && product.nameZh ? product.nameZh : product.name,
              description: product.description,
            },
            unit_amount: product.price,
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        productId: product.id,
        lang: lang || "en",
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Stripe Checkout error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// /api/create-checkout.js
// Vercel Serverless Function — 创建 Stripe Checkout Session

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const productsConfig = require("../config/products");
const products = productsConfig.products;

// CORS: 允许浏览器从本地或任意来源调用
function setCorsHeaders(req, res) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

module.exports = async (req, res) => {
  setCorsHeaders(req, res);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // 只允许 POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { productId } = req.body;
    const product = products[productId];

    if (!product) {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    const successUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/thank-you.html?product=${productId}`;
    const cancelUrl  = `${process.env.NEXT_PUBLIC_BASE_URL}/#shop`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: product.name,
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
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Stripe Checkout error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// /api/stripe-webhook.js
// Vercel Serverless Function — 接收 Stripe Webhook 事件
// 支付成功后触发 Resend 发送邮件

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { Resend } = require("resend");
const products = require("../config/products").products;
const emailConfig = require("../config/products").email;

const resend = new Resend(process.env.RESEND_API_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const sig = req.headers["stripe-signature"];
  let event;

  try {
    // 验证 Webhook 签名
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // 只处理支付成功事件
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const { productId, lang } = session.metadata;
    const customerEmail = session.customer_details?.email;

    if (!customerEmail) {
      console.error("No customer email found in session");
      return res.status(200).json({ received: true });
    }

    const product = products[productId];
    if (!product) {
      console.error("Product not found:", productId);
      return res.status(200).json({ received: true });
    }

    const isZh = lang === "zh";
    const productName = isZh && product.nameZh ? product.nameZh : product.name;
    const productUrl = product.successUrl;

    // 发送邮件
    try {
      await resend.emails.send({
        from: emailConfig.from,
        to: customerEmail,
        subject: isZh ? emailConfig.subjectZh : emailConfig.subject,
        text: emailConfig.bodyTemplate(productName, productUrl, isZh),
      });
      console.log("Email sent to:", customerEmail);
    } catch (err) {
      console.error("Resend error:", err);
    }
  }

  res.status(200).json({ received: true });
};

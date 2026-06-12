// /api/stripe-webhook.js
// Vercel Serverless Function — 接收 Stripe Webhook 事件
// 支付成功后触发 Resend 发送带下载链接的邮件

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { Resend } = require("resend");
const path = require("path");
const productsConfig = require("../config/products");
const products = productsConfig.products;
const emailConfig = productsConfig.email;

productsConfig.init(path.join(__dirname, ".."));

const resend = new Resend(process.env.RESEND_API_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL;

// 禁用 Vercel bodyParser — Stripe 签名验证需要原始字节
module.exports.config = { api: { bodyParser: false } };

async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const timeout = setTimeout(() => reject(new Error("readRawBody timed out")), 10000);
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => { clearTimeout(timeout); resolve(Buffer.concat(chunks)); });
    req.on("error", (err) => { clearTimeout(timeout); reject(err); });
  });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const sig = req.headers["stripe-signature"];
  if (!sig) return res.status(400).json({ error: "Missing Stripe-Signature" });

  let event;
  try {
    event = stripe.webhooks.constructEvent(await readRawBody(req), sig, webhookSecret);
  } catch (err) {
    console.error("[Webhook] Signature FAILED:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type !== "checkout.session.completed") {
    return res.status(200).json({ received: true });
  }

  const session = event.data.object;
  const productId = session.metadata?.productId;
  const customerEmail = session.customer_details?.email;

  if (!customerEmail || !productId || !products[productId]) {
    return res.status(200).json({ received: true, skipped: "missing data" });
  }

  const product = products[productId];
  const downloadUrl = `${BASE_URL}/public/products/${encodeURIComponent(product.file)}`;

  try {
    await resend.emails.send({
      from: emailConfig.from,
      to: customerEmail,
      subject: `Your Download: ${product.name}`,
      html: `<p>Hi,</p>
<p>Thanks for purchasing <strong>${product.name}</strong>.</p>
<p><a href="${downloadUrl}" style="display:inline-block;padding:12px 24px;background:#1a1a1a;color:#fff;text-decoration:none;border-radius:4px;font-family:sans-serif;">Download Your File</a></p>
<p>Or copy this link:</p>
<p style="color:#888;font-size:14px;">${downloadUrl}</p>
<p>— Aura<br>WholesomeAuraWorkshop</p>`,
    });
    console.log("[Webhook] Email sent:", customerEmail, productId);
  } catch (err) {
    console.error("[Webhook] Resend error:", err.message);
    return res.status(500).json({ received: true, email_error: err.message });
  }

  res.status(200).json({ received: true });
};

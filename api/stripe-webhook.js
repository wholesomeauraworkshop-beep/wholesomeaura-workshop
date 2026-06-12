// /api/stripe-webhook.js
// Vercel Serverless Function — 接收 Stripe Webhook 事件
// 支付成功后触发 Resend 发送带产品文件附件的邮件

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { Resend } = require("resend");
const path = require("path");
const fs = require("fs");
const productsConfig = require("../config/products");
const products = productsConfig.products;
const emailConfig = productsConfig.email;

// 初始化产品路径（Vercel Serverless 中 __dirname 指向 /api）
productsConfig.init(path.join(__dirname, ".."));

const resend = new Resend(process.env.RESEND_API_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// --- 关键修复：禁用 Vercel 自动 body 解析 ---
// Vercel @vercel/node 默认解析 JSON body，导致无法取回 Stripe 签名验证所需的原始字节。
// 禁用后，readRawBody 可以直接从请求流中读取原始 body。
module.exports.config = {
  api: {
    bodyParser: false,
  },
};

// 读取产品文件并返回 Resend 附件格式
function readAttachment(filePath, filename) {
  if (!fs.existsSync(filePath)) {
    console.error("[Webhook] File not found:", filePath);
    return null;
  }
  const content = fs.readFileSync(filePath);
  console.log("[Webhook] Attachment loaded:", filename, `(${(content.length / 1024).toFixed(1)} KB)`);
  return { filename, content };
}

// 读取原始请求体
// bodyParser: false 确保 Vercel 不会预解析，body 可以从流中读取
async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const timeout = setTimeout(() => {
      reject(new Error("readRawBody timed out after 10s"));
    }, 10000);

    req.on("data", (chunk) => {
      chunks.push(chunk);
    });
    req.on("end", () => {
      clearTimeout(timeout);
      const raw = Buffer.concat(chunks);
      console.log("[Webhook] Raw body read:", raw.length, "bytes");
      resolve(raw);
    });
    req.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

module.exports = async (req, res) => {
  console.log("[Webhook] === Incoming request ===");
  console.log("[Webhook] Method:", req.method);
  console.log("[Webhook] Content-Type:", req.headers["content-type"]);

  if (req.method !== "POST") {
    console.log("[Webhook] Rejected: method not POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const sig = req.headers["stripe-signature"];
  console.log("[Webhook] Stripe-Signature present:", !!sig);

  if (!sig) {
    console.error("[Webhook] Missing Stripe-Signature header");
    return res.status(400).json({ error: "Missing Stripe-Signature header" });
  }

  let event;
  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    console.log("[Webhook] Signature verified OK. Event type:", event.type);
  } catch (err) {
    console.error("[Webhook] Signature verification FAILED:", err.message);
    console.error("[Webhook] (Check STRIPE_WEBHOOK_SECRET env var matches Stripe Dashboard)");
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // 只处理支付完成事件
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const { productId } = session.metadata || {};
    const customerEmail = session.customer_details?.email;

    console.log("[Webhook] checkout.session.completed");
    console.log("[Webhook] Product ID:", productId);
    console.log("[Webhook] Customer email:", customerEmail);
    console.log("[Webhook] Payment status:", session.payment_status);
    console.log("[Webhook] Amount total:", session.amount_total);

    if (!customerEmail) {
      console.error("[Webhook] No customer email — skipping email send");
      return res.status(200).json({ received: true, skipped: "no email" });
    }

    const product = products[productId];
    if (!product) {
      console.error("[Webhook] Unknown productId:", productId);
      console.error("[Webhook] Available products:", Object.keys(products));
      return res.status(200).json({ received: true, skipped: "unknown product" });
    }

    const attachment = readAttachment(product.filePath, product.file);

    const emailParams = {
      from: emailConfig.from,
      to: customerEmail,
      subject: emailConfig.subject,
      text: emailConfig.bodyTemplate(product.name),
    };

    if (attachment) {
      emailParams.attachments = [attachment];
    } else {
      console.warn("[Webhook] No attachment for:", productId, "(email will be sent without file)");
    }

    try {
      console.log("[Webhook] Sending email via Resend...");
      const result = await resend.emails.send(emailParams);
      console.log("[Webhook] Email sent OK! ID:", result.data?.id || result.id);
      console.log("[Webhook] To:", customerEmail);
      console.log("[Webhook] Product:", productId);
    } catch (err) {
      console.error("[Webhook] Resend API error:", err.name, err.message);
      if (err.statusCode) {
        console.error("[Webhook] Resend HTTP status:", err.statusCode);
      }
      return res.status(500).json({ received: true, email_error: err.message });
    }
  } else {
    console.log("[Webhook] Ignored event type:", event.type);
  }

  res.status(200).json({ received: true });
};

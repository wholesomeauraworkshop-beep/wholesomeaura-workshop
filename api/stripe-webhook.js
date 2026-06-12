// /api/stripe-webhook.js
// Vercel Serverless Function — 接收 Stripe Webhook 事件
// 支付成功后触发 Resend 发送带产品文件附件的邮件
// 支持 PDF / PNG / JPG 等任意文件格式

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { Resend } = require("resend");
const path = require("path");
const fs = require("fs");
const productsConfig = require("../config/products");
const products = productsConfig.products;
const emailConfig = productsConfig.email;

// 初始化产品路径
// Vercel Serverless 中 __dirname 指向 /api，需要往上一级才是项目根目录
productsConfig.init(path.join(__dirname, ".."));

const resend = new Resend(process.env.RESEND_API_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// 读取产品文件并返回 Resend 附件格式
function readAttachment(filePath, filename) {
  if (!fs.existsSync(filePath)) {
    console.error("File not found:", filePath);
    return null;
  }
  const content = fs.readFileSync(filePath);
  return {
    filename: filename,
    content: content,
  };
}

// 读取原始请求体（Vercel 环境下 req.body 可能已预解析，需要兼容处理）
async function readRawBody(req) {
  // 如果 Vercel 已经提供了 body 对象，转回 JSON 字符串用于签名验证
  if (req.body && typeof req.body === "object") {
    return JSON.stringify(req.body);
  }
  // 否则从流中读取原始字节
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      resolve(raw);
    });
    req.on("error", reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const sig = req.headers["stripe-signature"];
  let event;

  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const { productId } = session.metadata || {};
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
      console.warn("Attachment missing for:", productId);
    }

    try {
      await resend.emails.send(emailParams);
      console.log("Email sent to:", customerEmail, "| Product:", productId);
    } catch (err) {
      console.error("Resend error:", err);
    }
  }

  res.status(200).json({ received: true });
};

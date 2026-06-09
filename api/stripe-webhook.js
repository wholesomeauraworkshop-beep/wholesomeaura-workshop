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

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const { productId, lang } = session.metadata || {};
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

    const attachment = readAttachment(product.filePath, product.file);

    const emailParams = {
      from: emailConfig.from,
      to: customerEmail,
      subject: isZh ? emailConfig.subjectZh : emailConfig.subject,
      text: emailConfig.bodyTemplate(productName, isZh),
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

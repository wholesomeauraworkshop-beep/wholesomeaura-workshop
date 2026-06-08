// /api/stripe-webhook.js
// Vercel Serverless Function — 接收 Stripe Webhook 事件
// 支付成功后触发 Resend 发送带 PDF 附件的邮件

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { Resend } = require("resend");
const path = require("path");
const fs = require("fs");
const productsConfig = require("../config/products");
const products = productsConfig.products;
const emailConfig = productsConfig.email;

// 初始化产品路径
productsConfig.init(__dirname);

const resend = new Resend(process.env.RESEND_API_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// 读取 PDF 文件并转为 base64
function readPdfAttachment(pdfPath, filename) {
  if (!fs.existsSync(pdfPath)) {
    console.error("PDF not found:", pdfPath);
    return null;
  }
  const content = fs.readFileSync(pdfPath);
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
    // 验证 Webhook 签名
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // 只处理支付成功事件
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

    // 读取 PDF 附件
    const attachment = readPdfAttachment(product.pdfPath, product.pdfFile);

    // 构建邮件参数
    const emailParams = {
      from: emailConfig.from,
      to: customerEmail,
      subject: isZh ? emailConfig.subjectZh : emailConfig.subject,
      text: emailConfig.bodyTemplate(productName, isZh),
    };

    // 如果有 PDF 附件，加入邮件
    if (attachment) {
      emailParams.attachments = [attachment];
    } else {
      console.warn("PDF attachment missing for:", productId);
    }

    // 发送邮件
    try {
      await resend.emails.send(emailParams);
      console.log("Email sent to:", customerEmail, "| Product:", productId);
    } catch (err) {
      console.error("Resend error:", err);
    }
  }

  res.status(200).json({ received: true });
};

// config/products.js
// 集中管理所有数字产品
// 修改产品、价格、附件只需改这个文件
// 附件支持 PDF / PNG / JPG 等格式

const path = require("path");
const fs = require("fs");

module.exports = {
  products: {
    "healthy-hazards": {
      id: "healthy-hazards",
      name: "Why Your Cats Might Tweak Your Brain And Behavior?",
      nameZh: "为什么你的猫可能会影响你的大脑和行为？",
      description: "That sudden road rage? It could be Toxoplasma gondii — a parasite from your cat.",
      price: 199,        // 单位：分（USD），1.99 USD = 199
      currency: "usd",
      // 产品附件（放在 public/products/ 目录下，支持 PDF/PNG/JPG 等）
      file: "healthy-hazards.pdf",
      filePath: null,    // 运行时自动计算
      // Stripe Price ID（在 Stripe Dashboard 创建产品后填入）
      stripePriceId: "",
    },
    "tai-chi-diagram": {
      id: "tai-chi-diagram",
      name: "The Origin And Evolution Of The Tai Chi Diagram",
      nameZh: "太极图的起源与演变",
      description: "Questioning accepted truths, seeking hidden origins — from ancient symbols to Earth's deep past.",
      price: 199,
      currency: "usd",
      file: "tai-chi-diagram.pdf",
      filePath: null,
      stripePriceId: "",
    },
  },

  // 免费产品
  freeProducts: {
    "stewed-duck-recipe": {
      id: "stewed-duck-recipe",
      name: "Stewed Duck with Astragalus and Black Fungus",
      nameZh: "黄芪黑木耳炖鸭",
      file: "stewed-duck-recipe.pdf",
    },
  },

  // 运行时初始化：计算文件绝对路径
  init(baseDir) {
    const productsDir = path.join(baseDir, "public", "products");
    Object.keys(this.products).forEach(key => {
      const p = this.products[key];
      p.filePath = path.join(productsDir, p.file);
    });
    Object.keys(this.freeProducts).forEach(key => {
      const p = this.freeProducts[key];
      p.filePath = path.join(productsDir, p.file);
    });
  },

  // Resend 邮件模板（带附件）
  email: {
    from: "WholesomeAura <onboarding@resend.dev>",  // Resend 验证域名后改为品牌邮箱
    subject: "Your WholesomeAuraWorkshop Digital Product",
    subjectZh: "您的 WholesomeAuraWorkshop 数字产品",

    bodyTemplate(productName, isZh) {
      if (isZh) {
        return `你好，\n\n感谢你的购买！你的数字产品「${productName}」已附在邮件中，请查收。\n\n祝好，\nAura\nWholesomeAuraWorkshop`;
      }
      return `Hi there,\n\nThank you for your purchase! Your digital product "${productName}" is attached to this email. Enjoy!\n\nBest,\nAura\nWholesomeAuraWorkshop`;
    },

    freeBodyTemplate(productName, isZh) {
      if (isZh) {
        return `你好，\n\n这是你下载的免费食谱「${productName}」，已附在邮件中。祝你烹饪愉快！\n\n祝好，\nAura\nWholesomeAuraWorkshop`;
      }
      return `Hi there,\n\nHere's your free recipe "${productName}". The file is attached. Happy cooking!\n\nBest,\nAura\nWholesomeAuraWorkshop`;
    },
  },
};

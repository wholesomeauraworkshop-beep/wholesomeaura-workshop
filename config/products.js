// config/products.js
// 集中管理所有数字产品
// 修改产品、价格、Canva 链接只需改这个文件

module.exports = {
  products: {
    "healthy-hazards": {
      id: "healthy-hazards",
      name: "Why Your Cats Might Tweak Your Brain And Behavior?",
      nameZh: "为什么你的猫可能会影响你的大脑和行为？",
      description: "That sudden road rage? It could be Toxoplasma gondii — a parasite from your cat.",
      price: 199,        // 单位：分（USD），1.99 USD = 199
      currency: "usd",
      // Canva 数字产品页面链接（收款后邮件发送此链接）
      successUrl: "https://your-canva-link.com/healthy-hazards",
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
      successUrl: "https://your-canva-link.com/tai-chi-diagram",
      stripePriceId: "",
    },
  },

  // Resend 邮件模板
  email: {
    from: "WholesomeAura <onboarding@resend.dev>",  // Resend 验证域名后改为品牌邮箱
    subject: "Your WholesomeAuraWorkshop Digital Product Access",
    subjectZh: "您的 WholesomeAuraWorkshop 数字产品访问链接",
    // 邮件正文模板，{{productName}} 和 {{productUrl}} 会被替换
    bodyTemplate: (productName, productUrl, isZh) => {
      if (isZh) {
        return `你好，\n\n感谢你的购买！\n\n产品：${productName}\n访问链接：${productUrl}\n\n祝好，\nAura\nWholesomeAuraWorkshop`;
      }
      return `Hi there,\n\nThank you for your purchase!\n\nProduct: ${productName}\nAccess Link: ${productUrl}\n\nBest,\nAura\nWholesomeAuraWorkshop`;
    },
  },
};

# WholesomeAuraWorkshop — Stripe + Vercel 部署指南

## 环境变量（Vercel Dashboard → Settings → Environment Variables）

```
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxx
RESEND_API_KEY=re_xxxxxxxxxx
NEXT_PUBLIC_BASE_URL=https://wholesomeauraworkshop.com
```

---

## Step 1：Stripe 配置

1. 登录 https://dashboard.stripe.com
2. **获取 Secret Key**：Developers → API Keys → Reveal secret key → 复制到 `STRIPE_SECRET_KEY`
3. **创建 Webhook**：Developers → Webhooks → Add endpoint
   - Endpoint URL：`https://wholesomeauraworkshop.com/api/stripe-webhook`
   - Events to send：`checkout.session.completed`
   - 创建后复制 Signing Secret → 填入 `STRIPE_WEBHOOK_SECRET`

---

## Step 2：Resend 配置

1. 注册 https://resend.com
2. **获取 API Key**：Dashboard → API Keys → Create API Key → 复制 `re_xxx`
3. **（可选）绑定域名**：Domain → Add Domain，验证后修改 `config/products.js` 里的 `email.from`

---

## Step 3：GitHub + Vercel 部署

```bash
# 1. 初始化 Git（如果还没有）
git init
git add .
git commit -m "Initial commit: Stripe + Vercel setup"

# 2. 推到 GitHub（先创建 repo）
git remote add origin https://github.com/你的用户名/wholesomeaura-workshop.git
git push -u origin main

# 3. Vercel 部署（绑定自定义域名）
# 方式 A：Vercel Dashboard → Import Git Repository → Settings → Domains → 添加 wholesomeauraworkshop.com
# 方式 B：命令行
npx vercel --prod
```

---

## Step 4：准备产品 PDF

将 PDF 文件放到 `public/products/` 目录下：

```
public/products/
  healthy-hazards.pdf      ← Healthy Hazards 产品 PDF
  tai-chi-diagram.pdf      ← Tai Chi Diagram 产品 PDF
  stewed-duck-recipe.pdf   ← 免费食谱 PDF
```

邮件配置在 `config/products.js`，付款后自动附带 PDF 附件发送。

---
## Step 5：后续添加新产品（简单！）

只需修改 `config/products.js`，加一段：

```js
"new-product-id": {
  id: "new-product-id",
  name: "New Product Title",
  nameZh: "新产品标题",
  description: "Product description...",
  price: 299,          // $2.99
  currency: "usd",
  pdfFile: "new-product.pdf",    // PDF 文件名（放 public/products/ 下）
  pdfPath: null,                 // 自动计算，不用改
  stripePriceId: "",
},
```

然后在 `index.html` 里复制一个 `.product-row` 区块，改掉文案和 `data-category`，push 后 Vercel 自动部署。

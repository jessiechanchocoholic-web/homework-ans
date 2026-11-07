# 功課 App 搬去 Cloudflare + OpenRouter（約 10 分鐘）

> 呢個 branch：`cloudflare-openrouter`。main 照舊唔郁。

## 一、OpenRouter（AI 來源）
1. 開 https://openrouter.ai → 右上 **Sign in**，用 Google 或電郵開戶。
2. 撳頭像 → **Credits** → **Add Credits**，入 **US$10** 就夠（信用卡或 AliPay；會收 5.5% 手續費，最少 US$0.80）。
3. 撳頭像 → **Keys** → **Create Key**，名叫 `homework`，可設 **Credit limit**（例如 $10）。
4. 複製 `sk-or-...` 條 key（只顯示一次），**唔好**貼落 GitHub 或 WhatsApp。

## 二、Cloudflare（免費網站）
1. 開 https://dash.cloudflare.com/sign-up 免費開戶。
2. 左邊 **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → 揀 GitHub，批准 `homework-ans` repo。
3. 設定：
   - Production branch：`cloudflare-openrouter`
   - Framework preset：**None**
   - Build command：留空
   - Build output directory：`/`
4. 撳 **Save and Deploy**。
5. 去 **Settings → Variables and Secrets → Add**：
   - 類型 **Secret**，名 `OPENROUTER_API_KEY`，值貼 key → Save。
6. **Deployments** → 最新嗰個 → **Retry deployment**（等 key 生效）。
7. 網址會係 `https://homework-ans.pages.dev`（或相近）。

## 三、之後 Jj 做
- 用網址試幾張功課相，核對準唔準。
- 如 OpenAI 模型喺香港被拒（403 region），轉同級模型或調整設定。
- 搞掂先問你，再 merge 入 main／換短網址。

## 模型（只用強模型）
- 準確（預設）：`openai/gpt-6.1-sol`
- 最準：`openai/gpt-6-astra`
- 想換：Cloudflare 加變數 `MODEL_DEFAULT`／`MODEL_PREMIUM`。

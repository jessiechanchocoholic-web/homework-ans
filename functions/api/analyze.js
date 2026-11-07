/**
 * Cloudflare Pages Function: POST /api/analyze
 * 經 OpenRouter（OpenAI 相容 API）呼叫 vision 模型。Key 只存喺 Cloudflare Secrets，唔會去到前端。
 *
 * 環境變數（Cloudflare → Settings → Variables and Secrets）：
 *   OPENROUTER_API_KEY = OpenRouter key（必填，Secret）
 *   MODEL_DEFAULT      = 可選；預設 openai/gpt-6.1-sol
 *   MODEL_PREMIUM      = 可選；預設 openai/gpt-6-astra
 *   API_BASE_URL       = 可選；預設 https://openrouter.ai/api/v1
 * （舊名 OPENAI_API_KEY／OPENAI_MODEL_DEFAULT／OPENAI_MODEL_PREMIUM／OPENAI_BASE_URL 仍然接受）
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const DEFAULT_BASE = 'https://openrouter.ai/api/v1';
const DEFAULT_MODEL = 'openai/gpt-6.1-sol';
const PREMIUM_MODEL = 'openai/gpt-6-astra';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestPost(context) {
  const { env, request } = context;
  try {
    const body = await request.json();
    const prompt = (body && body.prompt) || '';
    const imageBase64 = body && body.imageBase64;
    const mimeType = (body && body.mimeType) || 'image/jpeg';
    const modelTier = (body && body.modelTier) === 'premium' ? 'premium' : 'default';

    if (!prompt || !imageBase64) {
      return json({ error: '缺少 prompt 或相片' }, 400);
    }
    if (String(imageBase64).length > 11_000_000) {
      return json({ error: '相片太大，請壓縮後再試' }, 413);
    }

    const apiKey = String(env.OPENROUTER_API_KEY || env.OPENAI_API_KEY || '').trim();
    if (!apiKey) {
      return json({
        error: '未設定 OPENROUTER_API_KEY。請喺 Cloudflare Secrets 或本機 .dev.vars 填入。',
        code: 'MISSING_API_KEY',
      }, 503);
    }

    const modelDefault = String(env.MODEL_DEFAULT || env.OPENAI_MODEL_DEFAULT || DEFAULT_MODEL).trim();
    const modelPremium = String(env.MODEL_PREMIUM || env.OPENAI_MODEL_PREMIUM || PREMIUM_MODEL).trim();
    const model = modelTier === 'premium' ? modelPremium : modelDefault;
    if (!model) {
      return json({
        error: '未設定模型 ID',
        code: 'MISSING_MODEL',
      }, 503);
    }

    const baseUrl = String(env.API_BASE_URL || env.OPENAI_BASE_URL || DEFAULT_BASE).replace(/\/$/, '');
    const content = await callOpenAI({
      baseUrl,
      apiKey,
      model,
      prompt,
      imageBase64,
      mimeType,
    });

    return json({ content: content || '', modelTier, provider: 'openrouter', model }, 200);
  } catch (err) {
    const message = (err && err.message) ? String(err.message) : '分析失敗';
    const status = /region|unsupported|not available|403|401/i.test(message) ? 403 : 502;
    return json({ error: message, code: 'UPSTREAM' }, status);
  }
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS },
  });
}

async function callOpenAI({ baseUrl, apiKey, model, prompt, imageBase64, mimeType }) {
  const resp = await fetch(baseUrl + '/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/jessiechanchocoholic-web/homework-ans',
      'X-Title': 'Homework Answer App',
    },
    body: JSON.stringify({
      model,
      // 唔准降級去其他模型；同一模型可轉 Azure／Bedrock 等供應商
      provider: { allow_fallbacks: true },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: { url: 'data:' + mimeType + ';base64,' + imageBase64 },
            },
          ],
        },
      ],
    }),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const detail =
      (data && data.error && (data.error.message || data.error.code)) ||
      (data && data.message) ||
      JSON.stringify(data).slice(0, 300);
    throw new Error('AI 錯誤 ' + resp.status + ': ' + detail);
  }

  const choice = data.choices && data.choices[0];
  const content = choice && choice.message && choice.message.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((p) => (typeof p === 'string' ? p : (p && p.text) || '')).join('');
  }
  return '';
}

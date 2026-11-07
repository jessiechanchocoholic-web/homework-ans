// Cloudflare Worker：POST /api/chat → Poe OpenAI 相容 API。Key 只喺 Secret POE_API_KEY。
const POE_URL = 'https://api.poe.com/v1/chat/completions';
const ALLOWED = ['Claude-Haiku-5.5', 'Claude-Sonnet-5.5'];

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

async function safeEqual(a, b) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  return crypto.subtle.timingSafeEqual(ha, hb);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/api/chat') return env.ASSETS.fetch(request);
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    const appPw = String(env.APP_PASSWORD || '');
    if (!appPw) return json({ error: '老師未設定 APP_PASSWORD，暫時停用（Cloudflare → Settings → Variables and Secrets）' }, 503);
    if (!(await safeEqual(request.headers.get('X-App-Password') || '', appPw))) {
      return json({ error: '密碼唔啱' }, 401);
    }
    const key = String(env.POE_API_KEY || '').trim();
    if (!key) return json({ error: '未設定 POE_API_KEY（Cloudflare → Settings → Variables and Secrets）' }, 503);

    let body;
    try {
      body = JSON.parse(await request.text());
    } catch (_e) { return json({ error: '請求格式錯誤' }, 400); }
    if (!body || !Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > 20) {
      return json({ error: '缺少 messages' }, 400);
    }
    const fallback = String(env.MODEL || 'Claude-Haiku-5.5').trim();
    const model = ALLOWED.includes(body.model) || body.model === fallback ? body.model : fallback;

    const upstream = await fetch(POE_URL, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: body.messages, stream: body.stream !== false }),
    });
    if (!upstream.ok) {
      let msg = 'AI 服務錯誤（' + upstream.status + '）';
      try { const j = await upstream.json(); if (j && j.error && j.error.message) msg += '：' + j.error.message; } catch (_e) {}
      return json({ error: msg }, 502);
    }
    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'text/event-stream',
        'Cache-Control': 'no-store',
      },
    });
  },
};

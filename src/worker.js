// Cloudflare Worker：POST /api/chat → Poe OpenAI 相容 API。Key 只喺 Secret POE_API_KEY。
const POE_URL = 'https://api.poe.com/v1/chat/completions';
const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED = ['Claude-Haiku-5.5', 'Claude-Sonnet-5.5'];

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/api/chat') return env.ASSETS.fetch(request);
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    const len = Number(request.headers.get('content-length') || 0);
    if (len > MAX_BYTES) return json({ error: '相片太大，請壓縮後再試' }, 413);
    const key = String(env.POE_API_KEY || '').trim();
    if (!key) return json({ error: '未設定 POE_API_KEY（Cloudflare → Settings → Variables and Secrets）' }, 503);

    let body;
    try {
      const text = await request.text();
      if (text.length > MAX_BYTES) return json({ error: '相片太大，請壓縮後再試' }, 413);
      body = JSON.parse(text);
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

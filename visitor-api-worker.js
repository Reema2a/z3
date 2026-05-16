// Cloudflare Worker بسيط لتتبع عدد الزوار الحقيقيين.
// يحتاج KV Namespace باسم VISITORS_KV مربوط بالـ Worker.
// بعد النشر ضع الرابط في index.html:
// window.REEMA_VISITOR_API_URL = "https://YOUR-WORKER.workers.dev/visit";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json; charset=utf-8",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (url.pathname !== "/visit" || request.method !== "POST") {
      return new Response(JSON.stringify({ ok: false, error: "not_found" }), { status: 404, headers: cors });
    }
    let data = {};
    try { data = await request.json(); } catch (_) {}
    const visitorId = String(data.visitorId || "").slice(0, 120);
    if (!visitorId) return new Response(JSON.stringify({ ok: false, error: "missing_visitor_id" }), { status: 400, headers: cors });

    const visitorKey = `visitor:${visitorId}`;
    const existed = await env.VISITORS_KV.get(visitorKey);
    if (!existed) {
      await env.VISITORS_KV.put(visitorKey, JSON.stringify({ firstSeen: new Date().toISOString(), ua: data.userAgent || "" }));
      const oldCount = Number(await env.VISITORS_KV.get("totalVisitors") || "0");
      await env.VISITORS_KV.put("totalVisitors", String(oldCount + 1));
    }

    await env.VISITORS_KV.put(`hit:${Date.now()}:${visitorId}`, JSON.stringify({ ...data, ipCountry: request.cf?.country || "" }), { expirationTtl: 60 * 60 * 24 * 30 });
    const totalVisitors = Number(await env.VISITORS_KV.get("totalVisitors") || "0");
    return new Response(JSON.stringify({ ok: true, totalVisitors }), { headers: cors });
  }
};

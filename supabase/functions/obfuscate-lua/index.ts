import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LUAST_BASE = "https://luast.clv.cloud";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const token = Deno.env.get("LUAST_API_TOKEN");
    if (!token) {
      return new Response(JSON.stringify({ error: "LUAST_API_TOKEN not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const {
      code,
      preset = "level3",
      outputStyle = "compact",
      disable,
      options,
      batch,
      scripts,
    } = body ?? {};

    const isBatch = batch === true || Array.isArray(scripts);
    const endpoint = isBatch ? "/api/v1/obfuscate/batch" : "/api/v1/obfuscate";

    if (!isBatch && (typeof code !== "string" || !code.trim())) {
      return new Response(JSON.stringify({ error: "Field 'code' wajib diisi" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: Record<string, unknown> = isBatch
      ? { preset, outputStyle, disable, options, scripts }
      : { code, preset, outputStyle, disable, options };

    // strip undefined
    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

    const upstream = await fetch(`${LUAST_BASE}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const text = await upstream.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!upstream.ok) {
      return new Response(
        JSON.stringify({ error: (data as any)?.error || `Upstream ${upstream.status}`, detail: data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

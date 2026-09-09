import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const noCacheHeaders = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
  Vary: "Accept, User-Agent, Sec-Fetch-Mode, Sec-Fetch-Dest, Sec-CH-UA, Upgrade-Insecure-Requests, X-Requested-With",
};

function isExecutorRequest(req: Request): boolean {
  const userAgent = (req.headers.get("user-agent") || "").toLowerCase();
  const accept = (req.headers.get("accept") || "").toLowerCase();
  const secFetchMode = req.headers.get("sec-fetch-mode");
  const secFetchDest = req.headers.get("sec-fetch-dest");
  const xRequestedWith = (req.headers.get("x-requested-with") || "").toLowerCase();

  const executorUaPattern = /(roblox|wininet|synapse|fluxus|krnl|script-ware|delta|lua|executor|httpclient|curl|okhttp)/;
  const looksLikeApiClient = !secFetchMode && !secFetchDest && !accept.includes("text/html");

  return executorUaPattern.test(userAgent) || xRequestedWith === "roblox" || looksLikeApiClient;
}

function isBrowser(req: Request): boolean {
  if (isExecutorRequest(req)) return false;

  const secFetchMode = req.headers.get("sec-fetch-mode");
  const secFetchDest = req.headers.get("sec-fetch-dest");
  const secChUa = req.headers.get("sec-ch-ua");
  const upgrade = req.headers.get("upgrade-insecure-requests");
  const accept = (req.headers.get("accept") || "").toLowerCase();

  const isNavigation = secFetchMode === "navigate" || secFetchDest === "document";
  const hasBrowserHints = Boolean(secFetchMode || secFetchDest || secChUa || upgrade);
  const acceptsHtml = accept.includes("text/html");

  return isNavigation || hasBrowserHints || acceptsHtml;
}

// ===== Game Tab Manifest (kategori upload: crack / random / game) =====
const GAME_TAB_CATEGORIES = ["crack", "random", "game"];

/** Minify Lua: buang komentar & rapatkan jadi satu baris. Aman untuk string & komentar panjang. */
function minifyLua(src: string): string {
  let out = "";
  let i = 0;
  const n = src.length;

  const readLongBracket = (start: number): { text: string; end: number } | null => {
    if (src[start] !== "[") return null;
    let j = start + 1;
    let eq = 0;
    while (src[j] === "=") { eq++; j++; }
    if (src[j] !== "[") return null;
    const close = "]" + "=".repeat(eq) + "]";
    const endIdx = src.indexOf(close, j + 1);
    const end = endIdx === -1 ? n : endIdx + close.length;
    return { text: src.slice(start, end), end };
  };

  while (i < n) {
    const c = src[i]!;

    if (c === "-" && src[i + 1] === "-") {
      const lb = readLongBracket(i + 2);
      if (lb) { i = lb.end; out += " "; continue; }
      while (i < n && src[i] !== "\n") i++;
      out += " ";
      continue;
    }

    if (c === "[") {
      const lb = readLongBracket(i);
      if (lb) { out += lb.text; i = lb.end; continue; }
    }

    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n) {
        if (src[j] === "\\") { j += 2; continue; }
        if (src[j] === c) { j++; break; }
        j++;
      }
      out += src.slice(i, j);
      i = j;
      continue;
    }

    if (c === " " || c === "\t" || c === "\r" || c === "\n") {
      if (!out.endsWith(" ")) out += " ";
      i++;
      continue;
    }

    out += c;
    i++;
  }

  return out.replace(/\s+/g, " ").trim();
}

function luaStr(v: string): string {
  return '"' + v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r/g, "").replace(/\n/g, "\\n") + '"';
}

async function buildGameManifest(
  supabase: ReturnType<typeof createClient>,
  categoryFilter: string,
  format: string,
): Promise<Response> {
  const { data, error } = await supabase
    .from("lua_scripts")
    .select("id, name, display_name, description, category, content, raw_content, plain_content, is_active, archived, updated_at")
    .eq("is_active", true)
    .limit(500);

  if (error) throw error;

  const wanted = categoryFilter ? [categoryFilter] : GAME_TAB_CATEGORIES;
  const rows = ((data as any[]) ?? []).filter((r) => {
    if (r.archived) return false;
    const cat = String(r.category || "").toLowerCase().trim();
    return wanted.includes(cat);
  });

  const entries = rows
    .map((r) => {
      const source: string = r.plain_content || r.raw_content || r.content || "";
      return {
        id: r.id,
        name: r.display_name || r.name,
        desc: r.description || `Script Premium Arexans ${r.display_name || r.name}`,
        category: String(r.category || "").toLowerCase(),
        code: minifyLua(source),
      };
    })
    .filter((e) => e.code.length > 0);

  if (format === "json") {
    return new Response(JSON.stringify({ success: true, count: entries.length, scripts: entries }), {
      status: 200,
      headers: { ...corsHeaders, ...noCacheHeaders, "Content-Type": "application/json" },
    });
  }

  const body = entries
    .map(
      (e) =>
        `{name=${luaStr(e.name)},desc=${luaStr(e.desc)},category=${luaStr(e.category)},callback=function() ${e.code} end}`,
    )
    .join(",\n");

  const lua =
    `-- Arexans Game Tab Manifest (auto-generated)\n` +
    `-- Total: ${entries.length} script | kategori: ${wanted.join(", ")}\n` +
    `return {\n${body}\n}\n`;

  return new Response(lua, {
    status: 200,
    headers: { ...corsHeaders, ...noCacheHeaders, "Content-Type": "text/plain; charset=utf-8" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { ...corsHeaders, ...noCacheHeaders } });
  }

  try {
    const url = new URL(req.url);
    const scriptName = url.searchParams.get("name");
    const rawParam = (url.searchParams.get("raw") || "").toLowerCase();
    const forceRaw = rawParam === "1" || rawParam === "true";
    const payloadParam = (url.searchParams.get("payload") || "").toLowerCase();
    const wantPayload = payloadParam === "1" || payloadParam === "true";
    const slotParam = (url.searchParams.get("slot") || "primary").toLowerCase();
    const useBackup = slotParam === "backup";
    const manifestParam = (url.searchParams.get("manifest") || "").toLowerCase();
    const wantManifest =
      manifestParam === "1" || manifestParam === "true" || (scriptName || "").toLowerCase() === "gametab";
    const formatParam = (url.searchParams.get("format") || "lua").toLowerCase();
    const categoryFilter = (url.searchParams.get("category") || "").toLowerCase().trim();

    if (wantManifest) {
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      return await buildGameManifest(sb, categoryFilter, formatParam);
    }

    if (!scriptName) {
      return new Response("-- Access Denied: Invalid request", {
        status: 403,
        headers: { ...corsHeaders, ...noCacheHeaders, "Content-Type": "text/plain; charset=utf-8" },
      });
    }


    if (!forceRaw && !wantPayload && isBrowser(req)) {
      const deniedUrl = `https://tools.arexans.my.id/access-denied?name=${encodeURIComponent(scriptName)}`;
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          ...noCacheHeaders,
          Location: deniedUrl,
        },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: script, error } = await supabase
      .from("lua_scripts")
      .select("content, backup_content, raw_content, is_active")
      .eq("name", scriptName)
      .eq("is_active", true)
      .maybeSingle();

    if (error || !script) {
      return new Response('warn("[Arexans] Script not available")', {
        status: 200,
        headers: { ...corsHeaders, ...noCacheHeaders, "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const activeContent = useBackup
      ? ((script as any).backup_content || script.content || "")
      : (script.content || "");

    if (wantPayload) {
      let payload: string | null = useBackup ? null : ((script as any).raw_content ?? null);
      if (!payload) {
        const marker = "-- USER SCRIPT (PROTECTED)";
        const idx = activeContent.indexOf(marker);
        if (idx !== -1) {
          const after = activeContent.substring(idx + marker.length);
          const nl = after.indexOf("\n");
          payload = nl !== -1 ? after.substring(nl + 1) : after;
        } else {
          payload = activeContent;
        }
      }
      return new Response(payload, {
        status: 200,
        headers: { ...corsHeaders, ...noCacheHeaders, "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    return new Response(activeContent, {
      status: 200,
      headers: { ...corsHeaders, ...noCacheHeaders, "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error: unknown) {
    console.error("Error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(`warn("[Arexans] Error: ${msg.replaceAll('"', "'")}")`, {
      status: 200,
      headers: { ...corsHeaders, ...noCacheHeaders, "Content-Type": "text/plain; charset=utf-8" },
    });
  }
});

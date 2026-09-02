import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const noCacheHeaders = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
};

function isBrowser(req: Request): boolean {
  const ua = (req.headers.get("user-agent") || "").toLowerCase();
  const accept = (req.headers.get("accept") || "").toLowerCase();
  const secFetchMode = req.headers.get("sec-fetch-mode");
  const secFetchDest = req.headers.get("sec-fetch-dest");
  const secChUa = req.headers.get("sec-ch-ua");

  const executorUaPattern = /(roblox|wininet|synapse|fluxus|krnl|script-ware|delta|lua|executor|httpclient|curl|okhttp)/;
  if (executorUaPattern.test(ua)) return false;

  return Boolean(secFetchMode === "navigate" || secFetchDest === "document" || secChUa || accept.includes("text/html"));
}

function generateFakeScript(): string {
  const code = () => Math.floor(1000 + Math.random() * 9000);
  const fakeScripts = [
    `-- Arexans Tools :: Protected Endpoint\nlocal _c = "AX-${code()}"\nprint("[Arexans] Handshake...")\ntask.wait(1)\nprint("[Arexans] Verifying signature...")\ntask.wait(1.2)\nwarn("[Arexans] ACCESS DENIED — invalid session token")\nwarn("[Arexans] Error Code: " .. _c)\nreturn`,
    `-- Protected Script Container\nlocal S={} S.__index=S\nfunction S.new() return setmetatable({a=0},S) end\nfunction S:validate() self.a=self.a+1 print("[Security] Validating ("..self.a..")") task.wait(1.4) warn("[Security] ACCESS DENIED — license not found") return false end\nlocal s=S.new()\nif not s:validate() then return end`,
    `-- ArexansTools Loader\nwarn("[Arexans] 403 ACCESS DENIED")\nwarn("[Arexans] This endpoint is protected by @arexans")\nwarn("[Arexans] Ref: AX-${code()}")\nreturn`,
  ];
  return fakeScripts[Math.floor(Math.random() * fakeScripts.length)];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { ...corsHeaders, ...noCacheHeaders } });
  }

  // Browser membuka link langsung → arahkan ke halaman Access Denied domain sendiri
  if (isBrowser(req)) {
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        ...noCacheHeaders,
        Location: "https://tools.arexans.my.id/access-denied?name=protected",
      },
    });
  }

  return new Response(generateFakeScript(), {
    status: 200,
    headers: { ...corsHeaders, ...noCacheHeaders, "Content-Type": "text/plain; charset=utf-8" },
  });
});

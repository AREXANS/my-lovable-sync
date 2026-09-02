import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, range",
};

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    // Supports /functions/v1/media/<file> and /media/<file>
    const marker = "/media/";
    const idx = url.pathname.indexOf(marker);
    let path = idx >= 0 ? url.pathname.slice(idx + marker.length) : "";
    if (!path) path = url.searchParams.get("path") || "";
    path = decodeURIComponent(path).replace(/^\/+/, "");

    if (!path || path.includes("..")) {
      return new Response("Not found", { status: 404, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase.storage.from("media").download(path);
    if (error || !data) {
      return new Response("Not found", { status: 404, headers: corsHeaders });
    }

    const ext = path.split(".").pop()?.toLowerCase() || "";
    const contentType = data.type && data.type !== "application/octet-stream"
      ? data.type
      : (MIME[ext] || "application/octet-stream");

    return new Response(data.stream(), {
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (_e) {
    return new Response("Error", { status: 500, headers: corsHeaders });
  }
});

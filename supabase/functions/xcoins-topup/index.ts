import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json();
    const { userId, amount, gateway: requestedGateway } = body;

    if (!userId || !amount || amount < 1000) {
      return new Response(JSON.stringify({ error: "Minimal top-up Rp 1.000" }), 
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: settings } = await supabase
      .from("app_settings").select("key, value")
      .in("key", ["payment_gateway", "pakasir_slug", "pakasir_api_key", "pakasir_mode", "cashify_license_key", "cashify_qris_id"]);

    const s = Object.fromEntries((settings || []).map((r: any) => [r.key, r.value]));
    const gatewaySetting = s.payment_gateway || "pakasir";
    let gateway = gatewaySetting;
    if (gatewaySetting === "both") {
      gateway = (requestedGateway === "cashify" || requestedGateway === "pakasir") ? requestedGateway : "cashify";
    }
    const pakasirMode = s.pakasir_mode || "sandbox";

    const orderId = `TOPUP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    let qrString = "";
    let qrisUrl = "";
    let totalAmount = amount;

    if (gateway === "cashify" && s.cashify_license_key) {
      // === CASHIFY QRIS (v1 API) ===
      try {
        const cashifyBody = {
          id: s.cashify_qris_id || "",
          amount,
          useUniqueCode: true,
          packageIds: ["id.dana"],
          expiredInMinutes: 15,
        };

        const res = await fetch("https://api.casaku.id/api/generate/qris", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-license-key": s.cashify_license_key,
          },
          body: JSON.stringify(cashifyBody),
        });
        const data = await res.json();
        console.log("Cashify topup response:", JSON.stringify(data));

        if (data.status === 200 && data.data) {
          qrString = data.data.qr_string || "";
          totalAmount = data.data.totalAmount || amount;
          qrisUrl = `https://larabert-qrgen.hf.space/v1/create-qr-code?size=500x500&style=2&color=0D8BA5&data=${encodeURIComponent(qrString)}`;
          if (data.data.transactionId) {
            await supabase.from("app_settings").upsert({
              key: `cashify_tx_${orderId}`, value: data.data.transactionId,
              description: "Cashify topup tx mapping"
            }, { onConflict: "key" });
          }
        } else {
          return new Response(JSON.stringify({ error: data.message || "Gagal generate QRIS Cashify" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      } catch (err) {
        console.error("Cashify error:", err);
        return new Response(JSON.stringify({ error: "Gagal menghubungi Cashify" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } else if (gateway === "pakasir" && pakasirMode === "live" && s.pakasir_slug && s.pakasir_api_key) {
      // === PAKASIR LIVE QRIS ===
      try {
        const pakasirRes = await fetch("https://app.pakasir.com/api/transactioncreate/qris", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project: s.pakasir_slug,
            order_id: orderId,
            amount,
            api_key: s.pakasir_api_key,
          }),
        });
        const pakasirData = await pakasirRes.json();
        console.log("Pakasir topup response:", JSON.stringify(pakasirData));

        if (pakasirData.payment) {
          qrString = pakasirData.payment.payment_number || "";
          totalAmount = pakasirData.payment.total_payment || amount;
          qrisUrl = `https://larabert-qrgen.hf.space/v1/create-qr-code?size=500x500&style=2&color=0D8BA5&data=${encodeURIComponent(qrString)}`;
        } else {
          return new Response(JSON.stringify({ error: pakasirData.message || "Gagal generate QRIS" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      } catch (err) {
        console.error("Pakasir error:", err);
        return new Response(JSON.stringify({ error: "Gagal menghubungi Pakasir" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } else {
      qrString = `DEMO-${orderId}`;
      qrisUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=DEMO-${orderId}`;
    }

    await supabase.from("transactions").insert({
      transaction_id: orderId,
      customer_name: "Deposit XCoins",
      package_name: "Deposit XCoins",
      package_duration: 0,
      original_amount: amount,
      total_amount: totalAmount,
      status: "pending",
      qr_string: qrString,
      license_key: userId,
      expires_at: expiresAt.toISOString(),
    });

    return new Response(JSON.stringify({
      success: true, transactionId: orderId, qr_string: qrString, qris_url: qrisUrl,
      totalAmount, expiresAt: expiresAt.toISOString(), mode: gateway === "cashify" ? "live" : pakasirMode, gateway,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: unknown) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
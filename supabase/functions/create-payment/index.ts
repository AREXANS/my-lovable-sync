import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: settings } = await supabase
      .from("app_settings").select("key, value")
      .in("key", [
        "payment_gateway", "pakasir_slug", "pakasir_api_key", "pakasir_mode",
        "cashify_license_key", "cashify_qris_id", "payment_simulation"
      ]);

    const s = Object.fromEntries((settings || []).map((r: any) => [r.key, r.value]));
    const gatewaySetting = s.payment_gateway || "pakasir";
    const pakasirMode = s.pakasir_mode || "sandbox";

    // Capture IP address
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() 
      || req.headers.get("x-real-ip") 
      || req.headers.get("cf-connecting-ip") 
      || "unknown";

    const body = await req.json();
    const { amount, customerName, packageName, packageDuration, licenseKey: customerLicenseKey, promoCode, customerWhatsapp, deviceId, gateway: requestedGateway } = body;

    // When admin enables both gateways, honor user's pick from frontend; otherwise use the single configured gateway.
    let gateway = gatewaySetting;
    if (gatewaySetting === "both") {
      gateway = (requestedGateway === "cashify" || requestedGateway === "pakasir") ? requestedGateway : "cashify";
    }

    if (!amount || amount < 1000) {
      return new Response(JSON.stringify({ error: "Amount must be at least 1000" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const orderId = `TRX-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    let qrString = "";
    let qrisUrl = "";
    let totalAmount = amount;

    if (gateway === "cashify" && s.cashify_license_key) {
      // === CASHIFY QRIS (v1 API - /api/generate/qris) ===
      try {
        const cashifyBody: any = {
          id: s.cashify_qris_id || "",
          amount: amount,
          useUniqueCode: true,
          packageIds: ["id.dana"],
          expiredInMinutes: 15,
        };

        console.log("Cashify request body:", JSON.stringify(cashifyBody));

        const cashifyRes = await fetch("https://api.casaku.id/api/generate/qris", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-license-key": s.cashify_license_key,
          },
          body: JSON.stringify(cashifyBody),
        });

        const rawText = await cashifyRes.text();
        let cashifyData: any = null;
        try { cashifyData = JSON.parse(rawText); } catch { cashifyData = null; }
        console.log("Cashify response status:", cashifyRes.status, "body preview:", rawText.slice(0, 200));

        if (!cashifyData || cashifyData.status !== 200 || !cashifyData.data) {
          const msg = (cashifyData && cashifyData.message) || `Layanan Cashify tidak merespon (HTTP ${cashifyRes.status})`;
          const isSubIssue = !cashifyData || /langganan|subscription|pricing|unauthor|forbidden|<!doctype|<html/i.test(rawText) || /langganan|subscription|pricing|unauthor|forbidden/i.test(msg);
          return new Response(JSON.stringify({
            success: false,
            fallback: true,
            error: isSubIssue
              ? "Layanan pembayaran Cashify sedang tidak aktif (langganan kedaluwarsa). Silakan hubungi admin atau coba gateway lain."
              : msg,
          }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        {
          qrString = cashifyData.data.qr_string || "";
          totalAmount = cashifyData.data.totalAmount || amount;
          qrisUrl = `https://larabert-qrgen.hf.space/v1/create-qr-code?size=500x500&style=2&color=0D8BA5&data=${encodeURIComponent(qrString)}`;
          
          // Store cashify transactionId for status checking
          const cashifyTxId = cashifyData.data.transactionId;
          if (cashifyTxId) {
            await supabase.from("app_settings").upsert({
              key: `cashify_tx_${orderId}`,
              value: cashifyTxId,
              description: "Cashify transaction mapping"
            }, { onConflict: "key" });
          }
        }
      } catch (err) {
        console.error("Cashify API error:", err);
        return new Response(JSON.stringify({
          success: false,
          fallback: true,
          error: "Gagal menghubungi Cashify. Layanan sedang tidak tersedia, silakan coba gateway lain.",
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

    } else if (gateway === "pakasir" && pakasirMode === "live" && s.pakasir_slug && s.pakasir_api_key) {
      // === PAKASIR LIVE QRIS ===
      // Docs: POST https://app.pakasir.com/api/transactioncreate/qris
      // Body: { project, order_id, amount, api_key }
      try {
        const pakasirBody = {
          project: s.pakasir_slug,
          order_id: orderId,
          amount: amount,
          api_key: s.pakasir_api_key,
        };

        console.log("Pakasir request:", JSON.stringify(pakasirBody));

        const pakasirRes = await fetch("https://app.pakasir.com/api/transactioncreate/qris", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pakasirBody),
        });

        const pakasirData = await pakasirRes.json();
        console.log("Pakasir response:", JSON.stringify(pakasirData));

        if (pakasirData.payment) {
          // Response: { payment: { payment_number, total_payment, expired_at, ... } }
          qrString = pakasirData.payment.payment_number || "";
          totalAmount = pakasirData.payment.total_payment || amount;
          qrisUrl = `https://larabert-qrgen.hf.space/v1/create-qr-code?size=500x500&style=2&color=0D8BA5&data=${encodeURIComponent(qrString)}`;
        } else {
          return new Response(JSON.stringify({ error: pakasirData.message || "Gagal membuat transaksi Pakasir" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      } catch (err) {
        console.error("Pakasir API error:", err);
        return new Response(JSON.stringify({ error: "Gagal menghubungi Pakasir" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } else {
      // Demo/sandbox mode
      qrString = `DEMO-${orderId}`;
      qrisUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=DEMO-${orderId}`;
    }

    // Save transaction
    await supabase.from("transactions").insert({
      transaction_id: orderId,
      customer_name: customerName || "Customer",
      customer_whatsapp: customerWhatsapp || null,
      package_name: packageName || "NORMAL",
      package_duration: packageDuration || 1,
      original_amount: amount,
      total_amount: totalAmount,
      status: "pending",
      qr_string: qrString,
      license_key: customerLicenseKey || null,
      expires_at: expiresAt.toISOString(),
      device_id: deviceId || null,
      ip_address: clientIp,
    });

    return new Response(JSON.stringify({
      success: true,
      transactionId: orderId,
      qr_string: qrString,
      qris_url: qrisUrl,
      originalAmount: amount,
      totalAmount: totalAmount,
      expiresAt: expiresAt.toISOString(),
      mode: gateway === "cashify" ? "live" : pakasirMode,
      gateway,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: unknown) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
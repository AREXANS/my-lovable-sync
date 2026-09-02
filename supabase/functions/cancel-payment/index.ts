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
    const { transactionId } = await req.json();

    if (!transactionId) {
      return new Response(JSON.stringify({ error: "Transaction ID required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: settings } = await supabase
      .from("app_settings").select("key, value")
      .in("key", ["payment_gateway", "pakasir_slug", "pakasir_api_key", "pakasir_mode", "cashify_license_key"]);

    const s = Object.fromEntries((settings || []).map((r: any) => [r.key, r.value]));
    const gateway = s.payment_gateway || "pakasir";

    if (gateway === "cashify" && s.cashify_license_key) {
      // === CASHIFY: Cancel status ===
      // Docs: POST https://api.casaku.id/api/generate/cancel-status
      // Body: { transactionId }
      try {
        const { data: mapping } = await supabase
          .from("app_settings").select("value").eq("key", `cashify_tx_${transactionId}`).maybeSingle();

        if (mapping?.value) {
          const res = await fetch("https://api.casaku.id/api/generate/cancel-status", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-license-key": s.cashify_license_key,
            },
            body: JSON.stringify({ transactionId: mapping.value }),
          });
          const data = await res.json();
          console.log("Cashify cancel response:", JSON.stringify(data));
          // Clean up mapping
          await supabase.from("app_settings").delete().eq("key", `cashify_tx_${transactionId}`);
        }
      } catch (err) {
        console.error("Cashify cancel error:", err);
      }
    } else if (gateway === "pakasir" && s.pakasir_mode === "live" && s.pakasir_slug && s.pakasir_api_key) {
      // === PAKASIR: Transaction cancel ===
      // Docs: POST https://app.pakasir.com/api/transactioncancel
      // Body: { project, order_id, amount, api_key }
      try {
        // Get transaction amount for the cancel request
        const { data: tx } = await supabase
          .from("transactions").select("total_amount").eq("transaction_id", transactionId).maybeSingle();

        const cancelBody = {
          project: s.pakasir_slug,
          order_id: transactionId,
          amount: tx?.total_amount || 0,
          api_key: s.pakasir_api_key,
        };

        const res = await fetch("https://app.pakasir.com/api/transactioncancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cancelBody),
        });
        const data = await res.json();
        console.log("Pakasir cancel response:", JSON.stringify(data));
      } catch (err) {
        console.error("Pakasir cancel error:", err);
      }
    }

    await supabase.from("transactions").update({ status: "cancelled" }).eq("transaction_id", transactionId);

    return new Response(JSON.stringify({ success: true, message: "Transaction cancelled" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: unknown) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
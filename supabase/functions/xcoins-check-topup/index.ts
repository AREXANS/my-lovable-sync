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
    const { transactionId, userId } = await req.json();

    if (!transactionId || !userId) {
      return new Response(JSON.stringify({ error: "Missing data" }), 
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: tx } = await supabase.from('transactions')
      .select('*').eq('transaction_id', transactionId).eq('package_name', 'XCOINS_TOPUP').maybeSingle();

    if (!tx) {
      return new Response(JSON.stringify({ error: "Transaction not found" }), 
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (tx.expires_at && new Date(tx.expires_at) < new Date() && tx.status === 'pending') {
      await supabase.from('transactions').update({ status: 'expired' }).eq('id', tx.id);
      return new Response(JSON.stringify({ expired: true }), 
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (tx.status === 'paid') {
      const { data: user } = await supabase.from('xcoins_balances').select('balance').eq('id', userId).single();
      return new Response(JSON.stringify({ paid: true, balance: user?.balance || 0 }), 
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: settings } = await supabase
      .from("app_settings").select("key, value")
      .in("key", ["payment_gateway", "pakasir_slug", "pakasir_api_key", "pakasir_mode", "cashify_license_key", "payment_simulation"]);

    const s = Object.fromEntries((settings || []).map((r: any) => [r.key, r.value]));
    const gateway = s.payment_gateway || "pakasir";
    const pakasirMode = s.pakasir_mode || "sandbox";
    const simulation = s.payment_simulation || "off";

    let isPaid = false;

    if (gateway === "cashify" && s.cashify_license_key) {
      // Cashify check-status
      try {
        const { data: mapping } = await supabase
          .from("app_settings").select("value").eq("key", `cashify_tx_${transactionId}`).maybeSingle();
        if (mapping?.value) {
          const res = await fetch("https://api.casaku.id/api/generate/check-status", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-license-key": s.cashify_license_key },
            body: JSON.stringify({ transactionId: mapping.value }),
          });
          const data = await res.json();
          console.log("Cashify topup check:", JSON.stringify(data));
          if (data.status === 200 && data.data && (data.data.status === "paid" || data.data.status === "success")) {
            isPaid = true;
          }
        }
      } catch (err) {
        console.error("Cashify check error:", err);
      }
    } else if (gateway === "pakasir" && pakasirMode === "live" && s.pakasir_slug && s.pakasir_api_key) {
      // Pakasir transaction detail
      try {
        const url = `https://app.pakasir.com/api/transactiondetail?project=${encodeURIComponent(s.pakasir_slug)}&amount=${tx.total_amount}&order_id=${encodeURIComponent(transactionId)}&api_key=${encodeURIComponent(s.pakasir_api_key)}`;
        const res = await fetch(url);
        const data = await res.json();
        console.log("Pakasir topup check:", JSON.stringify(data));
        if (data.transaction?.status === "completed") isPaid = true;
      } catch (err) {
        console.error("Pakasir check error:", err);
      }
    }

    if (simulation === "on") isPaid = true;

    if (gateway === "pakasir" && (pakasirMode === "sandbox" || pakasirMode === "demo")) {
      if (Date.now() - new Date(tx.created_at).getTime() > 5000) isPaid = true;
    }

    if (isPaid) {
      await supabase.from('transactions').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', tx.id);

      const { data: user } = await supabase.from('xcoins_balances').select('balance').eq('id', userId).single();
      const xcoinsAmount = tx.original_amount;
      const newBalance = (user?.balance || 0) + xcoinsAmount;

      await supabase.from('xcoins_balances').update({ balance: newBalance, updated_at: new Date().toISOString() }).eq('id', userId);

      await supabase.from('xcoins_transactions').insert({
        user_id: userId, type: 'topup', amount: xcoinsAmount,
        balance_after: newBalance, description: `Deposit ${xcoinsAmount} XCoins`,
        reference_id: transactionId
      });

      // Clean up cashify mapping
      if (gateway === "cashify") {
        await supabase.from("app_settings").delete().eq("key", `cashify_tx_${transactionId}`);
      }

      return new Response(JSON.stringify({ paid: true, balance: newBalance, added: xcoinsAmount }), 
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ paid: false, status: tx.status }), 
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: unknown) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
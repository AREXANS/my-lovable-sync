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

    const { data: transaction } = await supabase
      .from("transactions").select("*").eq("transaction_id", transactionId).maybeSingle();

    if (!transaction) {
      return new Response(JSON.stringify({ error: "Transaction not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (transaction.status === "paid" || transaction.status === "claimed") {
      return new Response(JSON.stringify({ success: true, paid: true, transaction }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (transaction.expires_at && new Date(transaction.expires_at) < new Date()) {
      await supabase.from("transactions").update({ status: "expired" }).eq("transaction_id", transactionId);
      return new Response(JSON.stringify({ success: false, paid: false, expired: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: settings } = await supabase
      .from("app_settings").select("key, value")
      .in("key", [
        "payment_gateway", "pakasir_slug", "pakasir_api_key", "pakasir_mode",
        "cashify_license_key", "payment_simulation", "discord_webhook_url"
      ]);

    const s = Object.fromEntries((settings || []).map((r: any) => [r.key, r.value]));
    const gateway = s.payment_gateway || "pakasir";
    const pakasirMode = s.pakasir_mode || "sandbox";
    const simulation = s.payment_simulation || "off";

    let isPaid = false;

    if (gateway === "cashify" && s.cashify_license_key) {
      // === CASHIFY: Check status ===
      // Docs: POST https://api.casaku.id/api/generate/check-status
      // Body: { transactionId }
      // Response: { status: 200, data: { transactionId, amount, status: "paid"|"pending", expiredAt } }
      try {
        const { data: mapping } = await supabase
          .from("app_settings").select("value").eq("key", `cashify_tx_${transactionId}`).maybeSingle();

        if (mapping?.value) {
          const res = await fetch("https://api.casaku.id/api/generate/check-status", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-license-key": s.cashify_license_key,
            },
            body: JSON.stringify({ transactionId: mapping.value }),
          });
          const data = await res.json();
          console.log("Cashify check-status response:", JSON.stringify(data));
          if (data.status === 200 && data.data) {
            if (data.data.status === "paid" || data.data.status === "success") {
              isPaid = true;
            }
          }
        }
      } catch (err) {
        console.error("Cashify check error:", err);
      }
    } else if (gateway === "pakasir" && pakasirMode === "live" && s.pakasir_slug && s.pakasir_api_key) {
      // === PAKASIR: Transaction detail ===
      // Docs: GET https://app.pakasir.com/api/transactiondetail?project={slug}&amount={amount}&order_id={order_id}&api_key={api_key}
      // Response: { transaction: { amount, order_id, project, status: "completed", payment_method, completed_at } }
      try {
        // Pakasir expects the ORIGINAL amount (before fee), not total_payment
        const pakasirAmount = transaction.original_amount || transaction.total_amount;
        const url = `https://app.pakasir.com/api/transactiondetail?project=${encodeURIComponent(s.pakasir_slug)}&amount=${pakasirAmount}&order_id=${encodeURIComponent(transactionId)}&api_key=${encodeURIComponent(s.pakasir_api_key)}`;
        const res = await fetch(url);
        const data = await res.json();
        console.log("Pakasir transactiondetail response:", JSON.stringify(data));
        const pkStatus = String(data.transaction?.status || "").toLowerCase();
        if (["completed", "paid", "success", "settled"].includes(pkStatus)) {
          isPaid = true;
        }
      } catch (err) {
        console.error("Pakasir check error:", err);
      }
    }

    // Simulation mode
    if (simulation === "on") isPaid = true;

    // Demo/sandbox auto-pay after 5s (Pakasir sandbox)
    if (gateway === "pakasir" && (pakasirMode === "sandbox" || pakasirMode === "demo")) {
      const elapsed = Date.now() - new Date(transaction.created_at).getTime();
      if (elapsed > 5000) isPaid = true;
    }

    if (isPaid) {
      await supabase.from("transactions").update({ status: "claimed", paid_at: new Date().toISOString() })
        .eq("transaction_id", transactionId);

      // Create license key directly (no separate HTTP call)
      if (transaction.license_key && transaction.package_name !== "XCOINS_TOPUP") {
        await createLicenseKey(supabase, transaction);
      }

      // Clean up cashify mapping
      if (gateway === "cashify") {
        await supabase.from("app_settings").delete().eq("key", `cashify_tx_${transactionId}`);
      }

      if (s.discord_webhook_url) {
        await sendDiscordNotification(transaction, s.discord_webhook_url);
      }

      return new Response(JSON.stringify({ success: true, paid: true, transaction: { ...transaction, status: "claimed" } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true, paid: false, transaction }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: unknown) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

async function createLicenseKey(supabase: any, transaction: any) {
  try {
    const key = transaction.license_key;
    if (!key) return;

    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "license_keys")
      .maybeSingle();

    let keys = [];
    if (data) {
      try { keys = JSON.parse(data.value || "[]"); } catch { keys = []; }
    }

    const existingIdx = keys.findIndex((k: any) => k.key === key);
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + (Number(transaction.package_duration) || 30));

    if (existingIdx >= 0) {
      const existing = keys[existingIdx];
      const currentExpiry = new Date(existing.expired);
      const now = new Date();
      const baseDate = currentExpiry > now ? currentExpiry : now;
      baseDate.setDate(baseDate.getDate() + (Number(transaction.package_duration) || 30));
      keys[existingIdx].expired = baseDate.toISOString();
      keys[existingIdx].role = transaction.package_name || existing.role;
      console.log(`Extended key ${key} to ${baseDate.toISOString()}`);
    } else {
      keys.push({
        key,
        expired: expiryDate.toISOString(),
        created: new Date().toISOString(),
        role: transaction.package_name || "NORMAL",
        maxHwid: 1,
        frozenUntil: null,
        frozenRemainingMs: null,
        hwids: [],
        robloxUsers: []
      });
      console.log(`Created new key ${key}, expires ${expiryDate.toISOString()}`);
    }

    await supabase
      .from("app_settings")
      .upsert({
        key: "license_keys",
        value: JSON.stringify(keys),
        updated_at: new Date().toISOString(),
        description: "License keys database"
      }, { onConflict: "key" });

    console.log("License key saved successfully");
  } catch (error) {
    console.error("Create key error:", error);
  }
}

async function sendDiscordNotification(transaction: any, webhookUrl: string) {
  try {
    const embed = {
      title: "💰 Pembayaran Berhasil!",
      color: 0x00ff00,
      fields: [
        { name: "Transaction ID", value: transaction.transaction_id, inline: true },
        { name: "Customer", value: transaction.customer_name, inline: true },
        { name: "Package", value: `${transaction.package_name} (${transaction.package_duration} hari)`, inline: true },
        { name: "Amount", value: `Rp ${transaction.total_amount?.toLocaleString("id-ID") || 0}`, inline: true },
        { name: "License Key", value: transaction.license_key || "-", inline: false },
      ],
      timestamp: new Date().toISOString(),
    };
    await fetch(webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ embeds: [embed] }) });
  } catch (error) {
    console.error("Discord webhook error:", error);
  }
}
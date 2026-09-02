import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-key, x-webhook-signature",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

// Generic client-facing error to prevent enumeration / info leakage
function genericError(status = 400) {
  return new Response(JSON.stringify({ success: false, error: "Invalid request" }), { status, headers: jsonHeaders });
}
function okAck() {
  return new Response(JSON.stringify({ success: true }), { status: 200, headers: jsonHeaders });
}

async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return genericError(400);
    }

    // Detect source
    const isPakasir = !!body.order_id && !!body.project;
    const isCashify = !!body.transactionId && !body.project;

    if (isPakasir) {
      // === PAKASIR ===
      // Pakasir does NOT send a signature/webhook_key in the payload (see docs section D).
      // Per Pakasir's own recommendation, we authenticate by calling back the
      // Transaction Detail API with our secret api_key. If Pakasir confirms the
      // status is "completed" for this project+order_id+amount, the webhook is genuine.
      const transactionId = String(body.order_id || "");
      const webhookAmount = Number(body.amount || 0);
      const webhookProject = String(body.project || "");
      if (!transactionId || !webhookAmount) return genericError(400);

      const status = String(body.status || "").toLowerCase();
      const okStatuses = ["completed", "paid", "success", "settled"];
      if (!okStatuses.includes(status)) return okAck();

      const { data: transaction } = await supabase
        .from("transactions").select("*").eq("transaction_id", transactionId).maybeSingle();
      if (!transaction) return okAck();
      if (transaction.status === "paid" || transaction.status === "claimed") return okAck();

      // Verify by calling Pakasir back
      const { data: settings } = await supabase
        .from("app_settings").select("key, value").in("key", ["pakasir_slug", "pakasir_api_key"]);
      const s = Object.fromEntries((settings || []).map((r: any) => [r.key, r.value]));
      if (!s.pakasir_slug || !s.pakasir_api_key) {
        console.error("[payment-webhook] pakasir credentials missing");
        return genericError(503);
      }
      if (webhookProject && webhookProject !== s.pakasir_slug) {
        console.warn("[payment-webhook] pakasir project mismatch");
        return genericError(401);
      }

      // Use the amount the webhook reports (Pakasir matches on that value).
      // Fall back to our stored original_amount for the callback verification.
      const verifyAmount = webhookAmount || transaction.original_amount || transaction.total_amount;
      const verifyUrl = `https://app.pakasir.com/api/transactiondetail?project=${encodeURIComponent(s.pakasir_slug)}&amount=${verifyAmount}&order_id=${encodeURIComponent(transactionId)}&api_key=${encodeURIComponent(s.pakasir_api_key)}`;
      let verified = false;
      try {
        const res = await fetch(verifyUrl);
        const data = await res.json();
        const pkStatus = String(data?.transaction?.status || "").toLowerCase();
        verified = okStatuses.includes(pkStatus);
        console.log("[payment-webhook] pakasir verify", transactionId, pkStatus);
      } catch (err) {
        console.error("[payment-webhook] pakasir verify failed", err);
      }
      if (!verified) return genericError(401);

      await supabase.from("transactions").update({ status: "claimed", paid_at: new Date().toISOString() }).eq("id", transaction.id);
      await handlePostPayment(supabase, transaction);
      return okAck();
    }

    if (isCashify) {
      // === CASHIFY: webhook key mandatory ===
      const { data: whSetting } = await supabase
        .from("app_settings").select("value").eq("key", "cashify_webhook_key").maybeSingle();
      const expected = (whSetting?.value || "").toString().trim();
      if (!expected) {
        console.error("[payment-webhook] cashify_webhook_key not configured");
        return genericError(503);
      }
      const provided = (body.webhook_key || body.key || req.headers.get("x-webhook-key") || "").toString();
      if (!(await timingSafeEqual(provided, expected))) return genericError(401);

      const cashifyTxId = body.transactionId ? String(body.transactionId) : "";
      const status = String(body.status || "").toLowerCase();
      if (status !== "paid" && status !== "success" && status !== "completed" && status !== "settled") return okAck();
      if (!cashifyTxId) return genericError(400);

      // Require the mapping to exist (no amount-only lookups)
      const { data: mappings } = await supabase
        .from("app_settings").select("key, value").eq("value", cashifyTxId).like("key", "cashify_tx_%");

      if (!mappings || mappings.length === 0) {
        // Fallback: only accept when explicit reference is provided (never amount alone)
        const ref = body.ref || body.reference;
        if (ref) {
          const { data: tx } = await supabase.from("transactions").select("*").eq("transaction_id", String(ref)).maybeSingle();
          if (tx && tx.status !== "paid" && tx.status !== "claimed") {
            await supabase.from("transactions").update({ status: "claimed", paid_at: new Date().toISOString() }).eq("id", tx.id);
            await handlePostPayment(supabase, tx);
          }
        }
        return okAck();
      }

      for (const mapping of mappings) {
        const ourTxId = String(mapping.key).replace("cashify_tx_", "");
        const { data: transaction } = await supabase
          .from("transactions").select("*").eq("transaction_id", ourTxId).maybeSingle();
        if (transaction && transaction.status !== "paid" && transaction.status !== "claimed") {
          await supabase.from("transactions").update({ status: "claimed", paid_at: new Date().toISOString() }).eq("id", transaction.id);
          await handlePostPayment(supabase, transaction);
        }
        await supabase.from("app_settings").delete().eq("key", mapping.key);
      }
      return okAck();
    }

    // Generic fallback: REQUIRE explicit transaction identifier AND shared secret; NEVER match by amount.
    const { data: genSetting } = await supabase
      .from("app_settings").select("value").eq("key", "generic_webhook_key").maybeSingle();
    const expected = (genSetting?.value || "").toString().trim();
    if (!expected) return genericError(503);
    const provided = (body.webhook_key || body.key || req.headers.get("x-webhook-key") || "").toString();
    if (!(await timingSafeEqual(provided, expected))) return genericError(401);

    const transactionId = String(body.ref || body.transaction_id || body.reference || body.order_id || "");
    if (!transactionId) return genericError(400);

    const { data: transaction } = await supabase
      .from("transactions").select("*").eq("transaction_id", transactionId).maybeSingle();
    if (!transaction) return okAck();
    if (transaction.status !== "paid" && transaction.status !== "claimed") {
      await supabase.from("transactions").update({ status: "claimed", paid_at: new Date().toISOString() }).eq("id", transaction.id);
      await handlePostPayment(supabase, transaction);
    }
    return okAck();
  } catch (error: unknown) {
    // Log details server-side only; return generic message to caller.
    console.error("[payment-webhook] internal error", error);
    return new Response(JSON.stringify({ success: false, error: "Internal error" }), { status: 500, headers: jsonHeaders });
  }
});

async function handlePostPayment(supabase: any, transaction: any) {
  if (transaction.package_name === "XCOINS_TOPUP" && transaction.license_key) {
    const userId = transaction.license_key;
    const { data: user } = await supabase.from("xcoins_balances").select("balance").eq("id", userId).single();
    if (user) {
      const newBalance = (user.balance || 0) + transaction.original_amount;
      await supabase.from("xcoins_balances").update({ balance: newBalance, updated_at: new Date().toISOString() }).eq("id", userId);
      await supabase.from("xcoins_transactions").insert({
        user_id: userId, type: "topup", amount: transaction.original_amount,
        balance_after: newBalance, description: `Deposit ${transaction.original_amount} XCoins`, reference_id: transaction.transaction_id,
      });
    }
  } else if (transaction.license_key) {
    await createLicenseKey(supabase, transaction);
  }

  try {
    const { data: discordSetting } = await supabase
      .from("app_settings").select("value").eq("key", "discord_webhook_url").maybeSingle();
    if (discordSetting?.value) {
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
      await fetch(discordSetting.value, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embeds: [embed] }),
      });
    }
  } catch (e) {
    console.error("[payment-webhook] discord notify failed");
  }
}

async function createLicenseKey(supabase: any, transaction: any) {
  try {
    const key = transaction.license_key;
    if (!key) return;
    const { data } = await supabase.from("app_settings").select("value").eq("key", "license_keys").maybeSingle();
    let keys: any[] = [];
    if (data) { try { keys = JSON.parse(data.value || "[]"); } catch { keys = []; } }

    const existingIdx = keys.findIndex((k: any) => k.key === key);
    const isLifetime = transaction.package_name === "LIFETIME";

    if (isLifetime) {
      const permanentExpiry = new Date("2099-12-31T23:59:59.000Z");
      if (existingIdx >= 0) {
        keys[existingIdx].expired = permanentExpiry.toISOString();
        keys[existingIdx].role = "ADMIN";
      } else {
        keys.push({ key, expired: permanentExpiry.toISOString(), created: new Date().toISOString(), role: "ADMIN", maxHwid: 1, frozenUntil: null, frozenRemainingMs: null, hwids: [], robloxUsers: [] });
      }
    } else {
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
      } else {
        keys.push({ key, expired: expiryDate.toISOString(), created: new Date().toISOString(), role: transaction.package_name || "NORMAL", maxHwid: 1, frozenUntil: null, frozenRemainingMs: null, hwids: [], robloxUsers: [] });
      }
    }

    await supabase.from("app_settings").upsert({
      key: "license_keys", value: JSON.stringify(keys), updated_at: new Date().toISOString(), description: "License keys database"
    }, { onConflict: "key" });
  } catch (error) {
    console.error("[payment-webhook] createLicenseKey failed");
  }
}

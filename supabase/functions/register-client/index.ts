// Registrazione cliente: GoTrue POST /auth/v1/admin/users + email_confirm true (nessuna mail Auth).
// Deploy: supabase functions deploy register-client
// Rate limit persistente: Dashboard Authentication - Providers - Email - disattiva Confirm email.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { adminCreateUserConfirmed, isEmailRateLimit } from "../_shared/adminCreateUser.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const supaUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supaUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: Record<string, string | null>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON non valido" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const email = (String(body.email || "")).trim().toLowerCase();
  const password = String(body.password || "");
  const first_name = (String(body.first_name || "")).trim();
  const last_name = (String(body.last_name || "")).trim();
  const phone = body.phone ? String(body.phone).trim() || null : null;

  if (!email || !password || !first_name || !last_name) {
    return new Response(JSON.stringify({ error: "Compila tutti i campi obbligatori" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  if (!EMAIL_RE.test(email)) {
    return new Response(JSON.stringify({ error: "Email non valida" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  if (password.length < 8) {
    return new Response(JSON.stringify({ error: "Password di almeno 8 caratteri" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const meta: Record<string, string> = { first_name, last_name };
  if (phone) meta.phone = phone;

  let uid: string;
  try {
    ({ id: uid } = await adminCreateUserConfirmed(supaUrl, serviceKey, email, password, meta));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const st = (e as Error & { status?: number }).status;
    const low = msg.toLowerCase();
    const dup =
      low.includes("already") || low.includes("registered") || low.includes("exists") ||
      low.includes("duplicate");
    const payload: Record<string, string> = { error: msg };
    if (isEmailRateLimit(msg, st)) {
      payload.hint =
        "Supabase Dashboard: Authentication - Providers - Email - disattiva Confirm email. Attendi 1h o upgrade piano.";
    }
    return new Response(JSON.stringify(payload), {
      status: dup ? 409 : isEmailRateLimit(msg, st) ? 429 : st && st >= 400 ? st : 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const { error: upErr } = await supabase.from("profiles").upsert(
    { id: uid, first_name, last_name, email, phone, role: "CLIENT" },
    { onConflict: "id" },
  );
  if (upErr) {
    console.error("profiles upsert", upErr);
    return new Response(JSON.stringify({ error: upErr.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, user_id: uid }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});

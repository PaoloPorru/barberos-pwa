// Registrazione cliente senza email di conferma (admin.createUser + email_confirm: true).
// Evita "Email rate limit exceeded" di Auth su signUp ripetuti.
// Deploy: supabase functions deploy register-client
// Dashboard: Verify JWT = OFF (chiamata solo con anon key dall’app).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  if (password.length < 8) {
    return new Response(JSON.stringify({ error: "Password di almeno 8 caratteri" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const meta: Record<string, string> = { first_name, last_name };
  if (phone) meta.phone = phone;

  const { data: created, error: cErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: meta,
  });

  if (cErr) {
    const msg = cErr.message || "Registrazione fallita";
    const low = msg.toLowerCase();
    const status =
      low.includes("already") || low.includes("registered") || low.includes("exists") ? 409 : 400;
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const uid = created.user!.id;

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

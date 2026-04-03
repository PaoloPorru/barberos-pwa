// Crea barbiere: GoTrue admin users + email_confirm true (nessuna mail Auth).
// Deploy: supabase functions deploy create-team-barber

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

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return new Response(JSON.stringify({ error: "Non autenticato" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const supaUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supaUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "Sessione non valida" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const callerId = userData.user.id;
  const { data: callerProf, error: pErr } = await supabase.from("profiles").select("role").eq("id", callerId).single();
  if (pErr || !callerProf || !["BARBER", "ADMIN"].includes(callerProf.role as string)) {
    return new Response(JSON.stringify({ error: "Permesso negato" }), {
      status: 403,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON non valido" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  const first_name = (body.first_name || "").trim();
  const last_name = (body.last_name || "").trim();
  const bio = (body.bio || "").trim() || null;
  const color_hex = (body.color_hex || "#c9a84c").trim();

  if (!email || !password || !first_name || !last_name) {
    return new Response(JSON.stringify({ error: "Compila nome, cognome, email e password" }), {
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
  if (password.length < 6) {
    return new Response(JSON.stringify({ error: "Password di almeno 6 caratteri" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let uid: string;
  try {
    ({ id: uid } = await adminCreateUserConfirmed(supaUrl, serviceKey, email, password, {
      first_name,
      last_name,
    }));
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
        "Su Supabase: Authentication → Providers → Email → disattiva «Confirm email». Attendi o passa a piano superiore.";
    }
    return new Response(JSON.stringify(payload), {
      status: dup ? 409 : isEmailRateLimit(msg, st) ? 429 : st && st >= 400 ? st : 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const { error: upErr } = await supabase.from("profiles").upsert(
    { id: uid, first_name, last_name, email, phone: null, role: "BARBER" },
    { onConflict: "id" },
  );
  if (upErr) {
    console.error("profiles upsert", upErr);
    return new Response(JSON.stringify({ error: upErr.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const { error: bErr } = await supabase.from("barbers").insert({
    user_id: uid,
    bio,
    color_hex,
  });
  if (bErr) {
    console.error("barbers insert", bErr);
    return new Response(JSON.stringify({ error: bErr.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const { data: bRow } = await supabase.from("barbers").select("id").eq("user_id", uid).single();
  const bid = bRow?.id;
  if (bid) {
    for (let d = 1; d <= 6; d++) {
      await supabase.from("availability").insert({
        barber_id: bid,
        day_of_week: d,
        start_time: "09:00",
        end_time: "19:00",
      });
    }
  }

  return new Response(JSON.stringify({ ok: true, user_id: uid }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});

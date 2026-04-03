// supabase/functions/apt-client-action/index.ts
// Conferma / rifiuto appuntamento PENDING tramite link email (token, senza login).
// Deploy: supabase functions deploy apt-client-action

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function timingSafeEq(a: string, b: string): boolean {
  const x = String(a);
  const y = String(b);
  if (x.length !== y.length) return false;
  let n = 0;
  for (let i = 0; i < x.length; i++) n |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return n === 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let body: { id?: string; token?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON non valido" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const id = body.id;
  const token = body.token;
  const action = body.action;
  if (!id || !token || (action !== "confirm" && action !== "decline")) {
    return new Response(JSON.stringify({ error: "Parametri mancanti" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPA_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const headers: Record<string, string> = {
    apikey: SUPA_KEY,
    Authorization: `Bearer ${SUPA_KEY}`,
  };

  const getRes = await fetch(
    `${SUPA_URL}/rest/v1/appointments?id=eq.${id}&select=id,status,client_confirm_token`,
    { headers },
  );
  const rows = await getRes.json();
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) {
    return new Response(JSON.stringify({ error: "Appuntamento non trovato" }), {
      status: 404,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const stored = String(row.client_confirm_token ?? "");
  if (!timingSafeEq(stored, String(token))) {
    return new Response(JSON.stringify({ error: "Link non valido" }), {
      status: 403,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  if (row.status !== "PENDING") {
    return new Response(JSON.stringify({ error: "Non è più in attesa di conferma" }), {
      status: 409,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const newStatus = action === "confirm" ? "CONFIRMED" : "CANCELLED";
  const patch = await fetch(`${SUPA_URL}/rest/v1/appointments?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ status: newStatus }),
  });
  if (!patch.ok) {
    console.error("apt-client-action patch:", await patch.text());
    return new Response(JSON.stringify({ error: "Aggiornamento fallito" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, status: newStatus }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});

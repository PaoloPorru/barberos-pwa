// supabase/functions/notify/index.ts
// Triggered by Supabase Database Webhook on appointments INSERT/UPDATE
// Deploy: supabase functions deploy notify

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "noreply@barberos.it";
const APP_URL    = Deno.env.get("APP_URL")    || "https://barberos.vercel.app";

// ── EMAIL TEMPLATES ───────────────────────────────────────────
function emailConfirmed(data: any) {
  const { clientName, barberName, serviceName, date, time, price } = data;
  return {
    subject: `✅ Appuntamento confermato — ${date} alle ${time}`,
    html: `
<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<style>body{font-family:sans-serif;background:#f5f5f5;margin:0;padding:20px}
.wrap{max-width:500px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden}
.hdr{background:#0a0a0a;padding:28px;text-align:center}
.logo{font-size:28px;font-weight:700;color:#f0ebe0;letter-spacing:4px}
.logo em{color:#c9a84c;font-style:normal}
.body{padding:32px}.h2{font-size:20px;font-weight:700;margin-bottom:16px;color:#111}
.box{background:#f9f9f9;border-radius:8px;padding:20px;margin:16px 0}
.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;font-size:14px}
.row:last-child{border-bottom:none}
.lbl{color:#888}.val{font-weight:600;color:#111}
.cta{display:block;background:#c9a84c;color:#0a0a0a;text-align:center;padding:14px;border-radius:8px;font-weight:700;text-decoration:none;margin-top:20px;font-size:15px}
.foot{background:#f0f0f0;padding:16px;text-align:center;font-size:12px;color:#999}
</style></head><body>
<div class="wrap">
  <div class="hdr"><div class="logo">BARBER<em>OS</em></div></div>
  <div class="body">
    <div class="h2">✂️ Appuntamento Confermato!</div>
    <p style="color:#555;font-size:14px">Ciao <strong>${clientName}</strong>, il tuo appuntamento è confermato. Ci vediamo presto!</p>
    <div class="box">
      <div class="row"><span class="lbl">📅 Data</span><span class="val">${date}</span></div>
      <div class="row"><span class="lbl">🕐 Orario</span><span class="val">${time}</span></div>
      <div class="row"><span class="lbl">✂️ Barbiere</span><span class="val">${barberName}</span></div>
      <div class="row"><span class="lbl">💈 Servizio</span><span class="val">${serviceName}</span></div>
      <div class="row"><span class="lbl">💰 Prezzo</span><span class="val">€${price}</span></div>
    </div>
    <a href="${APP_URL}" class="cta">Gestisci i tuoi appuntamenti →</a>
  </div>
  <div class="foot">© BarberOS — Per cancellare accedi all'app</div>
</div></body></html>`,
  };
}

function emailCancelled(data: any) {
  const { clientName, date, time } = data;
  return {
    subject: `❌ Appuntamento cancellato — ${date}`,
    html: `
<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<style>body{font-family:sans-serif;background:#f5f5f5;margin:0;padding:20px}
.wrap{max-width:500px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden}
.hdr{background:#0a0a0a;padding:28px;text-align:center}
.logo{font-size:28px;font-weight:700;color:#f0ebe0;letter-spacing:4px}
.logo em{color:#c9a84c;font-style:normal}
.body{padding:32px}.cta{display:block;background:#c9a84c;color:#0a0a0a;text-align:center;padding:14px;border-radius:8px;font-weight:700;text-decoration:none;margin-top:20px}
.foot{background:#f0f0f0;padding:16px;text-align:center;font-size:12px;color:#999}
</style></head><body>
<div class="wrap">
  <div class="hdr"><div class="logo">BARBER<em>OS</em></div></div>
  <div class="body">
    <h2 style="color:#111">Appuntamento Cancellato</h2>
    <p style="color:#555;font-size:14px">Ciao <strong>${clientName}</strong>, il tuo appuntamento del <strong>${date} alle ${time}</strong> è stato cancellato.</p>
    <a href="${APP_URL}" class="cta">Prenota un nuovo appuntamento →</a>
  </div>
  <div class="foot">© BarberOS</div>
</div></body></html>`,
  };
}

function emailReminder(data: any) {
  const { clientName, barberName, serviceName, date, time } = data;
  return {
    subject: `⏰ Promemoria — Domani alle ${time}`,
    html: `
<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<style>body{font-family:sans-serif;background:#f5f5f5;margin:0;padding:20px}
.wrap{max-width:500px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden}
.hdr{background:#0a0a0a;padding:28px;text-align:center}
.logo{font-size:28px;font-weight:700;color:#f0ebe0;letter-spacing:4px}
.logo em{color:#c9a84c;font-style:normal}
.body{padding:32px}
.box{background:#fff8ec;border-left:4px solid #c9a84c;border-radius:0 8px 8px 0;padding:16px;margin:16px 0}
.cta{display:block;background:#c9a84c;color:#0a0a0a;text-align:center;padding:14px;border-radius:8px;font-weight:700;text-decoration:none;margin-top:20px}
.foot{background:#f0f0f0;padding:16px;text-align:center;font-size:12px;color:#999}
</style></head><body>
<div class="wrap">
  <div class="hdr"><div class="logo">BARBER<em>OS</em></div></div>
  <div class="body">
    <h2 style="color:#111">Ci vediamo domani! 💈</h2>
    <p style="color:#555;font-size:14px">Ciao <strong>${clientName}</strong>, ti ricordiamo il tuo appuntamento di domani.</p>
    <div class="box">
      <p style="margin:4px 0;font-size:14px"><strong>📅 ${date}</strong> alle <strong>${time}</strong></p>
      <p style="margin:4px 0;font-size:14px">✂️ ${barberName} — ${serviceName}</p>
    </div>
    <a href="${APP_URL}" class="cta">Apri BarberOS →</a>
  </div>
  <div class="foot">© BarberOS — Per cancellare accedi all'app entro questa sera</div>
</div></body></html>`,
  };
}

// ── SEND EMAIL via Resend ─────────────────────────────────────
async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_KEY) { console.log("RESEND_API_KEY not set, skipping email"); return; }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  if (!res.ok) console.error("Email error:", await res.text());
}

// ── MAIN HANDLER ──────────────────────────────────────────────
serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const payload = await req.json();
  // Supabase webhook sends: { type: 'INSERT'|'UPDATE', table, record, old_record }
  const { type, record, old_record } = payload;

  if (!record) return new Response("No record", { status: 400 });

  // Fetch enriched data from Supabase
  const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPA_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const headers  = { "apikey": SUPA_KEY, "Authorization": `Bearer ${SUPA_KEY}` };

  // Get client email
  const clientRes = await fetch(`${SUPA_URL}/rest/v1/profiles?id=eq.${record.client_id}&select=first_name,last_name`, { headers });
  const [client] = await clientRes.json();

  const userRes = await fetch(`${SUPA_URL}/auth/v1/admin/users/${record.client_id}`, { headers });
  const user = await userRes.json();
  const clientEmail = user?.email;

  // Get service info
  const svcRes = await fetch(`${SUPA_URL}/rest/v1/services?id=eq.${record.service_id}&select=name,price`, { headers });
  const [svc] = await svcRes.json();

  // Get barber name
  const barberRes = await fetch(`${SUPA_URL}/rest/v1/barbers?id=eq.${record.barber_id}&select=user_id`, { headers });
  const [barber] = await barberRes.json();
  const bProfileRes = await fetch(`${SUPA_URL}/rest/v1/profiles?id=eq.${barber?.user_id}&select=first_name,last_name`, { headers });
  const [bProfile] = await bProfileRes.json();

  const dt         = new Date(record.start_datetime);
  const dateStr    = dt.toLocaleDateString("it-IT", { weekday:"long", day:"numeric", month:"long", year:"numeric" });
  const timeStr    = dt.toLocaleTimeString("it-IT", { hour:"2-digit", minute:"2-digit" });
  const clientName = `${client?.first_name || ""} ${client?.last_name || ""}`.trim();
  const barberName = `${bProfile?.first_name || ""} ${bProfile?.last_name || ""}`.trim();
  const emailData  = { clientName, barberName, serviceName: svc?.name, date: dateStr, time: timeStr, price: svc?.price };

  if (!clientEmail) return new Response("Client email not found", { status: 404 });

  // Decide which email to send
  if (type === "INSERT" && record.status === "CONFIRMED") {
    const tmpl = emailConfirmed(emailData);
    await sendEmail(clientEmail, tmpl.subject, tmpl.html);
  }
  if (type === "UPDATE" && record.status === "CANCELLED" && old_record?.status !== "CANCELLED") {
    const tmpl = emailCancelled(emailData);
    await sendEmail(clientEmail, tmpl.subject, tmpl.html);
  }
  if (type === "REMINDER") { // called by the reminder cron function
    const tmpl = emailReminder(emailData);
    await sendEmail(clientEmail, tmpl.subject, tmpl.html);
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});

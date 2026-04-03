// supabase/functions/notify/index.ts
// Webhook DB su appointments INSERT/UPDATE + chiamata REMINDER dal cron.
// Segreti: RESEND_API_KEY, FROM_EMAIL, APP_URL, SUPABASE_*, opz. VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY
// (stessa coppia della chiave pubblica in index.html → push allo staff).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import webpush from "npm:web-push@3.6.6";

const RESEND_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "noreply@barberos.it";
const APP_URL = (Deno.env.get("APP_URL") || "https://barberos.vercel.app").replace(/\/$/, "");
const VAPID_PUB = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIV = Deno.env.get("VAPID_PRIVATE_KEY") || "";

function googleCalendarUrl(record: {
  start_datetime: string;
  end_datetime: string;
  price_snapshot: number | string;
}, serviceName: string, barberName: string): string {
  const start = new Date(record.start_datetime);
  const end = new Date(record.end_datetime);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(".000", "");
  const title = encodeURIComponent(`✂️ ${serviceName} da ${barberName}`);
  const details = encodeURIComponent(
    `Appuntamento BarberOS\nServizio: ${serviceName}\nPrezzo: €${record.price_snapshot}`,
  );
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${fmt(start)}/${fmt(end)}&details=${details}&sf=true&output=xml`;
}

function emailConfirmed(data: {
  clientName: string;
  barberName: string;
  serviceName: string;
  date: string;
  time: string;
  price: string | number;
  gcalUrl: string;
}) {
  const { clientName, barberName, serviceName, date, time, price, gcalUrl } = data;
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
.cta{display:block;background:#c9a84c;color:#0a0a0a;text-align:center;padding:14px;border-radius:8px;font-weight:700;text-decoration:none;margin-top:12px;font-size:15px}
.foot{background:#f0f0f0;padding:16px;text-align:center;font-size:12px;color:#999}
</style></head><body>
<div class="wrap">
  <div class="hdr"><div class="logo">BARBER<em>OS</em></div></div>
  <div class="body">
    <div class="h2">✂️ Appuntamento confermato</div>
    <p style="color:#555;font-size:14px">Ciao <strong>${clientName}</strong>, il tuo appuntamento è confermato.</p>
    <div class="box">
      <div class="row"><span class="lbl">📅 Data</span><span class="val">${date}</span></div>
      <div class="row"><span class="lbl">🕐 Orario</span><span class="val">${time}</span></div>
      <div class="row"><span class="lbl">✂️ Barbiere</span><span class="val">${barberName}</span></div>
      <div class="row"><span class="lbl">💈 Servizio</span><span class="val">${serviceName}</span></div>
      <div class="row"><span class="lbl">💰 Prezzo</span><span class="val">€${price}</span></div>
    </div>
    <p style="color:#555;font-size:13px;margin-top:18px"><strong>Aggiungi al calendario</strong></p>
    <a href="${gcalUrl}" class="cta" target="_blank" rel="noopener">📅 Apri Google Calendar</a>
    <p style="color:#888;font-size:12px;margin-top:14px">Da smartphone puoi anche aprire l’app BarberOS dopo l’accesso e usare i pulsanti calendario sulla prenotazione.</p>
    <a href="${APP_URL}/" class="cta" style="margin-top:10px;background:#333;color:#f0ebe0">Apri BarberOS →</a>
  </div>
  <div class="foot">© BarberOS</div>
</div></body></html>`,
  };
}

function emailPendingClient(data: {
  clientName: string;
  barberName: string;
  serviceName: string;
  date: string;
  time: string;
  price: string | number;
  confirmUrl: string;
  declineUrl: string;
}) {
  const { clientName, barberName, serviceName, date, time, price, confirmUrl, declineUrl } = data;
  return {
    subject: `📋 Conferma il tuo appuntamento — ${date} alle ${time}`,
    html: `
<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<style>body{font-family:sans-serif;background:#f5f5f5;margin:0;padding:20px}
.wrap{max-width:500px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden}
.hdr{background:#0a0a0a;padding:28px;text-align:center}
.logo{font-size:28px;font-weight:700;color:#f0ebe0;letter-spacing:4px}
.logo em{color:#c9a84c;font-style:normal}
.body{padding:32px}.h2{font-size:20px;font-weight:700;margin-bottom:12px;color:#111}
.box{background:#f9f9f9;border-radius:8px;padding:20px;margin:16px 0}
.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;font-size:14px}
.row:last-child{border-bottom:none}
.lbl{color:#888}.val{font-weight:600;color:#111}
.cta{display:inline-block;background:#4caf78;color:#fff;text-align:center;padding:14px 22px;border-radius:8px;font-weight:700;text-decoration:none;margin:8px 8px 0 0;font-size:15px}
.cta2{display:inline-block;background:#e05c5c;color:#fff;text-align:center;padding:14px 22px;border-radius:8px;font-weight:700;text-decoration:none;margin:8px 0 0;font-size:15px}
.foot{background:#f0f0f0;padding:16px;text-align:center;font-size:12px;color:#999}
</style></head><body>
<div class="wrap">
  <div class="hdr"><div class="logo">BARBER<em>OS</em></div></div>
  <div class="body">
    <div class="h2">Ti aspettiamo in salone</div>
    <p style="color:#555;font-size:14px">Ciao <strong>${clientName}</strong>, il salone ha proposto questo appuntamento. <strong>Conferma o rifiuta</strong> con i pulsanti qui sotto.</p>
    <div class="box">
      <div class="row"><span class="lbl">📅 Data</span><span class="val">${date}</span></div>
      <div class="row"><span class="lbl">🕐 Orario</span><span class="val">${time}</span></div>
      <div class="row"><span class="lbl">✂️ Barbiere</span><span class="val">${barberName}</span></div>
      <div class="row"><span class="lbl">💈 Servizio</span><span class="val">${serviceName}</span></div>
      <div class="row"><span class="lbl">💰 Prezzo</span><span class="val">€${price}</span></div>
    </div>
    <p style="margin-top:20px">
      <a href="${confirmUrl}" class="cta">✅ Conferma</a>
      <a href="${declineUrl}" class="cta2">❌ Rifiuta</a>
    </p>
    <p style="color:#888;font-size:12px;margin-top:16px">Dopo la conferma riceverai un’email con il link per Google Calendar.</p>
  </div>
  <div class="foot">© BarberOS</div>
</div></body></html>`,
  };
}

function emailCancelled(data: { clientName: string; date: string; time: string }) {
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
    <h2 style="color:#111">Appuntamento cancellato</h2>
    <p style="color:#555;font-size:14px">Ciao <strong>${clientName}</strong>, l’appuntamento del <strong>${date} alle ${time}</strong> non è più valido.</p>
    <a href="${APP_URL}/" class="cta">Prenota di nuovo →</a>
  </div>
  <div class="foot">© BarberOS</div>
</div></body></html>`,
  };
}

function emailReminder(data: {
  clientName: string;
  barberName: string;
  serviceName: string;
  date: string;
  time: string;
}) {
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
    <a href="${APP_URL}/" class="cta">Apri BarberOS →</a>
  </div>
  <div class="foot">© BarberOS</div>
</div></body></html>`,
  };
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_KEY) {
    console.log("RESEND_API_KEY not set, skip email");
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  if (!res.ok) console.error("Email error:", await res.text());
}

let _vapidReady = false;
function ensureVapid(): boolean {
  if (_vapidReady) return true;
  if (!VAPID_PUB || !VAPID_PRIV) return false;
  webpush.setVapidDetails(`mailto:${FROM_EMAIL}`, VAPID_PUB, VAPID_PRIV);
  _vapidReady = true;
  return true;
}

async function pushToStaff(
  supaUrl: string,
  headers: Record<string, string>,
  payload: { title: string; body: string; url?: string },
) {
  if (!ensureVapid()) {
    console.log("VAPID keys not set, skip web push to staff");
    return;
  }
  const profRes = await fetch(
    `${supaUrl}/rest/v1/profiles?or=(role.eq.BARBER,role.eq.ADMIN)&select=id`,
    { headers },
  );
  const profs = await profRes.json();
  if (!Array.isArray(profs) || !profs.length) return;
  const ids = profs.map((p: { id: string }) => p.id).filter(Boolean);
  if (!ids.length) return;
  const idList = ids.join(",");
  const subRes = await fetch(
    `${supaUrl}/rest/v1/push_subscriptions?user_id=in.(${idList})&select=subscription`,
    { headers },
  );
  const subs = await subRes.json();
  if (!Array.isArray(subs)) return;
  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || `${APP_URL}/`,
  });
  for (const row of subs) {
    try {
      const sub = JSON.parse(row.subscription);
      await webpush.sendNotification(sub, body, { TTL: 86400 });
    } catch (e) {
      console.error("webpush:", e);
    }
  }
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const payload = await req.json();
  const { type, record, old_record } = payload;

  if (!record) return new Response("No record", { status: 400 });

  const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPA_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const headers = { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` };

  let clientEmail: string | null = null;
  let clientName = "";

  if (record.client_id) {
    const clientRes = await fetch(
      `${SUPA_URL}/rest/v1/profiles?id=eq.${record.client_id}&select=first_name,last_name`,
      { headers },
    );
    const cp = await clientRes.json();
    const client = Array.isArray(cp) ? cp[0] : null;
    clientName = `${client?.first_name || ""} ${client?.last_name || ""}`.trim() || "Cliente";
    const userRes = await fetch(`${SUPA_URL}/auth/v1/admin/users/${record.client_id}`, { headers });
    const user = await userRes.json();
    clientEmail = user?.email ?? null;
  } else {
    const ge = (record.guest_email && String(record.guest_email).trim()) || "";
    clientEmail = ge || null;
    clientName = `${record.guest_first_name || ""} ${record.guest_last_name || ""}`.trim() || "Cliente";
  }

  const svcRes = await fetch(
    `${SUPA_URL}/rest/v1/services?id=eq.${record.service_id}&select=name,price`,
    { headers },
  );
  const sv = await svcRes.json();
  const svc = Array.isArray(sv) ? sv[0] : null;

  const barberRes = await fetch(
    `${SUPA_URL}/rest/v1/barbers?id=eq.${record.barber_id}&select=user_id`,
    { headers },
  );
  const br = await barberRes.json();
  const barber = Array.isArray(br) ? br[0] : null;
  const bProfileRes = await fetch(
    `${SUPA_URL}/rest/v1/profiles?id=eq.${barber?.user_id}&select=first_name,last_name`,
    { headers },
  );
  const bp = await bProfileRes.json();
  const bProfile = Array.isArray(bp) ? bp[0] : null;
  const barberName = `${bProfile?.first_name || ""} ${bProfile?.last_name || ""}`.trim() || "Barbiere";

  const dt = new Date(record.start_datetime);
  const dateStr = dt.toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timeStr = dt.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  const gcalUrl = googleCalendarUrl(record, svc?.name || "Servizio", barberName);

  const emailData = {
    clientName,
    barberName,
    serviceName: svc?.name || "Servizio",
    date: dateStr,
    time: timeStr,
    price: svc?.price ?? record.price_snapshot,
    gcalUrl,
  };

  try {
    if (type === "INSERT") {
      if (record.status === "PENDING" && !record.client_id && clientEmail) {
        const tok = record.client_confirm_token;
        const confirmUrl = `${APP_URL}/?apt=${record.id}&token=${tok}&act=confirm`;
        const declineUrl = `${APP_URL}/?apt=${record.id}&token=${tok}&act=decline`;
        const tmpl = emailPendingClient({ ...emailData, confirmUrl, declineUrl });
        await sendEmail(clientEmail, tmpl.subject, tmpl.html);
        await pushToStaff(SUPA_URL, headers, {
          title: "BarberOS — In attesa cliente",
          body: `${clientName}: conferma richiesta per ${dateStr} ${timeStr}`,
          url: `${APP_URL}/`,
        });
      } else if (record.status === "CONFIRMED" && clientEmail) {
        const tmpl = emailConfirmed(emailData);
        await sendEmail(clientEmail, tmpl.subject, tmpl.html);
        await pushToStaff(SUPA_URL, headers, {
          title: "BarberOS — Nuova prenotazione",
          body: `${clientName} · ${dateStr} ${timeStr} · ${emailData.serviceName}`,
          url: `${APP_URL}/`,
        });
      }
    }

    if (type === "UPDATE") {
      const prev = old_record?.status;
      const cur = record.status;

      if (cur === "CONFIRMED" && prev === "PENDING" && clientEmail) {
        const tmpl = emailConfirmed(emailData);
        await sendEmail(clientEmail, tmpl.subject, tmpl.html);
        await pushToStaff(SUPA_URL, headers, {
          title: "BarberOS — Cliente ha confermato",
          body: `${clientName} · ${dateStr} ${timeStr}`,
          url: `${APP_URL}/`,
        });
      } else if (cur === "CANCELLED" && prev !== "CANCELLED") {
        if (prev === "PENDING" && !record.client_id) {
          await pushToStaff(SUPA_URL, headers, {
            title: "BarberOS — Richiesta rifiutata",
            body: `${clientName} ha rifiutato · ${dateStr} ${timeStr}`,
            url: `${APP_URL}/`,
          });
        } else if (clientEmail) {
          const tmpl = emailCancelled({ clientName, date: dateStr, time: timeStr });
          await sendEmail(clientEmail, tmpl.subject, tmpl.html);
          await pushToStaff(SUPA_URL, headers, {
            title: "BarberOS — Appuntamento annullato",
            body: `${clientName} · ${dateStr} ${timeStr}`,
            url: `${APP_URL}/`,
          });
        }
      }
    }

    if (type === "REMINDER" && clientEmail) {
      const tmpl = emailReminder({
        clientName,
        barberName,
        serviceName: emailData.serviceName,
        date: dateStr,
        time: timeStr,
      });
      await sendEmail(clientEmail, tmpl.subject, tmpl.html);
    }
  } catch (e) {
    console.error("notify handler:", e);
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});

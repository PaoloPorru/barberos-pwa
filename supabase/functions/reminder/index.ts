// supabase/functions/reminder/index.ts
// Scheduled cron: runs every day at 09:00
// In Supabase Dashboard → Edge Functions → reminder → Schedule: "0 9 * * *"
// Deploy: supabase functions deploy reminder

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async () => {
  const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPA_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const NOTIFY_URL = `${SUPA_URL}/functions/v1/notify`;
  const headers = { "apikey": SUPA_KEY, "Authorization": `Bearer ${SUPA_KEY}`, "Content-Type": "application/json" };

  // Find appointments tomorrow that haven't been reminded yet
  const tomorrow     = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDate = tomorrow.toISOString().split("T")[0];

  const res = await fetch(
    `${SUPA_URL}/rest/v1/appointments?select=*&status=eq.CONFIRMED&reminder_sent=eq.false&start_datetime=gte.${tomorrowDate}T00:00:00&start_datetime=lte.${tomorrowDate}T23:59:59`,
    { headers }
  );
  const appointments = await res.json();

  let sent = 0;
  for (const apt of appointments) {
    try {
      // Call the notify function with REMINDER type
      await fetch(NOTIFY_URL, {
        method: "POST",
        headers: { ...headers, "Authorization": `Bearer ${SUPA_KEY}` },
        body: JSON.stringify({ type: "REMINDER", record: apt }),
      });
      // Mark as reminded
      await fetch(`${SUPA_URL}/rest/v1/appointments?id=eq.${apt.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ reminder_sent: true }),
      });
      sent++;
    } catch (e) {
      console.error("Reminder failed for", apt.id, e);
    }
  }

  return new Response(JSON.stringify({ ok: true, sent }), {
    headers: { "Content-Type": "application/json" },
  });
});

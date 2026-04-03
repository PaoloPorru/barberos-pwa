// Crea utente via GoTrue REST (evita comportamenti ambigui del client JS).
// email_confirm: true = nessuna email di conferma inviata da Auth.

export async function adminCreateUserConfirmed(
  supaUrl: string,
  serviceKey: string,
  email: string,
  password: string,
  user_metadata: Record<string, unknown>,
): Promise<{ id: string }> {
  const url = `${supaUrl.replace(/\/$/, "")}/auth/v1/admin/users`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata,
    }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (typeof j.msg === "string" && j.msg) ||
      (typeof j.error_description === "string" && j.error_description) ||
      (typeof j.message === "string" && j.message) ||
      (typeof j.error === "string" && j.error) ||
      res.statusText;
    const err = new Error(msg) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  const id = j.id ?? j.user?.id;
  if (!id || typeof id !== "string") {
    throw new Error("Risposta auth senza id utente");
  }
  return { id };
}

export function isEmailRateLimit(msg: string, status?: number): boolean {
  const m = (msg || "").toLowerCase();
  return (
    status === 429 ||
    m.includes("rate limit") ||
    m.includes("over_email_send") ||
    m.includes("email rate") ||
    m.includes("too many requests")
  );
}

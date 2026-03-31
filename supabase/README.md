# Supabase — BarberOS

Questa cartella consente il **deploy delle Edge Functions** con la [Supabase CLI](https://supabase.com/docs/guides/cli). Lo schema SQL del database resta nei file nella root del repo (`supabase_schema.sql`, ecc.) e va eseguito dall’SQL Editor del dashboard.

## Prerequisiti

1. Account Supabase e progetto creato sul dashboard.
2. CLI installata (scegli un metodo):

   ```bash
   brew install supabase/tap/supabase
   ```

   oppure (richiede Node 18+):

   ```bash
   npx supabase@latest --version
   ```

## Collegare la repo al progetto hosted

Dalla **root del repository** (cartella che contiene `supabase/`):

```bash
supabase login
supabase link --project-ref TUO_PROJECT_REF
```

Il `project_ref` è la stringa nell’URL del progetto: `https://supabase.com/dashboard/project/<project_ref>` oppure in **Project Settings → General → Reference ID**.

## Segreti per le funzioni

Su Supabase, `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` sono disponibili automaticamente nelle Edge Functions.

Per **email** (funzione `notify` con Resend) imposta i segreti custom:

```bash
supabase secrets set RESEND_API_KEY=re_xxxxxxxx \
  FROM_EMAIL="BarberOS <noreply@tuodominio.it>" \
  APP_URL="https://tua-app.vercel.app"
```

Senza `RESEND_API_KEY` la funzione può rispondere senza inviare email (comportamento dipende dal codice).

## Deploy

```bash
# dalla root del repo
supabase functions deploy notify
supabase functions deploy reminder
```

Oppure:

```bash
./scripts/deploy-supabase-functions.sh
```

## Dopo il deploy

1. **Webhook** (tabella `appointments` → funzione `notify`): vedi commenti in `supabase_schema_v2.sql`. URL:

   `https://<project_ref>.supabase.co/functions/v1/notify`

   Header: `Authorization: Bearer <SERVICE_ROLE_KEY>` (o anon + JWT se preferisci; con `verify_jwt = true` nel `config.toml` usa un JWT valido).

2. **Promemoria giornaliero** (`reminder`): in **Edge Functions → reminder → Schedules** aggiungi una cron, es. `0 9 * * *` (ogni giorno alle 09:00 UTC). Verifica il fuso orario rispetto all’Italia.

## Sviluppo locale (opzionale)

```bash
supabase start
supabase functions serve notify --env-file supabase/.env.local
```

Crea `supabase/.env.local` con le variabili necessarie (non committare).

## Registrazione: «Database error saving new user»

Significa che il trigger su `auth.users` non riesce a fare `INSERT` in `public.profiles` (permessi `supabase_auth_admin`, trigger mancante o policy RLS in conflitto). Esegui dall’SQL Editor **tutto** il file `supabase_fix_signup.sql` nella root del repo e riprova la signup.

## `verify_jwt` e webhook

In `config.toml`, `notify` ha `verify_jwt = true`. Il webhook del database deve inviare `Authorization: Bearer <service_role_jwt>`. Se incontri 401, controlla l’header nel dashboard del webhook. Solo in ultima istanza: `supabase functions deploy notify --no-verify-jwt` (meno sicuro).

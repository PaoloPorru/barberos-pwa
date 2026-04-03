# ✂️ BarberOS — Setup Gratuito in 15 Minuti

Stack: **Supabase** (database + auth gratuito) + **Vercel** (hosting gratuito) + **PWA** (app mobile senza App Store)

---

## 📋 COSA TI SERVE
- Un account **Supabase** → https://supabase.com (gratuito, no carta di credito)
- Un account **Vercel** → https://vercel.com (gratuito, no carta di credito)
- Un account **GitHub** → https://github.com (gratuito)

---

## 🚀 STEP 1 — Crea il Progetto Supabase

1. Vai su https://supabase.com e clicca **"Start your project"**
2. Crea un nuovo progetto (scegli un nome e una password DB sicura)
3. Aspetta ~2 minuti che il progetto si avvii

---

## 🗄️ STEP 2 — Crea il Database

1. Nel pannello Supabase, vai su **SQL Editor** (icona nella sidebar)
2. Clicca **"New Query"**
3. Copia tutto il contenuto del file `supabase_schema.sql` (include tabelle push, `reminder_sent`, colonna `email` profilo e RLS corrette)
4. Incolla nell'editor e clicca **"Run"** (▶️)
5. Dovresti vedere "Success" — il database è pronto con tutti i servizi di default
6. Se la registrazione dà **"Database error saving new user"**, di solito c’è ancora un trigger su `auth.users`: con **psql** esegui `supabase_drop_trigger_auth.sql` (`./scripts/run-sql.sh supabase_drop_trigger_auth.sql` con `DATABASE_URL` da *Settings → Database*). Per policy mancanti usa `supabase_fix_public.sql` o l’intero `supabase_schema.sql`
7. Se avevi già un DB vecchio senza v2, puoi comunque eseguire `supabase_schema_v2.sql` (è idempotente)

---

## ⚡ Edge Functions — email e promemoria (opzionale)

Per deployare **`notify`** (email su appuntamenti) e **`reminder`** (cron giornaliero) dalla cartella `supabase/functions/`:

1. Installa la [Supabase CLI](https://supabase.com/docs/guides/cli) (`brew install supabase/tap/supabase`)
2. Segui **`supabase/README.md`** (link progetto, `secrets`, `supabase functions deploy`, webhook e cron)

Script rapido dalla root del repo: `./scripts/deploy-supabase-functions.sh`

---

## 🔑 STEP 3 — Copia le Chiavi API

1. In Supabase, vai su **Project Settings → API**
2. Copia:
   - **Project URL** (es. `https://abcdefgh.supabase.co`)
   - **anon public key** (stringa lunga che inizia con `eyJ...`)
3. Apri il file `index.html` con un editor di testo
4. Trova queste righe (intorno alla riga 250):
   ```javascript
   const SUPABASE_URL  = 'https://XXXXXXXXXXXXXXXX.supabase.co';
   const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.XXXXXXXX';
   ```
5. Sostituisci con i tuoi valori reali

---

## 📤 STEP 4 — Pubblica su GitHub

1. Crea un nuovo repository su https://github.com/new
   - Nome: `barberos` (o quello che vuoi)
   - Visibilità: **Private** ✅ (importante per la sicurezza)
2. Carica i 5 file del progetto:
   - `index.html`
   - `manifest.json`
   - `sw.js`
   - `vercel.json`
   - `supabase_schema.sql` (opzionale, solo per riferimento)

   Puoi farlo trascinando i file nella pagina GitHub dopo aver creato il repo.

---

## 🌐 STEP 5 — Deploy su Vercel

1. Vai su https://vercel.com e clicca **"Add New Project"**
2. Collega il tuo account GitHub
3. Seleziona il repository `barberos`
4. Clicca **"Deploy"** — Vercel detecta tutto automaticamente
5. In ~30 secondi l'app è online su un URL tipo `barberos-xxx.vercel.app`

---

## 👑 STEP 6 — Crea il tuo Account Admin

1. Apri la tua app all'URL Vercel
2. Registrati con la tua email e password
3. Torna su Supabase → **SQL Editor** → New Query
4. Esegui questo SQL (sostituisci con la tua email):
   ```sql
   UPDATE profiles SET role = 'ADMIN'
   WHERE id = (SELECT id FROM auth.users WHERE email = 'tua@email.it');
   ```
5. Ricarica l'app → sei ora Admin!

---

## ✂️ STEP 7 — Crea i Barbieri

1. Accedi come Admin
2. Vai su **Dashboard → Barbieri**
3. Clicca **"+ Aggiungi Barbiere"**
4. Inserisci nome, cognome, email e password temporanea
5. Il barbiere riceverà un'email di conferma da Supabase
6. Dopo la conferma, può accedere con le sue credenziali

---

## 📱 STEP 8 — Installa l'App sul Telefono

### Su iPhone (Safari):
1. Apri l'URL dell'app in Safari
2. Tocca il tasto **Condividi** (icona con freccia su)
3. Scorri e tocca **"Aggiungi a schermata Home"**
4. Conferma → l'app appare come icona sul telefono

### Su Android (Chrome):
1. Apri l'URL in Chrome
2. Tocca i **3 puntini** in alto a destra
3. Tocca **"Aggiungi a schermata Home"** o il banner "Installa app"
4. Conferma → l'app appare come icona sul telefono

---

## 🔒 SICUREZZA — Note Importanti

- La chiave `anon` di Supabase è sicura da usare nel frontend
- Le **Row Level Security (RLS) policies** proteggono tutti i dati:
  - I clienti vedono solo i propri appuntamenti
  - I barbieri vedono solo il loro calendario
  - Solo l'Admin vede tutto
- Usa sempre un repository **privato** su GitHub

---

## 💰 COSTI — Tutto Gratuito Per Sempre

| Servizio | Piano Free | Limiti |
|----------|-----------|--------|
| Supabase | ✅ Free    | 500MB DB, 50k auth users, 2GB bandwidth |
| Vercel   | ✅ Free    | 100GB bandwidth, deploy illimitati |
| PWA      | ✅ Free    | Nessun App Store, nessuna commissione |

Una barberia con 3 barbieri e 200 clienti usa ~5MB di dati — sei lontanissimo dai limiti.

---

## 🆘 Problemi Comuni

**"Invalid API key"** → Ricontrolla di aver copiato correttamente URL e anon key in index.html

**"Email not confirmed"** → Supabase richiede la conferma email. Vai su Supabase → Authentication → Settings → disabilita "Enable email confirmations" per i test

**L'app non si installa come PWA** → Assicurati di aprirla con HTTPS (Vercel lo attiva automaticamente)

**I barbieri non ricevono l'email** → Controlla lo spam, oppure vai su Supabase → Authentication → Users e conferma manualmente l'utente

---

## 📞 Struttura Account

```
ADMIN (tu)
├── Gestisce barbieri e servizi
├── Vede tutte le prenotazioni
└── Dashboard statistiche

BARBIERI (il tuo staff)
├── Calendario appuntamenti personale
├── Segna completati/cancellati
└── Proprio login dedicato

CLIENTI (i tuoi clienti)
├── Si registrano autonomamente
├── Prenotano in autonomia 24/7
└── Vedono solo i propri appuntamenti
```

---

*BarberOS — Costruito con Supabase + Vercel. 100% gratuito.*

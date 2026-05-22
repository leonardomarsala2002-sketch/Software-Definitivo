/**
 * Script one-time per generare il Google Calendar OAuth2 refresh token.
 *
 * PRE-REQUISITI:
 *   1. Crea un progetto Google Cloud: https://console.cloud.google.com/
 *   2. Abilita Google Calendar API
 *   3. Crea credenziali OAuth2 "Desktop App"
 *   4. Scarica il JSON delle credenziali
 *
 * UTILIZZO:
 *   npx tsx scripts/setup-google-calendar.ts \
 *     --client-id=<YOUR_CLIENT_ID> \
 *     --client-secret=<YOUR_CLIENT_SECRET>
 *
 * OUTPUT:
 *   Stampa il refresh_token da salvare nel Vault Supabase come GOOGLE_REFRESH_TOKEN.
 *
 * SEGRETI DA AGGIUNGERE AL VAULT SUPABASE (Settings → Vault):
 *   GOOGLE_CLIENT_ID      — OAuth2 client ID
 *   GOOGLE_CLIENT_SECRET  — OAuth2 client secret
 *   GOOGLE_REFRESH_TOKEN  — token generato da questo script
 *   GOOGLE_CALENDAR_ID    — ID del calendario (es. "primary" o "xyz@group.calendar.google.com")
 */

import * as readline from "node:readline";
import * as http from "node:http";
import * as https from "node:https";
import { URL } from "node:url";

const REDIRECT_URI = "http://localhost:8765/oauth2callback";
const SCOPES = ["https://www.googleapis.com/auth/calendar"];

function parseArgs(): { clientId: string; clientSecret: string } {
  const args = Object.fromEntries(
    process.argv.slice(2).map((arg) => {
      const [k, v] = arg.replace(/^--/, "").split("=");
      return [k, v];
    })
  );

  const clientId = args["client-id"];
  const clientSecret = args["client-secret"];

  if (!clientId || !clientSecret) {
    console.error(
      "\nUtilizzo: npx tsx scripts/setup-google-calendar.ts \\\n" +
      "  --client-id=<CLIENT_ID> \\\n" +
      "  --client-secret=<CLIENT_SECRET>\n"
    );
    process.exit(1);
  }

  return { clientId, clientSecret };
}

async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; refresh_token: string }> {
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: REDIRECT_URI,
    grant_type: "authorization_code",
  });

  return new Promise((resolve, reject) => {
    const postData = body.toString();
    const options = {
      hostname: "oauth2.googleapis.com",
      path: "/token",
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) reject(new Error(`Google OAuth error: ${parsed.error} — ${parsed.error_description}`));
          else resolve(parsed);
        } catch {
          reject(new Error(`Risposta non valida: ${data}`));
        }
      });
    });

    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

async function waitForAuthCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url!, `http://localhost:8765`);
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });

      if (error) {
        res.end(`<h2>Errore: ${error}</h2><p>Chiudi questa finestra.</p>`);
        server.close();
        reject(new Error(`OAuth error: ${error}`));
        return;
      }

      if (code) {
        res.end(
          "<h2>✅ Autorizzazione completata!</h2>" +
          "<p>Puoi chiudere questa finestra e tornare al terminale.</p>"
        );
        server.close();
        resolve(code);
      }
    });

    server.listen(8765, "localhost", () => {});
    server.on("error", reject);

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error("Timeout: nessuna autorizzazione ricevuta entro 5 minuti"));
    }, 5 * 60 * 1000);
  });
}

async function main() {
  const { clientId, clientSecret } = parseArgs();

  const authUrl =
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: SCOPES.join(" "),
      access_type: "offline",
      prompt: "consent",
    }).toString();

  console.log("\n=== Setup Google Calendar OAuth2 ===\n");
  console.log("1. Apri questo URL nel browser:");
  console.log("\n" + authUrl + "\n");
  console.log("2. Accedi con l'account Google che gestisce il calendario.");
  console.log("3. Autorizza l'accesso quando richiesto.");
  console.log("\nIn attesa del callback OAuth2 su http://localhost:8765 ...\n");

  let code: string;
  try {
    code = await waitForAuthCode();
  } catch (err) {
    console.error("Errore nel ricevere il codice di autorizzazione:", err);
    process.exit(1);
  }

  console.log("✅ Codice di autorizzazione ricevuto. Scambio per tokens...\n");

  let tokens: { access_token: string; refresh_token: string };
  try {
    tokens = await exchangeCodeForTokens(code, clientId, clientSecret);
  } catch (err) {
    console.error("Errore nello scambio del codice:", err);
    process.exit(1);
  }

  if (!tokens.refresh_token) {
    console.error(
      "⚠️  Nessun refresh_token ricevuto.\n" +
      "   Rimuovi l'accesso all'app da https://myaccount.google.com/permissions\n" +
      "   e riesegui lo script (serve il parametro prompt=consent)."
    );
    process.exit(1);
  }

  console.log("=".repeat(60));
  console.log("✅ CONFIGURAZIONE COMPLETATA\n");
  console.log("Aggiungi questi segreti nel Vault Supabase:");
  console.log("  Dashboard → Settings → Vault → New Secret\n");
  console.log(`GOOGLE_CLIENT_ID      = ${clientId}`);
  console.log(`GOOGLE_CLIENT_SECRET  = ${clientSecret}`);
  console.log(`GOOGLE_REFRESH_TOKEN  = ${tokens.refresh_token}`);
  console.log(`GOOGLE_CALENDAR_ID    = primary`);
  console.log("\n(Per GOOGLE_CALENDAR_ID usa 'primary' per il calendario principale");
  console.log(" oppure l'ID specifico da Google Calendar → Impostazioni → Integra calendario)");
  console.log("=".repeat(60));
}

main();

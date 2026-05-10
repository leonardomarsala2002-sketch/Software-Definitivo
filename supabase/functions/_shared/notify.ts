// Modulo di notifica multi-canale: in-app, email (Resend), WhatsApp (Twilio).
// Nessun canale è bloccante: se non configurato o se fallisce, logga e continua.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export interface NotifyPayload {
  userId: string;
  storeId?: string;
  type: string;
  title: string;
  body: string;
  link?: string;
}

export interface NotifyEnv {
  resendApiKey?: string;
  publicAppUrl?: string;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioFromNumber?: string;
}

type AdminClient = ReturnType<typeof createClient>;

// ─── In-app ──────────────────────────────────────────────────────────────────

export async function notifyInApp(
  adminClient: AdminClient,
  payload: NotifyPayload,
): Promise<void> {
  const { error } = await adminClient.from("notifications").insert({
    user_id:  payload.userId,
    store_id: payload.storeId ?? null,
    type:     payload.type,
    title:    payload.title,
    message:  payload.body,
    link:     payload.link ?? null,
    channel:  "in-app",
    sent_at:  new Date().toISOString(),
  });
  if (error) throw new Error(`in-app insert failed: ${error.message}`);
}

// ─── Email (Resend) ───────────────────────────────────────────────────────────

export async function notifyEmail(
  adminClient: AdminClient,
  payload: NotifyPayload & { email: string; htmlBody?: string },
  env: NotifyEnv,
): Promise<void> {
  if (!env.resendApiKey) return; // non configurato → skip silenzioso

  const html = payload.htmlBody ?? `<p style="font-family:sans-serif">${payload.body}</p>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from:    "Shift Scheduler <onboarding@resend.dev>",
      to:      [payload.email],
      subject: payload.title,
      html,
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Resend failed ${res.status}: ${txt}`);
  }

  // Log email nel DB
  await adminClient.from("notifications").insert({
    user_id:  payload.userId,
    store_id: payload.storeId ?? null,
    type:     payload.type,
    title:    payload.title,
    message:  payload.body,
    link:     payload.link ?? null,
    channel:  "email",
    sent_at:  new Date().toISOString(),
  }).then(() => {});  // non bloccante
}

// ─── WhatsApp (Twilio) — feature-flagged ─────────────────────────────────────

export async function notifyWhatsApp(
  adminClient: AdminClient,
  payload: NotifyPayload & { phone: string },
  env: NotifyEnv,
): Promise<void> {
  // Skip silenzioso se le credenziali Twilio non sono configurate
  if (!env.twilioAccountSid || !env.twilioAuthToken || !env.twilioFromNumber) return;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${env.twilioAccountSid}/Messages.json`;
  const body = new URLSearchParams({
    From: `whatsapp:${env.twilioFromNumber}`,
    To:   `whatsapp:${payload.phone}`,
    Body: `*${payload.title}*\n\n${payload.body}`,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization:  `Basic ${btoa(`${env.twilioAccountSid}:${env.twilioAuthToken}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Twilio WA failed ${res.status}: ${txt}`);
  }

  // Log WhatsApp notification in DB (consistent with email channel)
  await adminClient.from("notifications").insert({
    user_id:  payload.userId,
    store_id: payload.storeId ?? null,
    type:     payload.type,
    title:    payload.title,
    message:  payload.body,
    link:     payload.link ?? null,
    channel:  "whatsapp",
    sent_at:  new Date().toISOString(),
  }).then(() => {}); // non-blocking
}

// ─── Funzione convenience ─────────────────────────────────────────────────────

export async function sendNotification(
  adminClient: AdminClient,
  payload: NotifyPayload,
  channels: ("in-app" | "email" | "whatsapp")[],
  env: NotifyEnv,
  extras?: { email?: string; phone?: string; htmlBody?: string },
): Promise<void> {
  const tasks: Promise<void>[] = [];

  if (channels.includes("in-app")) {
    tasks.push(
      notifyInApp(adminClient, payload).catch(e =>
        console.error("[notify] in-app failed:", e),
      ),
    );
  }

  if (channels.includes("email") && extras?.email) {
    tasks.push(
      notifyEmail(
        adminClient,
        { ...payload, email: extras.email, htmlBody: extras.htmlBody },
        env,
      ).catch(e => console.error("[notify] email failed:", e)),
    );
  }

  if (channels.includes("whatsapp") && extras?.phone) {
    tasks.push(
      notifyWhatsApp(adminClient, { ...payload, phone: extras.phone }, env).catch(e =>
        console.error("[notify] whatsapp failed:", e),
      ),
    );
  }

  await Promise.all(tasks);
}

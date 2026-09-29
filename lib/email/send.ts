import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

// One seam for every outbound email, so the provider is an env change
// rather than a rewrite. This app had no email at all before: invites and
// imports generated a password and discarded it, and "forgot password" was
// a static page telling students to phone the placement cell.
//
// EMAIL_DRIVER:
//   log   (default) — writes the message to .mail/ and the server log.
//                     Nothing leaves the machine. Lets the whole flow be
//                     built and tested before anyone has SMTP credentials.
//   smtp            — any SMTP server: the college's own mail host, AWS SES's
//                     SMTP endpoint, Resend, Postmark. Needs `nodemailer`.
//   noop            — silently drops mail. For CI.

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export type EmailResult = { delivered: boolean; driver: string; detail?: string };

function fromAddress(): string {
  return process.env.EMAIL_FROM?.trim() || "Placement ERP <no-reply@placement-erp.local>";
}

function driverName(): string {
  return (process.env.EMAIL_DRIVER?.trim() || "log").toLowerCase();
}

/** True when real delivery is configured — callers use this to decide
 *  whether to also surface a temp password for manual hand-off. */
export function emailDeliveryConfigured(): boolean {
  const driver = driverName();
  if (driver === "smtp") return Boolean(process.env.SMTP_HOST?.trim());
  return false;
}

async function sendViaLog(message: EmailMessage): Promise<EmailResult> {
  const dir = join(process.cwd(), ".mail");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeTo = message.to.replace(/[^a-zA-Z0-9@._-]/g, "_");
  const file = join(dir, `${stamp}-${safeTo}.txt`);
  const body = [
    `From: ${fromAddress()}`,
    `To: ${message.to}`,
    `Subject: ${message.subject}`,
    "",
    message.text,
    "",
    "--- HTML ---",
    message.html,
    "",
  ].join("\n");

  try {
    await mkdir(dir, { recursive: true });
    await writeFile(file, body, "utf8");
  } catch {
    // Never let a mail-capture failure break the request that triggered it.
  }
  console.info(`[email:log] to=${message.to} subject="${message.subject}" saved=${file}`);
  return { delivered: false, driver: "log", detail: file };
}

async function sendViaSmtp(message: EmailMessage): Promise<EmailResult> {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) {
    console.warn("[email:smtp] SMTP_HOST is not set — falling back to the log driver.");
    return sendViaLog(message);
  }

  let nodemailer: typeof import("nodemailer");
  try {
    // Imported lazily so the package is only required when SMTP is actually
    // selected — the log driver has no dependencies at all.
    nodemailer = (await import("nodemailer")).default as unknown as typeof import("nodemailer");
  } catch {
    console.error("[email:smtp] `nodemailer` is not installed. Run `npm i nodemailer` or set EMAIL_DRIVER=log.");
    return { delivered: false, driver: "smtp", detail: "nodemailer_missing" };
  }

  const port = Number(process.env.SMTP_PORT ?? 587);
  const transport = nodemailer.createTransport({
    host,
    port,
    // 465 is implicit TLS; 587 upgrades with STARTTLS.
    secure: port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD ?? "" }
      : undefined,
  });

  try {
    const info = await transport.sendMail({
      from: fromAddress(),
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    return { delivered: true, driver: "smtp", detail: info.messageId };
  } catch (error) {
    // Logged, never thrown: a mail outage must not roll back the invite or
    // import that triggered it. The caller still has the reset link.
    console.error("[email:smtp] send failed:", error instanceof Error ? error.message : error);
    return { delivered: false, driver: "smtp", detail: "send_failed" };
  }
}

export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const driver = driverName();
  if (driver === "noop") return { delivered: false, driver: "noop" };
  if (driver === "smtp") return sendViaSmtp(message);
  return sendViaLog(message);
}

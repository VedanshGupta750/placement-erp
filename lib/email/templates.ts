import "server-only";
import { PWA_CONFIG } from "@/lib/pwa/config";
import type { EmailMessage } from "@/lib/email/send";

// Plain, inline-styled HTML with a text alternative. Mail clients strip
// <style> blocks and external CSS, so nothing here relies on either.

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function layout(heading: string, bodyHtml: string, actionUrl: string, actionLabel: string): string {
  const app = escapeHtml(PWA_CONFIG.name);
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f4f4f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px;">
    <p style="margin:0 0 4px;font-size:13px;color:#71717a;">${app}</p>
    <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;">${escapeHtml(heading)}</h1>
    ${bodyHtml}
    <p style="margin:24px 0;">
      <a href="${actionUrl}" style="display:inline-block;background:#7c5cfc;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:600;font-size:15px;">${escapeHtml(actionLabel)}</a>
    </p>
    <p style="margin:0 0 4px;font-size:13px;color:#71717a;">If the button doesn't work, paste this into your browser:</p>
    <p style="margin:0;font-size:12px;color:#71717a;word-break:break-all;">${escapeHtml(actionUrl)}</p>
  </div>
</body></html>`;
}

export function setPasswordEmail(params: { name: string; url: string; expiresInHours: number }): EmailMessage {
  const heading = `Set your ${PWA_CONFIG.name} password`;
  const intro = `Hi ${params.name}, an account has been created for you on ${PWA_CONFIG.name}. Choose a password to activate it.`;
  return {
    to: "",
    subject: heading,
    text: `${intro}\n\nSet your password: ${params.url}\n\nThis link expires in ${params.expiresInHours} hours. If you weren't expecting this, you can ignore this email.`,
    html: layout(
      heading,
      `<p style="margin:0 0 12px;font-size:15px;line-height:1.55;">${escapeHtml(intro)}</p>
       <p style="margin:0;font-size:14px;color:#52525b;">This link expires in ${params.expiresInHours} hours.</p>`,
      params.url,
      "Set my password",
    ),
  };
}

export function resetPasswordEmail(params: { name: string; url: string; expiresInHours: number }): EmailMessage {
  const heading = "Reset your password";
  const intro = `Hi ${params.name}, we received a request to reset your ${PWA_CONFIG.name} password.`;
  return {
    to: "",
    subject: `${heading} — ${PWA_CONFIG.name}`,
    text: `${intro}\n\nReset it here: ${params.url}\n\nThis link expires in ${params.expiresInHours} hours. If you didn't ask for this, ignore this email — your password stays as it is.`,
    html: layout(
      heading,
      `<p style="margin:0 0 12px;font-size:15px;line-height:1.55;">${escapeHtml(intro)}</p>
       <p style="margin:0;font-size:14px;color:#52525b;">This link expires in ${params.expiresInHours} hours. If you didn't ask for this, ignore this email — your password stays as it is.</p>`,
      params.url,
      "Reset my password",
    ),
  };
}

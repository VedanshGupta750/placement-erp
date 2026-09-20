import webpush from "web-push";

let configuredKey: string | null = null;

export function getVapidConfig() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();
  const keyId = process.env.VAPID_KEY_ID?.trim() || "default";

  if (!publicKey || !privateKey || !subject) return null;
  if (!subject.startsWith("mailto:") && !subject.startsWith("https://")) return null;

  const fingerprint = `${keyId}:${publicKey}`;
  if (configuredKey !== fingerprint) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configuredKey = fingerprint;
  }

  return { publicKey, keyId };
}

export { webpush };


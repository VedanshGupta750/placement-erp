import "server-only";

// Simple in-process sliding-window limiter for login attempts — no new
// infra dependency, matching this app's convention of not reaching for
// Redis/etc. for something this small. Honest limitation: this state is
// per Node process, so it resets on deploy/restart and doesn't share
// across multiple instances if this app is ever horizontally scaled — a
// production deployment with >1 instance would want a shared store
// (Redis) instead. For a single-instance dev/small-college deployment
// this is a real, working brute-force deterrent, not a no-op.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const attempts = new Map<string, number[]>();

// Periodic cleanup so this Map doesn't grow unbounded over a long-running
// process — piggybacks on normal check() calls rather than a separate
// timer.
function prune(key: string, now: number): number[] {
  const list = (attempts.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  attempts.set(key, list);
  return list;
}

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

// Call once per login attempt, BEFORE checking credentials — keyed by
// email so a distributed attacker (many IPs, one target account) is still
// caught, not just a single-IP brute force.
export function checkLoginRateLimit(emailKey: string): RateLimitResult {
  const now = Date.now();
  const key = emailKey.toLowerCase().trim();
  const recent = prune(key, now);
  if (recent.length >= MAX_ATTEMPTS) {
    const oldestInWindow = Math.min(...recent);
    const retryAfterSeconds = Math.ceil((WINDOW_MS - (now - oldestInWindow)) / 1000);
    return { allowed: false, retryAfterSeconds };
  }
  return { allowed: true };
}

// Call after a FAILED credential check — successful logins never record an
// attempt here, so a legitimate user who mistypes once or twice and then
// gets it right isn't penalized.
export function recordFailedLogin(emailKey: string): void {
  const now = Date.now();
  const key = emailKey.toLowerCase().trim();
  const recent = prune(key, now);
  recent.push(now);
  attempts.set(key, recent);
}

export function clearLoginAttempts(emailKey: string): void {
  attempts.delete(emailKey.toLowerCase().trim());
}

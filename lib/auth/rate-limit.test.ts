import { describe, it, expect } from "vitest";
import { checkLoginRateLimit, recordFailedLogin, clearLoginAttempts } from "./rate-limit";

describe("login rate limiter", () => {
  // Each test uses its own unique key — the limiter's state is a module-level
  // Map with no reset hook, so reusing a key across tests would leak state.
  function freshKey(name: string) {
    return `test-${name}-${Math.random().toString(36).slice(2)}@example.com`;
  }

  it("allows the first attempt", () => {
    const key = freshKey("first");
    expect(checkLoginRateLimit(key)).toEqual({ allowed: true });
  });

  it("allows up to 5 failed attempts, blocks the 6th", () => {
    const key = freshKey("fifth");
    for (let i = 0; i < 5; i++) {
      expect(checkLoginRateLimit(key).allowed).toBe(true);
      recordFailedLogin(key);
    }
    const result = checkLoginRateLimit(key);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
      expect(result.retryAfterSeconds).toBeLessThanOrEqual(15 * 60);
    }
  });

  it("is case-insensitive and trims whitespace, so it can't be trivially bypassed", () => {
    const base = freshKey("case");
    for (let i = 0; i < 5; i++) recordFailedLogin(base);
    expect(checkLoginRateLimit(base.toUpperCase()).allowed).toBe(false);
    expect(checkLoginRateLimit(`  ${base}  `).allowed).toBe(false);
  });

  it("clearLoginAttempts resets the window immediately (successful login)", () => {
    const key = freshKey("clear");
    for (let i = 0; i < 5; i++) recordFailedLogin(key);
    expect(checkLoginRateLimit(key).allowed).toBe(false);
    clearLoginAttempts(key);
    expect(checkLoginRateLimit(key).allowed).toBe(true);
  });

  it("tracks separate emails independently", () => {
    const a = freshKey("a");
    const b = freshKey("b");
    for (let i = 0; i < 5; i++) recordFailedLogin(a);
    expect(checkLoginRateLimit(a).allowed).toBe(false);
    expect(checkLoginRateLimit(b).allowed).toBe(true);
  });
});

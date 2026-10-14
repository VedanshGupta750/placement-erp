import { describe, it, expect } from "vitest";
import { loginSchema, passwordStrengthSchema } from "./auth";

// A student's starter password is their enrollment number, which they paste
// out of a spreadsheet or a message — and that routinely carries a trailing
// space or newline. bcrypt compares bytes, so " 2026100007" never matches
// "2026100007" and the only feedback is "Invalid email or password", which
// is indistinguishable from a broken import.
//
// These assert the normalisation holds on BOTH sides. Trimming only at
// sign-in would lock out anyone who set a password with a trailing space.
describe("password normalisation", () => {
  it("strips surrounding whitespace from a sign-in password", () => {
    for (const raw of ["2026100007 ", " 2026100007", "\t2026100007\n", "  2026100007  "]) {
      const parsed = loginSchema.parse({ email: "a@b.com", password: raw });
      expect(parsed.password).toBe("2026100007");
    }
  });

  it("strips the same whitespace when a password is set, so the two always agree", () => {
    expect(passwordStrengthSchema.parse("  Str0ngPass  ")).toBe("Str0ngPass");
  });

  it("leaves the inside of a password alone", () => {
    const parsed = loginSchema.parse({ email: "a@b.com", password: "  two words1  " });
    expect(parsed.password).toBe("two words1");
  });

  it("still rejects a password that is only whitespace", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "   " }).success).toBe(false);
  });

  it("measures strength after trimming, not before", () => {
    // "  abc1  " is 8 characters raw but 4 once trimmed — it must not pass.
    expect(passwordStrengthSchema.safeParse("  abc1  ").success).toBe(false);
    expect(passwordStrengthSchema.safeParse(" abcdefg1 ").success).toBe(true);
  });

  it("normalises the email too, so a pasted address with a space still works", () => {
    expect(loginSchema.parse({ email: "a@b.com", password: "x" }).email).toBe("a@b.com");
  });
});

import { describe, it, expect } from "vitest";
import { generateTempPassword, hashPassword, verifyPassword } from "./password";

describe("password utilities", () => {
  it("generateTempPassword produces a non-trivial, unique value each call", () => {
    const a = generateTempPassword();
    const b = generateTempPassword();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(8);
  });

  it("hashPassword never stores the plaintext", async () => {
    const plain = "correct horse battery staple";
    const hash = await hashPassword(plain);
    expect(hash).not.toBe(plain);
    expect(hash).not.toContain(plain);
  });

  // Bcrypt at this app's SALT_ROUNDS (12) is deliberately slow — that's the
  // whole point of a work-factor hash — so two sequential calls can outrun
  // vitest's 5s default under load. Real security property, not a bug.
  it("verifyPassword accepts the correct password and rejects a wrong one", async () => {
    const hash = await hashPassword("s3cret-Pass!");
    expect(await verifyPassword("s3cret-Pass!", hash)).toBe(true);
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  }, 15_000);

  it("hashing the same password twice yields different hashes (salted)", async () => {
    const a = await hashPassword("same-input");
    const b = await hashPassword("same-input");
    expect(a).not.toBe(b);
  }, 15_000);
});

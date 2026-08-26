import { describe, expect, it } from "vitest";
import { generateApiKeyToken, hashApiKeyToken } from "../lib/auth/api-keys";

describe("generateApiKeyToken", () => {
  it("produces a prefixed, high-entropy token with a matching lookup prefix", () => {
    const { token, prefix } = generateApiKeyToken();
    expect(token.startsWith("slk_")).toBe(true);
    expect(token.length).toBeGreaterThan(40);
    expect(token.slice(4, 12)).toBe(prefix);
    expect(prefix).toHaveLength(8);
  });

  it("never repeats across calls", () => {
    const tokens = new Set(Array.from({ length: 20 }, () => generateApiKeyToken().token));
    expect(tokens.size).toBe(20);
  });
});

describe("hashApiKeyToken", () => {
  it("is deterministic", () => {
    const { token } = generateApiKeyToken();
    expect(hashApiKeyToken(token)).toBe(hashApiKeyToken(token));
  });

  it("differs for different tokens", () => {
    const a = generateApiKeyToken().token;
    const b = generateApiKeyToken().token;
    expect(hashApiKeyToken(a)).not.toBe(hashApiKeyToken(b));
  });

  it("never stores the raw token", () => {
    const { token } = generateApiKeyToken();
    expect(hashApiKeyToken(token)).not.toContain(token);
  });
});

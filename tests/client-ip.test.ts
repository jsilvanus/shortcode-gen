import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getTrustedClientIp } from "../lib/security/client-ip";

function headersWith(entries: Record<string, string>): Headers {
  return new Headers(entries);
}

describe("getTrustedClientIp", () => {
  const originalHops = process.env.TRUSTED_PROXY_HOPS;
  afterEach(() => {
    if (originalHops === undefined) delete process.env.TRUSTED_PROXY_HOPS;
    else process.env.TRUSTED_PROXY_HOPS = originalHops;
  });

  describe("with the default of one trusted hop", () => {
    beforeEach(() => { delete process.env.TRUSTED_PROXY_HOPS; });

    it("trusts the last entry, which the proxy itself appended", () => {
      const headers = headersWith({ "x-forwarded-for": "203.0.113.9" });
      expect(getTrustedClientIp(headers)).toBe("203.0.113.9");
    });

    it("ignores client-forged entries in front of the proxy's own append", () => {
      const spoofed = headersWith({ "x-forwarded-for": "evil-attacker-controlled-value, 203.0.113.9" });
      expect(getTrustedClientIp(spoofed)).toBe("203.0.113.9");
    });

    it("is not fooled by a client sending a longer forged chain", () => {
      const spoofed = headersWith({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, 3.3.3.3, 203.0.113.9" });
      expect(getTrustedClientIp(spoofed)).toBe("203.0.113.9");
    });

    it("falls back to x-real-ip when there is no x-forwarded-for", () => {
      expect(getTrustedClientIp(headersWith({ "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
    });

    it("falls back to a constant when no IP information is present at all", () => {
      expect(getTrustedClientIp(headersWith({}))).toBe("unknown");
    });
  });

  describe("with two trusted hops configured", () => {
    beforeEach(() => { process.env.TRUSTED_PROXY_HOPS = "2"; });

    it("trusts the second-to-last entry", () => {
      const headers = headersWith({ "x-forwarded-for": "attacker-forged, 203.0.113.9, 10.0.0.1" });
      expect(getTrustedClientIp(headers)).toBe("203.0.113.9");
    });

    it("fails closed into a shared bucket when the chain is shorter than the configured hop count", () => {
      const headers = headersWith({ "x-forwarded-for": "only-one-entry" });
      expect(getTrustedClientIp(headers)).toBe("untrusted-forwarded-for");
    });
  });

  describe("with zero trusted hops (no reverse proxy at all)", () => {
    beforeEach(() => { process.env.TRUSTED_PROXY_HOPS = "0"; });

    it("never trusts x-forwarded-for, however short", () => {
      expect(getTrustedClientIp(headersWith({ "x-forwarded-for": "203.0.113.9" }))).toBe("untrusted-forwarded-for");
    });
  });

  it("treats a malformed TRUSTED_PROXY_HOPS value as the default of one", () => {
    process.env.TRUSTED_PROXY_HOPS = "not-a-number";
    const headers = headersWith({ "x-forwarded-for": "attacker-forged, 203.0.113.9" });
    expect(getTrustedClientIp(headers)).toBe("203.0.113.9");
  });
});

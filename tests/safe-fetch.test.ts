import { describe, expect, it } from "vitest";
import { isPrivateAddress } from "../lib/security/safe-fetch";

describe("SSRF address checks", () => {
  it("rejects loopback and RFC1918 IPv4", () => {
    expect(isPrivateAddress("127.0.0.1")).toBe(true);
    expect(isPrivateAddress("10.0.0.1")).toBe(true);
    expect(isPrivateAddress("172.16.0.1")).toBe(true);
    expect(isPrivateAddress("192.168.1.1")).toBe(true);
    expect(isPrivateAddress("8.8.8.8")).toBe(false);
  });

  it("rejects loopback and unique-local IPv6", () => {
    expect(isPrivateAddress("::1")).toBe(true);
    expect(isPrivateAddress("fd00::1")).toBe(true);
    expect(isPrivateAddress("2001:4860:4860::8888")).toBe(false);
  });

  it("fails closed for unknown address formats", () => {
    expect(isPrivateAddress("not-an-ip")).toBe(true);
  });
});

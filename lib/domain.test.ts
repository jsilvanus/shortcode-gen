import { describe, expect, it } from "vitest";
import { normalizeHostname } from "./domain";

describe("normalizeHostname", () => {
  it("normalizes case and a trailing dot", () => {
    expect(normalizeHostname("Short.ABC.COM.")).toBe("short.abc.com");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeHostname("  short.abc.com  ")).toBe("short.abc.com");
  });

  it("rejects URLs", () => {
    expect(() => normalizeHostname("https://short.abc.com")).toThrow();
  });

  it("rejects paths, ports and credentials", () => {
    expect(() => normalizeHostname("short.abc.com/path")).toThrow();
    expect(() => normalizeHostname("short.abc.com:443")).toThrow();
    expect(() => normalizeHostname("user@short.abc.com")).toThrow();
  });

  it("rejects invalid hostname labels", () => {
    expect(() => normalizeHostname("-short.abc.com")).toThrow();
    expect(() => normalizeHostname("short-.abc.com")).toThrow();
    expect(() => normalizeHostname("short_abc.com")).toThrow();
  });
});

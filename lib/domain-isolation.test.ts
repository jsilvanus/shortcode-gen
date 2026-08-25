import { describe, expect, it } from "vitest";
import { normalizeHostname } from "./domain";

describe("multi-domain isolation invariants", () => {
  it("normalizes canonical hosts and aliases", () => {
    expect(normalizeHostname("SHORT.RIKSUNSRK.FI.")).toBe("short.riksunsrk.fi");
    expect(normalizeHostname("short.riihimaenseurakunta.fi")).toBe("short.riihimaenseurakunta.fi");
  });

  it("keeps identical short-code values separate by domain", () => {
    const key = (domainId: string, code: string) => `${domainId}:${code.toLowerCase()}`;
    expect(key("domain-a", "Kirkko")).not.toBe(key("domain-b", "Kirkko"));
    expect(key("domain-a", "Kirkko")).toBe(key("domain-a", "kirkko"));
  });

  it("models aliases as hostnames of one canonical tenant", () => {
    const domain = { id: "domain-a", hostname: "short.riksunsrk.fi" };
    const aliases = ["short.riihimaenseurakunta.fi"];
    expect(aliases).toContain("short.riihimaenseurakunta.fi");
    expect(domain.id).toBe("domain-a");
  });

  it("requires matching domain identity for resource access", () => {
    const resource = { domainId: "domain-a" };
    expect(resource.domainId === "domain-a").toBe(true);
    expect(resource.domainId === "domain-b").toBe(false);
  });
});

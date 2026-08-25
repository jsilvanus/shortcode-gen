import { describe, expect, it } from "vitest";
import { canEditLink, canManageSiteSettings, canViewLink } from "../lib/auth/authorization";

describe("link authorization matrix", () => {
  const owner = "owner";
  const other = "other";

  it("allows owner to view/edit private links", () => {
    expect(canViewLink("USER", owner, owner, true)).toBe(true);
    expect(canEditLink("USER", owner, owner, true)).toBe(true);
  });

  it("blocks other users from private links", () => {
    expect(canViewLink("USER", owner, other, true)).toBe(false);
    expect(canEditLink("USER", owner, other, true)).toBe(false);
  });

  it("allows authenticated users to view/edit public links", () => {
    expect(canViewLink("USER", owner, other, false)).toBe(true);
    expect(canEditLink("USER", owner, other, false)).toBe(true);
  });

  it("allows admins to view/edit every link", () => {
    expect(canViewLink("ADMIN", owner, other, true)).toBe(true);
    expect(canEditLink("ADMIN", owner, other, true)).toBe(true);
  });

  it("keeps site settings admin-only", () => {
    expect(canManageSiteSettings("USER")).toBe(false);
    expect(canManageSiteSettings("ADMIN")).toBe(true);
  });
});

describe("authorization invariants", () => {
  it("never grants private-link access to a different non-admin user", () => {
    for (const role of ["USER"] as const) {
      expect(canViewLink(role, "a", "b", true)).toBe(false);
      expect(canEditLink(role, "a", "b", true)).toBe(false);
    }
  });
});

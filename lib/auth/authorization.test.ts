import { describe, expect, it } from "vitest";
import { canEditLink, canManageSiteSettings, canViewLink } from "./authorization";

describe("link authorization", () => {
  it("allows owners to view and edit private links", () => {
    expect(canViewLink("USER", "u1", "u1", true)).toBe(true);
    expect(canEditLink("USER", "u1", "u1", true)).toBe(true);
  });

  it("keeps private links invisible and immutable to other users", () => {
    expect(canViewLink("USER", "u1", "u2", true)).toBe(false);
    expect(canEditLink("USER", "u1", "u2", true)).toBe(false);
  });

  it("allows authenticated users to view and edit public links", () => {
    expect(canViewLink("USER", "u1", "u2", false)).toBe(true);
    expect(canEditLink("USER", "u1", "u2", false)).toBe(true);
  });

  it("gives admins access to every link and site settings", () => {
    expect(canViewLink("ADMIN", "u1", "u2", true)).toBe(true);
    expect(canEditLink("ADMIN", "u1", "u2", true)).toBe(true);
    expect(canManageSiteSettings("ADMIN")).toBe(true);
    expect(canManageSiteSettings("USER")).toBe(false);
  });
});

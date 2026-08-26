import { describe, expect, it, vi, beforeEach } from "vitest";

const jobFindUnique = vi.fn();
const jobUpdate = vi.fn();
const shortLinkUpdate = vi.fn();
const getDomainSettings = vi.fn();
const assertSafeUrl = vi.fn();
const mkdir = vi.fn();
const rename = vi.fn();

vi.mock("@/lib/db", () => ({ db: { job: { findUnique: jobFindUnique, update: jobUpdate }, shortLink: { update: shortLinkUpdate } } }));
vi.mock("@/lib/settings", () => ({ getDomainSettings }));
vi.mock("@/lib/security/safe-fetch", () => ({ assertSafeUrl, safeFetch: vi.fn() }));
vi.mock("node:fs/promises", () => ({ mkdir, rename }));

function fakePage() {
  return {
    setDefaultNavigationTimeout: vi.fn(),
    goto: vi.fn().mockResolvedValue(undefined),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    setViewportSize: vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn().mockResolvedValue({
      title: "Example",
      description: null,
      imageUrl: null,
      canonicalUrl: null,
      faviconUrl: "/favicon.ico",
      finalUrl: "https://allowed.example/page",
    }),
    screenshot: vi.fn().mockResolvedValue(undefined),
  };
}

describe("metadata worker SSRF boundary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders an allowed target only after the SSRF check passes", async () => {
    getDomainSettings.mockResolvedValue({ linkPolicy: { allowedDomains: ["allowed.example"] } });
    assertSafeUrl.mockResolvedValue(undefined);
    jobFindUnique.mockResolvedValue({
      id: "job-1", type: "METADATA", attempts: 0, shortLinkId: "link-1",
      shortLink: { id: "link-1", domainId: "domain-1", targetUrl: "https://allowed.example/page", screenshotDisabled: false, screenshotLandscapePath: null, screenshotPortraitPath: null },
    });
    jobUpdate.mockResolvedValue({});
    shortLinkUpdate.mockResolvedValue({});
    mkdir.mockResolvedValue(undefined);
    rename.mockResolvedValue(undefined);

    const page = fakePage();
    const context = { route: vi.fn(), newPage: vi.fn().mockResolvedValue(page), close: vi.fn() };
    const browser = { newContext: vi.fn().mockResolvedValue(context) };

    const { processMetadataJob } = await import("@/lib/metadata-worker");
    await processMetadataJob("job-1", browser as never);

    expect(assertSafeUrl).toHaveBeenCalledWith("https://allowed.example/page", ["allowed.example"]);
    expect(context.route).toHaveBeenCalledWith("**/*", expect.any(Function));
    expect(page.setViewportSize).toHaveBeenCalledWith({ width: 720, height: 1280 });
    expect(page.screenshot).toHaveBeenCalledTimes(2);
    expect(shortLinkUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "link-1" },
      data: expect.objectContaining({ renderStatus: "completed", renderError: null, screenshotLandscapePath: expect.stringContaining("link-1-landscape.png"), screenshotPortraitPath: expect.stringContaining("link-1-portrait.png") }),
    }));
    expect(jobUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "completed" }),
    }));
  });

  it("does not open a browser context for a target that fails the SSRF check", async () => {
    getDomainSettings.mockResolvedValue({ linkPolicy: { allowedDomains: ["allowed.example"] } });
    assertSafeUrl.mockRejectedValue(new Error("Target resolves to a private or reserved address"));
    jobFindUnique.mockResolvedValue({
      id: "job-2", type: "METADATA", attempts: 0, shortLinkId: "link-2",
      shortLink: { id: "link-2", domainId: "domain-1", targetUrl: "https://allowed.example/redirect-to-private", screenshotDisabled: false, screenshotLandscapePath: null, screenshotPortraitPath: null },
    });
    jobUpdate.mockResolvedValue({});
    shortLinkUpdate.mockResolvedValue({});

    const browser = { newContext: vi.fn() };

    const { processMetadataJob } = await import("@/lib/metadata-worker");
    await processMetadataJob("job-2", browser as never);

    expect(assertSafeUrl).toHaveBeenCalledTimes(1);
    expect(browser.newContext).not.toHaveBeenCalled();
    expect(shortLinkUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ renderError: "Target resolves to a private or reserved address" }),
    }));
    expect(jobUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "pending" }),
    }));
  });
});

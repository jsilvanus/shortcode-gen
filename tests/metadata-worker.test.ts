import { describe, expect, it, vi, beforeEach } from "vitest";

const safeFetch = vi.fn();
const jobFindUnique = vi.fn();
const shortLinkUpdate = vi.fn();
const jobUpdate = vi.fn();

vi.mock("@/lib/security/safe-fetch", () => ({ safeFetch }));
vi.mock("@/lib/db", () => ({ db: { job: { findUnique: jobFindUnique, update: jobUpdate }, shortLink: { update: shortLinkUpdate } } }));

describe("metadata worker SSRF boundary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses safeFetch for the scheduled metadata job", async () => {
    safeFetch.mockResolvedValue({
      finalUrl: "https://allowed.example/page",
      response: new Response("<html><head><title>Example</title></head><body></body></html>", { headers: { "content-type": "text/html" } }),
      body: new TextEncoder().encode("<html><head><title>Example</title></head><body></body></html>"),
    });
    jobFindUnique.mockResolvedValue({
      id: "job-1", type: "METADATA", attempts: 0, shortLinkId: "link-1",
      shortLink: { id: "link-1", targetUrl: "https://allowed.example/page" },
    });
    jobUpdate.mockResolvedValue({});
    shortLinkUpdate.mockResolvedValue({});

    const { processMetadataJob } = await import("@/lib/metadata-worker");
    await processMetadataJob("job-1");

    expect(safeFetch).toHaveBeenCalledWith("https://allowed.example/page", { maxBytes: 1_000_000 });
    expect(shortLinkUpdate).toHaveBeenCalled();
    expect(jobUpdate).toHaveBeenCalled();
  });

  it("does not bypass the fetch boundary for a redirect target", async () => {
    safeFetch.mockRejectedValue(new Error("Blocked private address"));
    jobFindUnique.mockResolvedValue({
      id: "job-2", type: "METADATA", attempts: 0, shortLinkId: "link-2",
      shortLink: { id: "link-2", targetUrl: "https://allowed.example/redirect" },
    });
    jobUpdate.mockResolvedValue({});

    const { processMetadataJob } = await import("@/lib/metadata-worker");
    await processMetadataJob("job-2");

    expect(safeFetch).toHaveBeenCalledTimes(1);
    expect(shortLinkUpdate).not.toHaveBeenCalled();
    expect(jobUpdate).toHaveBeenCalled();
  });
});

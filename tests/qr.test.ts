import { describe, expect, it } from "vitest";
import { generateQrCode } from "../lib/qr";

describe("generateQrCode", () => {
  it("renders an SVG containing the encoded url as a data attribute-free vector", async () => {
    const { body, contentType } = await generateQrCode("https://short.example/A7E4M", "svg");
    expect(contentType).toBe("image/svg+xml");
    expect(typeof body).toBe("string");
    expect(body as string).toContain("<svg");
  });

  it("renders a PNG buffer", async () => {
    const { body, contentType } = await generateQrCode("https://short.example/A7E4M", "png");
    expect(contentType).toBe("image/png");
    expect(Buffer.isBuffer(body)).toBe(true);
    expect((body as Buffer).subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  });

  it("produces different output for different urls", async () => {
    const a = await generateQrCode("https://short.example/AAAAA", "svg");
    const b = await generateQrCode("https://short.example/ZZZZZ", "svg");
    expect(a.body).not.toEqual(b.body);
  });
});

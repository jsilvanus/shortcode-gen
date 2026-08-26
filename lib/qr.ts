import QRCode from "qrcode";

export type QrFormat = "svg" | "png";

export async function generateQrCode(data: string, format: QrFormat): Promise<{ body: string | Buffer; contentType: string }> {
  if (format === "svg") {
    const svg = await QRCode.toString(data, { type: "svg", margin: 2 });
    return { body: svg, contentType: "image/svg+xml" };
  }
  const png = await QRCode.toBuffer(data, { type: "png", margin: 2, width: 512 });
  return { body: png, contentType: "image/png" };
}

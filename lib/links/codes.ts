export const GENERATED_ALPHABET = "0123456789ACDEFHJKMNPQRTUVWXY";

const CUSTOM_CODE_RE = /^[A-Za-z0-9_-]{1,64}$/;

export const RESERVED_CODES = new Set([
  "admin",
  "api",
  "health",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
]);

export function canonicalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

export function isReservedCode(code: string): boolean {
  return RESERVED_CODES.has(code.trim().toLowerCase());
}

export function validateCustomCode(code: string): boolean {
  return CUSTOM_CODE_RE.test(code) && !isReservedCode(code);
}

export function generateCode(length = 7): string {
  if (!Number.isInteger(length) || length < 1) {
    throw new Error("Code length must be a positive integer");
  }

  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);

  return Array.from(bytes, (byte) => GENERATED_ALPHABET[byte % GENERATED_ALPHABET.length]).join("");
}

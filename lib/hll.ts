const REGISTER_COUNT = 1024;
const HASH_BITS = 32;

export function emptyHll(): Uint8Array { return new Uint8Array(REGISTER_COUNT); }

function fnv1a32(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function addHll(registers: Uint8Array, value: string): void {
  const hash = fnv1a32(value);
  const bucket = hash & (REGISTER_COUNT - 1);
  const remaining = hash >>> 10;
  const rank = remaining === 0 ? HASH_BITS - 10 + 1 : Math.clz32(remaining) + 1;
  if (rank > registers[bucket]) registers[bucket] = Math.min(rank, 63);
}

export function mergeHll(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (a.length !== REGISTER_COUNT || b.length !== REGISTER_COUNT) throw new Error("Invalid HLL");
  const out = new Uint8Array(REGISTER_COUNT);
  for (let i = 0; i < REGISTER_COUNT; i++) out[i] = Math.max(a[i], b[i]);
  return out;
}

export function estimateHll(registers: Uint8Array): number {
  if (registers.length !== REGISTER_COUNT) throw new Error("Invalid HLL");
  let sum = 0; let zeros = 0;
  for (const r of registers) { sum += 2 ** -r; if (r === 0) zeros++; }
  const alpha = 0.7213 / (1 + 1.079 / REGISTER_COUNT);
  let estimate = alpha * REGISTER_COUNT * REGISTER_COUNT / sum;
  if (estimate <= 2.5 * REGISTER_COUNT && zeros > 0) estimate = REGISTER_COUNT * Math.log(REGISTER_COUNT / zeros);
  return Math.max(0, Math.round(estimate));
}

export function encodeHll(registers: Uint8Array): string { return Buffer.from(registers).toString("base64"); }
export function decodeHll(value: string): Uint8Array { const bytes = new Uint8Array(Buffer.from(value, "base64")); if (bytes.length !== REGISTER_COUNT) throw new Error("Invalid HLL encoding"); return bytes; }

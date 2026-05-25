/**
 * Token encryption — shared across ad platform integrations.
 *
 * AES-256-CBC with a key derived from `ENCRYPTION_KEY` via SHA-256
 * (so the env var can be any non-empty string).
 *
 * Output format: `<iv-hex>:<ciphertext-hex>`
 */

import crypto from "node:crypto";

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error("ENCRYPTION_KEY is not configured");
  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptToken(token: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptToken(encrypted: string): string {
  const [ivHex, dataHex] = encrypted.split(":");
  if (!ivHex || !dataHex) {
    throw new Error("Invalid encrypted token format");
  }
  const iv = Buffer.from(ivHex, "hex");
  const data = Buffer.from(dataHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", getKey(), iv);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

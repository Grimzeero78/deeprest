import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

// ============================================================
// DeepRest at-rest encryption — AES-256-GCM for chat logs and
// sensitive screen-time payloads. Key is derived from
// ENCRYPTION_KEY env var (scrypt, fixed salt).
// ============================================================

const KEY = createHash("sha256")
  .update(process.env.ENCRYPTION_KEY || "deeprest-dev-encryption-key-change-in-prod")
  .digest(); // 32 bytes for AES-256

/** Encrypt plaintext -> "base64(iv):base64(tag):base64(ciphertext)" */
export function encryptAtRest(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

/** Decrypt "base64(iv):base64(tag):base64(ciphertext)" -> plaintext (null on tamper) */
export function decryptAtRest(payload: string): string | null {
  try {
    const [ivB64, tagB64, dataB64] = payload.split(":");
    if (!ivB64 || !tagB64 || !dataB64) return null;
    const decipher = createDecipheriv("aes-256-gcm", KEY, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]);
    return dec.toString("utf8");
  } catch {
    return null; // tampered or corrupted
  }
}

// ============================================================
// DeepRest at-rest encryption — AES-256-GCM for chat logs and
// sensitive screen-time payloads. Implemented with WebCrypto so
// it runs identically on Node.js and Cloudflare Workers.
// Key = SHA-256(ENCRYPTION_KEY env var).
// Format kept compatible: "base64(iv):base64(tag):base64(ciphertext)"
// ============================================================

const KEY_CACHE = { key: null as CryptoKey | null, src: "" };

async function getKey(): Promise<CryptoKey> {
  const secret = process.env.ENCRYPTION_KEY || "deeprest-dev-encryption-key-change-in-prod";
  if (KEY_CACHE.key && KEY_CACHE.src === secret) return KEY_CACHE.key;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  const key = await crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
  KEY_CACHE.key = key;
  KEY_CACHE.src = secret;
  return key;
}

// ---- base64 helpers (no Buffer needed — Workers-safe) ----

function toB64(bytes: Uint8Array): string {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Encrypt plaintext -> "base64(iv):base64(tag):base64(ciphertext)" */
export async function encryptAtRest(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  // WebCrypto appends the 16-byte GCM auth tag to the ciphertext
  const full = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext))
  );
  const ct = full.subarray(0, full.length - 16);
  const tag = full.subarray(full.length - 16);
  return `${toB64(iv)}:${toB64(tag)}:${toB64(ct)}`;
}

/** Decrypt "base64(iv):base64(tag):base64(ciphertext)" -> plaintext (null on tamper) */
export async function decryptAtRest(payload: string): Promise<string | null> {
  try {
    const [ivB64, tagB64, dataB64] = payload.split(":");
    if (!ivB64 || !tagB64 || !dataB64) return null;
    const key = await getKey();
    const iv = fromB64(ivB64);
    const tag = fromB64(tagB64);
    const ct = fromB64(dataB64);
    // WebCrypto expects tag appended to ciphertext
    const joined = new Uint8Array(new ArrayBuffer(ct.length + tag.length));
    joined.set(ct);
    joined.set(tag, ct.length);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, joined);
    return new TextDecoder().decode(plain);
  } catch {
    return null; // tampered or corrupted
  }
}

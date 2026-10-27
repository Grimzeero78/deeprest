import { SignJWT, jwtVerify } from "jose";

// ============================================================
// DeepRest Auth — JWT sessions + PBKDF2 password hashing.
// PBKDF2-SHA256 (WebCrypto) runs identically on Node.js and
// Cloudflare Workers (no node:crypto dependency).
// In production (Cloudflare) this maps to Lucia-style session
// tokens stored in KV; here we use stateless JWTs in httpOnly cookies.
// ============================================================

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "deeprest-dev-secret-change-in-production-9f2b7c"
);

export const SESSION_COOKIE = "deeprest_session";
const SESSION_TTL = "7d";

const PBKDF2_ITERATIONS = 100_000;

export interface SessionPayload {
  userId: string;
  username: string;
  name: string;
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("deeprest")
    .setExpirationTime(SESSION_TTL)
    .sign(SECRET);
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET, { issuer: "deeprest" });
    if (!payload.userId || !payload.username) return null;
    return {
      userId: payload.userId as string,
      username: payload.username as string,
      name: (payload.name as string) || "Friend",
    };
  } catch {
    return null;
  }
}

// ---------- Password hashing (PBKDF2-SHA256 via WebCrypto) ----------

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");

const fromHex = (hex: string): Uint8Array => {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
};

async function deriveBits(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS },
    keyMaterial,
    256
  );
  return new Uint8Array(bits);
}

/** Constant-time equality for equal-length Uint8Arrays. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveBits(password, salt);
  return `${toHex(salt)}:${toHex(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const candidate = await deriveBits(password, fromHex(saltHex));
  return timingSafeEqual(candidate, fromHex(hashHex));
}

// ---------- Session helpers for API routes ----------

import { cookies } from "next/headers";

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

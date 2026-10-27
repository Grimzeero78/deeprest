/**
 * DeepRest — breached-password protection (Have I Been Pwned, k-anonymity).
 *
 * Chrome flags passwords that appear in public breach lists ("Password in
 * data breach"). We now run the same check ourselves at signup and at
 * password change, so users get warned BEFORE picking an unsafe password.
 *
 * Privacy: k-anonymity range API — only the first 5 characters of the
 * SHA-1 hash ever leave the server. The password itself is never sent.
 */
export async function isBreachedPassword(password: string): Promise<boolean | null> {
  try {
    const digest = await crypto.subtle.digest(
      "SHA-1",
      new TextEncoder().encode(password)
    );
    const hash = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(4_000),
    });
    // Fail-open: if the breach service is unreachable, never block signup.
    if (!res.ok) return null;

    const body = await res.text();
    for (const line of body.split("\n")) {
      const [suf, count] = line.trim().split(":");
      if (suf === suffix && parseInt(count || "0", 10) > 0) return true;
    }
    return false;
  } catch {
    return null;
  }
}

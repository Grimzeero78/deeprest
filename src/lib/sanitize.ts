// ============================================================
// DeepRest input sanitization — defense-in-depth against XSS
// on top of React's auto-escaping. SQL injection is prevented
// structurally by Prisma parameterized queries (and D1 prepared
// statements in production).
// ============================================================

const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
  "/": "&#x2F;",
  "`": "&#x60;",
};

/** Escape all HTML-significant characters (stored & rendered as plain text). */
export function escapeHtml(input: string): string {
  return input.replace(/[&<>"'`/]/g, (ch) => HTML_ENTITIES[ch]);
}

/** Strip control characters + zero-width exploits, trim, and cap length. */
export function sanitizeMessage(raw: unknown, maxLen = 2000): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "") // control chars
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // zero-width chars
    .slice(0, maxLen)
    .trim();
}

/** Normalize a display name: collapse whitespace, strip stray chars, cap length.
 *  Removes HTML/script-significant characters (defense-in-depth — React escapes
 *  on render, but names also feed usernames, DM system messages and previews).
 *  Letters, numbers, spaces, emoji and friendly punctuation all survive. */
export function normalizeName(raw: string, maxLen = 40): string {
  return raw
    .replace(/[<>"'`&\\{}[\]$;|(=~^*!?%#@+]/g, "") // HTML/script/meta chars
    .replace(/[\u0000-\u001F\u007F]/g, "") // control chars
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

/** Login identifier — lowercase form of the name, unique per account. */
export function toUsername(name: string): string {
  return name.trim().toLowerCase().slice(0, 40);
}

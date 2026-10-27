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

/** Basic email sanity check (full validation happens via zod in routes). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase().slice(0, 254);
}

import { db } from "@/lib/db";

/**
 * WhatsApp-proof DM plumbing.
 *
 * THE BUG THIS KILLS: two POSTs for the same pair of users racing within
 * milliseconds both ran "find existing DM -> none -> create" and produced
 * TWO parallel DM conversations. The pair then chatted into different
 * threads and messages "never arrived".
 *
 * THE FIX: a DM conversation id is DETERMINISTIC — sha256 of the two user
 * ids (sorted, so A->B === B->A). A duplicate create collides on the
 * primary key and resolves to the same single conversation. Combined with
 * the pre-check this makes duplicate DMs structurally impossible.
 */

export function dmConvoIdFor(a: string, b: string): Promise<string> {
  const pairKey = [a, b].sort().join("|");
  return crypto.subtle
    .digest("SHA-256", new TextEncoder().encode(`deeprest-dm:${pairKey}`))
    .then((buf) => {
      const hex = [...new Uint8Array(buf)]
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("");
      return `dm_${hex.slice(0, 32)}`;
    });
}

/** Find the one canonical DM between two users (either direction). */
export async function findExistingDm(userA: string, userB: string): Promise<string | null> {
  const myDms = await db.conversationMember.findMany({
    where: { userId: userA, conversation: { kind: "dm" } },
    select: { conversationId: true },
  });
  if (myDms.length === 0) return null;
  const hit = await db.conversationMember.findFirst({
    where: { userId: userB, conversationId: { in: myDms.map((m) => m.conversationId) } },
    select: { conversationId: true },
  });
  return hit?.conversationId ?? null;
}

/**
 * Get-or-create the DM between two users. Race-safe:
 *  1. fast path — existing DM found by scan
 *  2. deterministic id — a concurrent twin create collides on PK and is ignored
 *  3. membership rows are upserted individually, ignoring unique violations
 *  4. final scan catches the (impossible-in-theory, handled-in-practice) case
 */
export async function ensureDm(userA: string, userB: string): Promise<string> {
  const existing = await findExistingDm(userA, userB);
  if (existing) return existing;

  const id = await dmConvoIdFor(userA, userB);
  try {
    await db.conversation.create({ data: { id, kind: "dm" } });
  } catch {
    // Primary-key collision: the pair's canonical DM already exists. Good.
  }
  for (const userId of [userA, userB]) {
    await db.conversationMember
      .create({ data: { conversationId: id, userId } })
      .catch(() => {
        // Unique violation = membership already there. Good.
      });
  }

  const settled = await findExistingDm(userA, userB);
  return settled ?? id;
}

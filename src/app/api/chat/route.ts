import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, unauthorized, badRequest, serverError, tooMany } from "@/lib/api-helpers";
import { PERSONAS, isPersonaId, type PersonaId } from "@/lib/personas";
import { encryptAtRest, decryptAtRest } from "@/lib/crypto";
import { sanitizeMessage } from "@/lib/sanitize";
import { LIMITS } from "@/lib/rate-limit";
import ZAI from "z-ai-web-dev-sdk";

const MAX_HISTORY = 16; // messages of context sent to the model

/** GET /api/chat?persona=SHEPHERD -> decrypted history */
export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    if (!session) return unauthorized();

    const personaParam = req.nextUrl.searchParams.get("persona");
    if (!isPersonaId(personaParam)) return badRequest("Invalid persona.");
    const persona: PersonaId = personaParam;

    const chatSession = await db.chatSession.findUnique({
      where: { userId_persona: { userId: session.userId, persona } },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    const messages = (chatSession?.messages || [])
      .map((m) => {
        const content = decryptAtRest(m.content);
        return content ? { id: m.id, role: m.role, content, createdAt: m.createdAt } : null;
      })
      .filter(Boolean);

    return NextResponse.json({ persona, messages, greeting: PERSONAS[persona].greeting });
  } catch (err) {
    console.error("[chat:GET]", err);
    return serverError();
  }
}

/** POST /api/chat { persona, message } -> AI reply (persisted encrypted at rest) */
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    if (!session) return unauthorized();

    const rl = LIMITS.chat(session.userId);
    if (!rl.ok) return tooMany(rl.retryAfterSec);

    const body = await req.json().catch(() => null);
    const persona = body?.persona;
    const message = sanitizeMessage(body?.message, 2000);
    if (!isPersonaId(persona)) return badRequest("Invalid persona.");
    if (!message) return badRequest("Message cannot be empty.");

    // Get or create the per-persona session
    let chatSession = await db.chatSession.findUnique({
      where: { userId_persona: { userId: session.userId, persona } },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!chatSession) {
      chatSession = await db.chatSession.create({
        data: { userId: session.userId, persona },
        include: { messages: true },
      });
    }

    // Persist the user's message (encrypted at rest)
    await db.chatMessage.create({
      data: { sessionId: chatSession.id, role: "user", content: encryptAtRest(message) },
    });

    // Build model context from recent history (already decrypted at write time is NOT stored;
    // we decrypt stored messages to reconstruct context)
    const history = (chatSession.messages || [])
      .map((m) => {
        const content = decryptAtRest(m.content);
        return content ? { role: m.role, content } : null;
      })
      .filter(Boolean)
      .slice(-MAX_HISTORY) as { role: string; content: string }[];

    const personaDef = PERSONAS[persona];
    const completion = await ZAI.create().then((zai) =>
      zai.chat.completions.create({
        messages: [
          {
            role: "assistant",
            content: `${personaDef.systemPrompt}\n\nYou are talking with ${session.name}.`,
          },
          ...history,
          { role: "user", content: message },
        ],
        thinking: { type: "disabled" },
      })
    );

    const reply = completion.choices[0]?.message?.content?.trim();
    if (!reply) throw new Error("Empty AI response");

    // Persist AI reply (encrypted at rest)
    const saved = await db.chatMessage.create({
      data: { sessionId: chatSession.id, role: "assistant", content: encryptAtRest(reply) },
    });

    return NextResponse.json({
      message: { id: saved.id, role: "assistant", content: reply, createdAt: saved.createdAt },
    });
  } catch (err) {
    console.error("[chat:POST]", err);
    return serverError("The companion is momentarily unavailable. Please try again.");
  }
}

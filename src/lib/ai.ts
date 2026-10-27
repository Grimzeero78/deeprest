// ============================================================
// DeepRest AI completion — runtime-portable provider chain:
//   1. Cloudflare Workers AI binding (env.AI)          [prod]
//   2. OpenAI-compatible API via OPENAI_API_KEY env    [any host]
//   3. Graceful persona-aware fallback                 [no keys]
// The sandbox z-ai-web-dev-sdk is NOT used here so the
// Workers bundle stays clean and dependency-free.
// ============================================================

export interface ChatTurn {
  role: string;
  content: string;
}

const DEFAULT_WORKERS_AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

async function tryWorkersAI(messages: ChatTurn[]): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCloudflareContext } = require("@opennextjs/cloudflare") as {
      getCloudflareContext: () => { env?: { AI?: { run: (m: string, args: object) => Promise<unknown> } } } | undefined;
    };
    const ai = getCloudflareContext()?.env?.AI;
    if (!ai) return null;

    const model = process.env.AI_MODEL || DEFAULT_WORKERS_AI_MODEL;
    const res = (await ai.run(model, {
      messages,
      max_tokens: 600,
    })) as { response?: string } | { result?: { response?: string } };

    const text =
      (res as { response?: string })?.response ||
      (res as { result?: { response?: string } })?.result?.response ||
      "";
    return text.trim() || null;
  } catch {
    return null;
  }
}

async function tryOpenAICompatible(messages: ChatTurn[]): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  try {
    const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-4o-mini", messages, max_tokens: 600 }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

/** Compassionate offline reply so the app never hard-fails. */
function fallbackReply(personaKey: string, userName: string): string {
  const you = userName || "friend";
  const map: Record<string, string> = {
    SHEPHERD: `"Be still, and know that I am God." — Psalm 46:10\n\n${you}, take a breath. You don't have to carry today alone. Set the phone down for a moment, and know that you are loved beyond measure.`,
    GUIDE: `Hey ${you} — I'm here. A quick reset that helps: stand up, drink some water, and put your phone in another room for 15 minutes. Small wins stack up. What's one tiny thing you could do right now that your future self will thank you for?`,
    COUNSELOR: `${you}, before we continue — I'm an AI companion, not a licensed therapist. Let's try a grounding exercise: name 3 things you can see, 2 you can hear, 1 you can feel. Then tell me what triggered the urge just now, and we'll look at the thought behind it together.`,
  };
  return (
    map[personaKey] ||
    `${you}, I hear you. I'm here with you — tell me more about what's going on right now.`
  );
}

/**
 * Complete a chat. `system` is the persona system prompt; `turns` is
 * recent history INCLUDING the newest user message.
 */
export async function completeChat(
  system: string,
  turns: ChatTurn[],
  personaKey: string,
  userName: string
): Promise<string> {
  const messages: ChatTurn[] = [{ role: "system", content: system }, ...turns];

  return (
    (await tryWorkersAI(messages)) ||
    (await tryOpenAICompatible(messages)) ||
    fallbackReply(personaKey, userName)
  );
}

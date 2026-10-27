// ============================================================
// DeepRest AI completion — REAL trained models only, chained:
//
//   1. OpenAI-compatible chat API with your own key
//        • Grok   (default): AI_API_KEY=xxx
//            base https://api.x.ai/v1, model grok-4-1-fast
//        • Z.ai GLM: AI_API_KEY=xxx
//            AI_BASE_URL=https://api.z.ai/api/paas/v4
//            AI_API_MODEL=glm-4.6
//        • OpenAI: AI_API_KEY=xxx
//            AI_BASE_URL=https://api.openai.com/v1
//   2. Cloudflare Workers AI binding (env.AI) — real Llama 3.3
//      70B, works on Cloudflare with NO API key
//   3. z-ai-web-dev-sdk — GLM in the local dev sandbox (hidden
//      dynamic import keeps the Workers bundle clean; on
//      Workers the import simply fails and is skipped)
//   4. Compassionate offline fallback — last resort so the app
//      never hard-fails
// ============================================================

export interface ChatTurn {
  role: string;
  content: string;
}

const DEFAULT_WORKERS_AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const DEFAULT_API_BASE = "https://api.x.ai/v1";
const DEFAULT_API_MODEL = "grok-4-1-fast";

interface ApiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

/** Pick up an OpenAI-compatible provider from env, if any. */
function apiConfig(): ApiConfig | null {
  const apiKey =
    process.env.AI_API_KEY || process.env.GROK_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: (process.env.AI_BASE_URL || DEFAULT_API_BASE).replace(/\/+$/, ""),
    model: process.env.AI_API_MODEL || DEFAULT_API_MODEL,
  };
}

async function tryApi(cfg: ApiConfig, messages: ChatTurn[]): Promise<string | null> {
  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        max_tokens: 700,
        temperature: 0.8,
      }),
    });
    if (!res.ok) {
      console.error(`[ai] provider ${cfg.baseUrl} responded ${res.status}`);
      return null;
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (err) {
    console.error("[ai] provider request failed:", err);
    return null;
  }
}

async function tryWorkersAI(messages: ChatTurn[]): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCloudflareContext } = require("@opennextjs/cloudflare") as {
      getCloudflareContext: () => {
        env?: { AI?: { run: (m: string, args: object) => Promise<unknown> } };
      } | undefined;
    };
    const ai = getCloudflareContext()?.env?.AI;
    if (!ai) return null;

    const model = process.env.WORKERS_AI_MODEL || DEFAULT_WORKERS_AI_MODEL;
    const res = (await ai.run(model, {
      messages,
      max_tokens: 700,
      temperature: 0.7,
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

interface ZaiClient {
  chat: {
    completions: {
      create: (args: {
        messages: ChatTurn[];
        thinking?: { type: string };
      }) => Promise<{ choices?: { message?: { content?: string } }[] }>;
    };
  };
}

async function tryZaiSdk(messages: ChatTurn[]): Promise<string | null> {
  try {
    // Eval-wrapped dynamic import: bundlers can't see it, so the
    // Cloudflare bundle stays clean. On Node (sandbox dev) it
    // resolves z-ai-web-dev-sdk and talks to GLM — a real,
    // fully trained model. On Workers it throws -> skipped.
    const dynamicImport = new Function("m", "return import(m)") as (
      m: string
    ) => Promise<{ default?: { create: () => Promise<ZaiClient> } }>;
    const mod = await dynamicImport("z-ai-web-dev-sdk");
    const ZAI = mod?.default;
    if (!ZAI) return null;

    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages,
      thinking: { type: "disabled" },
    });
    return completion?.choices?.[0]?.message?.content?.trim() || null;
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
 * Complete a chat with a real trained model. `system` is the
 * persona system prompt; `turns` is recent history INCLUDING the
 * newest user message.
 */
export async function completeChat(
  system: string,
  turns: ChatTurn[],
  personaKey: string,
  userName: string
): Promise<string> {
  const messages: ChatTurn[] = [{ role: "system", content: system }, ...turns];

  const cfg = apiConfig();
  return (
    (cfg && (await tryApi(cfg, messages))) ||
    (await tryWorkersAI(messages)) ||
    (await tryZaiSdk(messages)) ||
    fallbackReply(personaKey, userName)
  );
}

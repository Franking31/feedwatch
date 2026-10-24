type Provider = "anthropic" | "groq" | "gemini";

// Groq et Gemini parlent le même "langage" (format OpenAI) : un seul code pour les deux
const OPENAI_COMPAT = {
  groq: {
    url: "https://api.groq.com/openai/v1/chat/completions",
    keyEnv: "GROQ_API_KEY",
    defaultModel: "openai/gpt-oss-120b",
  },
  gemini: {
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    keyEnv: "GEMINI_API_KEY",
    defaultModel: undefined as string | undefined,
  },
};

export function currentProvider(): Provider {
  const p = (process.env.LLM_PROVIDER ?? "").toLowerCase();
  if (p === "groq" || p === "gemini" || p === "anthropic") return p;

  // Pas de choix explicite : on prend le premier fournisseur dont la clé existe
  if (process.env.GROQ_API_KEY) return "groq";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return "anthropic";
}

// Vrai si le fournisseur choisi a sa clé dans .env
export function llmConfigured(): boolean {
  const p = currentProvider();
  if (p === "anthropic") return !!process.env.ANTHROPIC_API_KEY;
  return !!process.env[OPENAI_COMPAT[p].keyEnv];
}

// Envoie une requête JSON et renvoie la réponse (erreur claire si ça échoue)
async function postJson(
  provider: Provider,
  url: string,
  headers: Record<string, string>,
  body: unknown
): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    throw new Error(
      `${provider} a répondu ${res.status} : ${(await res.text()).slice(0, 300)}`
    );
  }
  return res.json();
}

export async function generateText(opts: {
  system: string;
  user: string;
  maxTokens: number;
}): Promise<string> {
  const provider = currentProvider();

  if (provider === "anthropic") {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY manquante");

    const data = (await postJson(
      provider,
      "https://api.anthropic.com/v1/messages",
      { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      {
        model: process.env.LLM_MODEL || "claude-haiku-5-5",
        max_tokens: opts.maxTokens,
        system: opts.system,
        messages: [{ role: "user", content: opts.user }],
      }
    )) as { content?: { type: string; text?: string }[] };

    return (data.content ?? [])
      .filter((block) => block.type === "text")
      .map((block) => block.text ?? "")
      .join("")
      .trim();
  }

  const cfg = OPENAI_COMPAT[provider];
  const apiKey = process.env[cfg.keyEnv];
  const model = process.env.LLM_MODEL || cfg.defaultModel;
  if (!apiKey) throw new Error(`${cfg.keyEnv} manquante`);
  if (!model) throw new Error("LLM_MODEL manquante (obligatoire avec Gemini)");

  const data = (await postJson(
    provider,
    cfg.url,
    { Authorization: `Bearer ${apiKey}` },
    {
      model,
      max_tokens: opts.maxTokens,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
    }
  )) as { choices?: { message?: { content?: string } }[] };

  return (data.choices?.[0]?.message?.content ?? "").trim();
}
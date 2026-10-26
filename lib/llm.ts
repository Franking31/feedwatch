type Provider = "anthropic" | "groq" | "gemini";

type GenOpts = { system: string; user: string; maxTokens: number };

// Ordre d'essai par défaut
const DEFAULT_ORDER: Provider[] = ["groq", "gemini", "anthropic"];

const CONFIG: Record<
  Provider,
  { label: string; keyEnv: string; modelEnv: string; defaultModel: string }
> = {
  groq: {
    label: "Groq",
    keyEnv: "GROQ_API_KEY",
    modelEnv: "GROQ_MODEL",
    defaultModel: "openai/gpt-oss-120b",
  },
  gemini: {
    label: "Gemini",
    keyEnv: "GEMINI_API_KEY",
    modelEnv: "GEMINI_MODEL",
    defaultModel: "gemini-flash-lite-latest",
  },
  anthropic: {
    label: "Claude",
    keyEnv: "ANTHROPIC_API_KEY",
    modelEnv: "ANTHROPIC_MODEL",
    defaultModel: "claude-haiku-5-5",
  },
};

// Groq et Gemini parlent le même "langage" (format OpenAI)
const OPENAI_URL = {
  groq: "https://api.groq.com/openai/v1/chat/completions",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
};

class LlmError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

const hasKey = (p: Provider) => !!process.env[CONFIG[p].keyEnv];

// Les fournisseurs utilisables, dans l'ordre d'essai
export function providerOrder(): Provider[] {
  const wanted = (process.env.LLM_PROVIDER ?? "").toLowerCase();
  const first = DEFAULT_ORDER.find((p) => p === wanted);
  const order = first
    ? [first, ...DEFAULT_ORDER.filter((p) => p !== first)]
    : DEFAULT_ORDER;
  return order.filter(hasKey);
}

export function llmConfigured(): boolean {
  return providerOrder().length > 0;
}

// Conservé pour les anciens scripts
export function currentProvider(): Provider {
  return providerOrder()[0] ?? "anthropic";
}

// L'ancienne variable LLM_MODEL ne vaut que pour le fournisseur qu'elle accompagnait
function legacyOwner(): Provider | undefined {
  const wanted = (process.env.LLM_PROVIDER ?? "").toLowerCase();
  return DEFAULT_ORDER.find((p) => p === wanted) ?? providerOrder()[0];
}

// Les fournisseurs en échec sont mis de côté un moment
const coolingUntil = new Map<Provider, number>();
const isCooling = (p: Provider) => (coolingUntil.get(p) ?? 0) > Date.now();

function coolDown(p: Provider, status?: number) {
  const minutes =
    status === 429 ? 5 : status === 401 || status === 403 || status === 404 ? 30 : 1;
  coolingUntil.set(p, Date.now() + minutes * 60000);
}

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown
): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });
  } catch (err) {
    throw new LlmError(`réseau : ${err instanceof Error ? err.message : "erreur"}`);
  }

  if (!res.ok) {
    throw new LlmError(`HTTP ${res.status} : ${(await res.text()).slice(0, 300)}`, res.status);
  }
  return res.json();
}

async function callProvider(
  provider: Provider,
  model: string,
  opts: GenOpts
): Promise<string> {
  const apiKey = process.env[CONFIG[provider].keyEnv];
  if (!apiKey) throw new LlmError("clé absente");

  if (provider === "anthropic") {
    const data = (await postJson(
      "https://api.anthropic.com/v1/messages",
      { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      {
        model,
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

  const data = (await postJson(
    OPENAI_URL[provider],
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

// Essaie les fournisseurs un par un et renvoie aussi lequel a répondu
export async function generateTextDetailed(
  opts: GenOpts
): Promise<{ text: string; provider: Provider; model: string }> {
  const order = providerOrder();
  if (order.length === 0) {
    throw new Error(
      "Aucune clé d'IA configurée (GROQ_API_KEY, GEMINI_API_KEY ou ANTHROPIC_API_KEY)."
    );
  }

  // Ceux qui sont mis de côté passent en dernier, mais restent un ultime recours
  const attempts = [...order.filter((p) => !isCooling(p)), ...order.filter(isCooling)];
  const owner = legacyOwner();
  const errors: string[] = [];

  for (const provider of attempts) {
    const model =
      process.env[CONFIG[provider].modelEnv] ||
      (provider === owner ? process.env.LLM_MODEL : "") ||
      CONFIG[provider].defaultModel;

    try {
      const text = await callProvider(provider, model, opts);
      if (!text) throw new LlmError("réponse vide");

      coolingUntil.delete(provider);
      if (errors.length > 0) {
        console.warn(`IA : bascule sur ${CONFIG[provider].label} (${errors.join(" | ")})`);
      }
      return { text, provider, model };
    } catch (err) {
      const status = err instanceof LlmError ? err.status : undefined;
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${CONFIG[provider].label} ${model} : ${message}`);
      coolDown(provider, status);
    }
  }

  throw new Error(`Tous les fournisseurs d'IA ont échoué. ${errors.join(" | ")}`);
}

export async function generateText(opts: GenOpts): Promise<string> {
  return (await generateTextDetailed(opts)).text;
}
export const GEMINI_MODEL_DEFAULT = "gemini-3.5-flash";
export const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
export const TIMEOUT_MS = 55_000;
export const SEARCH_TIMEOUT_MS = 90_000;

const MODEL = process.env.GEMINI_MODEL || GEMINI_MODEL_DEFAULT;
const BASE = GEMINI_BASE;

export function googleApiKey(): string | undefined {
  const k = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  return k?.trim() || undefined;
}

export function hasGoogleKey(): boolean {
  return Boolean(googleApiKey());
}

function key(): string {
  const k = googleApiKey();
  if (!k) throw new Error("GOOGLE_API_KEY missing");
  return k;
}

function stripFence(text: string): string {
  const t = text.trim();
  const m = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (m ? m[1] : t).trim();
}

async function withTimeout(
  input: RequestInfo,
  init: RequestInit,
  timeoutMs = TIMEOUT_MS,
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

type GeminiPart = { text?: string };
type GeminiResponse = {
  candidates?: {
    content?: { parts?: GeminiPart[] };
  }[];
  error?: { message?: string };
};

function readText(json: GeminiResponse): string {
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .map((p) => p.text ?? "")
    .join("\n")
    .trim();
  if (!text) {
    throw new Error(json.error?.message || "gemini empty");
  }
  return stripFence(text);
}

async function generate(
  prompt: string,
  opts: {
    timeoutMs?: number;
    search?: boolean;
    json?: boolean;
    system?: string;
  } = {},
): Promise<string> {
  const timeoutMs = opts.timeoutMs ?? TIMEOUT_MS;
  const body: Record<string, unknown> = {
    systemInstruction: {
      parts: [
        {
          text:
            opts.system ??
            "Return strict JSON only. No markdown. No commentary. Never invent URLs, posts, or a WHY.",
        },
      ],
    },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0,
      ...(opts.json && !opts.search ? { responseMimeType: "application/json" } : {}),
    },
  };
  if (opts.search) {
    body.tools = [{ google_search: {} }];
  }

  const res = await withTimeout(
    `${BASE}/models/${MODEL}:generateContent?key=${encodeURIComponent(key())}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    timeoutMs,
  );
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`gemini ${res.status}: ${errBody.slice(0, 240)}`);
  }
  return readText((await res.json()) as GeminiResponse);
}

export async function geminiChat(prompt: string, timeoutMs = TIMEOUT_MS): Promise<string> {
  return generate(prompt, { timeoutMs, json: true });
}

/** Google Search grounding — public web receipts, including public X mentions. Never invent URLs. */
export async function geminiSearch(prompt: string, timeoutMs = SEARCH_TIMEOUT_MS): Promise<string> {
  return generate(prompt, {
    timeoutMs,
    search: true,
    system:
      "Use Google Search. Return only facts from retrieved results. Never invent a URL, post, or WHY. Strict JSON if the user asked for JSON.",
  });
}

/** Deep pass with Google Search. Citations from retrieved results only. */
export async function geminiDeepResearch(
  prompt: string,
  timeoutMs = SEARCH_TIMEOUT_MS,
): Promise<string> {
  return generate(prompt, {
    timeoutMs,
    search: true,
    system:
      "Use Google Search. Each claim must name a real source or URL you retrieved. If you cannot verify, omit it. Never invent.",
  });
}

export async function geminiJson<T>(
  prompt: string,
  parse: (raw: string) => T,
  search = false,
): Promise<T> {
  const raw = await (search ? geminiSearch : geminiChat)(prompt);
  try {
    return parse(raw);
  } catch (first) {
    const err = first instanceof Error ? first.message : String(first);
    return parse(
      await geminiChat(
        `${prompt}\n\nRaw model output:\n${raw.slice(0, 4000)}\n\nYour previous answer failed validation: ${err}. Return strict JSON only.`,
      ),
    );
  }
}

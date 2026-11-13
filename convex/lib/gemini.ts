export const SMART_MODEL = 'gemini-flash-latest';
export const FAST_MODEL = 'gemini-flash-lite-latest';

/** Calls Gemini and parses a JSON response. Throws on any failure. */
export async function geminiJson<T>(opts: {
  model: string;
  system: string;
  prompt: string;
  timeoutMs?: number;
}): Promise<T> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set on the Convex deployment');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 25000);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:generateContent`,
      {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: opts.system }] },
          contents: [{ role: 'user', parts: [{ text: opts.prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
        }),
      },
    );
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    const parts: { text?: string; thought?: boolean }[] = data?.candidates?.[0]?.content?.parts ?? [];
    const text = parts
      .filter((p) => !p.thought && p.text)
      .map((p) => p.text)
      .join('');
    return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '')) as T;
  } finally {
    clearTimeout(timer);
  }
}

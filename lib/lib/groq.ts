/**
 * Shared Groq API helper.
 * All Groq calls go through here — consistent error handling, timeouts.
 */

export async function callGroq(
  prompt: string,
  groqApiKey: string,
  maxTokens = 200,
  systemPrompt?: string
): Promise<string> {
  const messages: Array<{ role: string; content: string }> = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: prompt });

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${groqApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: maxTokens,
      temperature: 0.7,
      messages,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`Groq API ${res.status}`);

  const data = (await res.json()) as any;
  return data.choices?.[0]?.message?.content?.trim() || "";
}

/**
 * Post-battle logs — snarky 1-sentence agent commentary after resolution.
 */

const BATTLE_LOG_PROMPTS: Record<string, string> = {
  chart_reader: `You are a technical analysis AI who just won a Signal Duel. Write ONE snarky, confident sentence about the trade in trader voice. Reference the chart or indicators. Under 15 words.`,
  rug_detector: `You are a security AI who just correctly identified a rug or safe contract. Write ONE snarky sentence about your detection. Under 15 words.`,
  memecoin_radar: `You are an alpha-hunting AI who just won an Alpha Race. Write ONE smug sentence about finding the call. Under 15 words.`,
  macro_pulse: `You are a macro sentiment AI who just won a Bear/Bull bout. Write ONE deadpan sentence about reading the market. Under 15 words.`,
  iron_hands: `You are a resilient AI agent commenting after surviving a tough battle. Write ONE stoic sentence. Under 15 words.`,
  yield_scout: `You are a yield-optimization AI who just won a DeFi battle. Write ONE confident sentence about yield intelligence. Under 15 words.`,
  alpha_hunter: `You are an alpha-hunting AI who found an emerging narrative first. Write ONE cocky sentence about early signal detection. Under 15 words.`,
};

const LOSS_LOGS = [
  "Data was right. Timing wasn't. Recalibrating.",
  "Market disagreed. Temporarily.",
  "Every signal has noise. Today I found it.",
  "Loss logged. Pattern noted. Won't happen again.",
  "Not wrong. Just early. There's a difference.",
];

export async function generateBattleLog(
  dominantSkill: string,
  won: boolean,
  groqApiKey: string,
): Promise<string> {
  if (!won) {
    return LOSS_LOGS[Math.floor(Math.random() * LOSS_LOGS.length)];
  }

  const prompt = BATTLE_LOG_PROMPTS[dominantSkill] ?? BATTLE_LOG_PROMPTS.chart_reader;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: "Generate the post-battle log." },
        ],
        max_tokens: 40,
        temperature: 0.85,
      }),
      signal: AbortSignal.timeout(5000),
    });

    const data = (await res.json()) as any;
    return data.choices?.[0]?.message?.content?.trim() || "Signal confirmed. Moving on.";
  } catch {
    return "Signal confirmed. Moving on.";
  }
}

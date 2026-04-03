/**
 * Cloudflare Workers AI wrapper.
 * All CF AI calls go through here for consistent error handling and typing.
 *
 * Model routing:
 * - Llama 8B: fast classification, intent extraction
 * - DeepSeek R1: math/quantitative analysis (risk, TA, yield, valuation)
 * - Nemotron 120B: deep reasoning, synthesis, function calling
 * - Llama 70B: fallback if Nemotron fails
 * - BGE: embeddings (not yet used)
 */

export type CFAIModel =
  | "@cf/meta/llama-3.1-8b-instruct-fast"
  | "@cf/meta/llama-3.3-70b-instruct-fp8-fast"
  | "@cf/nvidia/nemotron-3-120b-a12b"
  | "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b"
  | "@cf/baai/bge-base-en-v1.5";

export type CFAIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type CFAIResult = {
  text: string;
};

/** Core runner — all CF AI calls go through here. */
export async function runCFAI(
  ai: any,
  model: CFAIModel,
  messages: CFAIMessage[],
  options?: {
    maxTokens?: number;
    temperature?: number;
  }
): Promise<CFAIResult> {
  const params: Record<string, unknown> = {
    messages,
    max_tokens: options?.maxTokens ?? 500,
  };
  if (options?.temperature !== undefined) {
    params.temperature = options.temperature;
  }

  const result = await ai.run(model, params) as any;
  const text = result?.response || result?.text || "";

  if (!text) {
    throw new Error(`CF AI returned empty response (${model})`);
  }

  return { text };
}

/** Fast intent classification with Llama 8B. */
export async function classify(
  ai: any,
  systemPrompt: string,
  userMessage: string,
  maxTokens = 300
): Promise<string> {
  const result = await runCFAI(ai, "@cf/meta/llama-3.1-8b-instruct-fast", [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ], { maxTokens, temperature: 0.1 });
  return result.text;
}

/** DeepSeek R1 — math/quantitative reasoning. Low temp for precision. */
export async function calculate(
  ai: any,
  systemPrompt: string,
  userMessage: string,
  maxTokens = 800
): Promise<CFAIResult> {
  return runCFAI(ai, "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b", [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ], { maxTokens, temperature: 0.1 });
}

/** Deep reasoning with Nemotron 120B. */
export async function reason(
  ai: any,
  systemPrompt: string,
  userMessage: string,
  maxTokens = 800
): Promise<CFAIResult> {
  return runCFAI(ai, "@cf/nvidia/nemotron-3-120b-a12b", [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ], { maxTokens, temperature: 0.2 });
}

/** Fallback reasoning with 70B if Nemotron fails. */
export async function reasonFallback(
  ai: any,
  systemPrompt: string,
  userMessage: string,
  maxTokens = 800
): Promise<CFAIResult> {
  return runCFAI(ai, "@cf/meta/llama-3.3-70b-instruct-fp8-fast", [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ], { maxTokens, temperature: 0.2 });
}

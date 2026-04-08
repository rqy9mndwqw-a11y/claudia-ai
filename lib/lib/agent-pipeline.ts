/**
 * Multi-model agent pipeline:
 *   1. CF Llama 8B → classify intent (free, fast)
 *   2a. CF DeepSeek R1 → math/quantitative analysis (math-heavy agents only)
 *   2b. CF Nemotron 120B → deep reasoning + synthesis (all agents, fallback to CF 70B)
 *   3. Groq llama-3.3-70b-versatile → CLAUDIA voice delivery
 *
 * Math-heavy agents (Risk Manager, Chart Reader, Yield Scout, Token Analyst)
 * get a DeepSeek R1 pass before Nemotron — the math output feeds into reasoning.
 */

import { classify, calculate, reason, reasonFallback } from "@/lib/cloudflare-ai";
import type { AgentDataContext } from "@/lib/data/agent-data";
import { formatDataContextForPrompt } from "@/lib/data/format-context";
import { CLAUDIA_VOICE_PROMPT } from "@/lib/claudia-voice";

// ── Agents that benefit from DeepSeek R1 math reasoning ──

const MATH_HEAVY_AGENTS = new Set([
  "claudia-risk-check",    // Kelly criterion, position sizing, drawdown
  "claudia-chart-reader",  // RSI divergence, MACD, technical indicators
  "claudia-yield-scout",   // APY calculations, IL math, emission schedules
  "claudia-token-analyst", // FDV, supply analysis, valuation models
]);

function getMathFocus(agentId: string): string {
  const focuses: Record<string, string> = {
    "claudia-risk-check": "Kelly criterion position sizing, drawdown calculations, risk/reward ratios, portfolio exposure limits, stop loss placement math",
    "claudia-chart-reader": "RSI divergence signals, MACD crossovers, Bollinger Band squeeze detection, ATR volatility, support/resistance levels from price data",
    "claudia-yield-scout": "APY sustainability calculations, impermanent loss projections, real yield vs emissions breakdown, TVL stability analysis, fee revenue math",
    "claudia-token-analyst": "fully diluted valuation, circulating vs total supply analysis, emission schedules and inflation rate, price-to-earnings equivalent ratios",
  };
  return focuses[agentId] || "quantitative financial analysis";
}

export interface PipelineResult {
  finalResponse: string;
  usedFallback: boolean;
  steps: Array<{ name: string; model: string; output: string }>;
}

// ── Groq voice delivery — uses existing GROQ_API_KEY ──

async function claudiaVoiceStep(
  analysis: string,
  userMessage: string,
  groqApiKey: string
): Promise<string> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${groqApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: 300,
      temperature: 0.7,
      messages: [
        { role: "system", content: CLAUDIA_VOICE_PROMPT },
        {
          role: "user",
          content: `The user asked: "${userMessage}"\n\nAnalysis:\n${analysis}\n\nDeliver the key insight in your voice. Be direct. Under 150 words.`,
        },
      ],
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Groq voice step failed: ${response.status}`);
  }

  const data = (await response.json()) as any;
  return data.choices?.[0]?.message?.content?.trim() || "";
}

// ── Build reasoning prompt for a specific agent ──

function buildReasoningPrompt(
  agentName: string,
  agentSystemPrompt: string,
  dataContext: string
): string {
  return `You are analyzing a crypto/DeFi question as ${agentName}.

Your expertise: ${agentSystemPrompt}

${dataContext || "No live data available for this query."}

Analyze the user question using the data above.
Be specific — reference actual numbers from the data.
Identify the 2-3 most important findings.
Give a clear assessment based on the data.
If data is missing or insufficient, say so explicitly.
Keep your analysis focused and under 200 words.`;
}

// ── Main pipeline executor ──

export async function executeAgentPipeline(
  userMessage: string,
  agent: { id: string; name: string; system_prompt: string },
  dataContext: AgentDataContext,
  env: { AI: any; GROQ_API_KEY: string }
): Promise<PipelineResult> {
  const steps: PipelineResult["steps"] = [];
  const formattedData = formatDataContextForPrompt(dataContext);
  let usedFallback = false;

  // Step 1 — CF Llama 8B: Quick intent classification
  let classification = "";
  try {
    classification = await classify(
      env.AI,
      "Extract the key intent, any mentioned crypto assets, and what type of analysis is needed. Be brief — 2-3 sentences max.",
      userMessage,
      200
    );
    steps.push({ name: "classify", model: "@cf/meta/llama-3.1-8b-instruct-fast", output: classification });
  } catch {
    classification = userMessage;
    steps.push({ name: "classify", model: "skipped", output: "classification failed, using original message" });
  }

  // Step 2 — Reasoning: DeepSeek R1 for math agents, then Nemotron for all
  let analysis = "";
  const reasoningPrompt = buildReasoningPrompt(agent.name, agent.system_prompt, formattedData);
  const reasoningInput = `User question: ${userMessage}\n\nContext from classification: ${classification}`;
  const isMathHeavy = MATH_HEAVY_AGENTS.has(agent.id);

  try {
    let result;

    if (isMathHeavy) {
      // DeepSeek R1 math pass first, then Nemotron synthesizes
      try {
        const mathResult = await calculate(
          env.AI,
          `You are a quantitative analyst specializing in crypto markets.
Perform precise mathematical analysis using the provided data.
Show your calculations. Be specific with numbers.
Focus on: ${getMathFocus(agent.id)}

${formattedData || "No live data available."}`,
          `${reasoningInput}`,
          600
        );
        steps.push({ name: "calculate", model: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b", output: mathResult.text });

        // Nemotron takes DeepSeek's math + broader context
        const enrichedInput = `Mathematical analysis:\n${mathResult.text}\n\nOriginal question: ${userMessage}\nClassification: ${classification}`;
        try {
          result = await reason(env.AI, reasoningPrompt, enrichedInput);
        } catch {
          usedFallback = true;
          result = await reasonFallback(env.AI, reasoningPrompt, enrichedInput);
        }
      } catch {
        // DeepSeek failed — fall back to Nemotron only
        steps.push({ name: "calculate", model: "skipped", output: "DeepSeek R1 unavailable, using Nemotron only" });
        try {
          result = await reason(env.AI, reasoningPrompt, reasoningInput);
        } catch {
          usedFallback = true;
          result = await reasonFallback(env.AI, reasoningPrompt, reasoningInput);
        }
      }
    } else {
      // Non-math agents — Nemotron directly
      try {
        result = await reason(env.AI, reasoningPrompt, reasoningInput);
      } catch {
        usedFallback = true;
        result = await reasonFallback(env.AI, reasoningPrompt, reasoningInput);
      }
    }

    analysis = result.text;
    steps.push({
      name: "analyze",
      model: usedFallback ? "@cf/meta/llama-3.3-70b-instruct-fp8-fast" : "@cf/nvidia/nemotron-3-120b-a12b",
      output: analysis,
    });
  } catch {
    usedFallback = true;
    analysis = `Analysis unavailable. User asked: ${userMessage}. Data: ${formattedData.slice(0, 500)}`;
    steps.push({ name: "analyze", model: "failed", output: "all reasoning models failed" });
  }

  // Step 3 — Groq: CLAUDIA voice delivery
  let finalResponse: string;
  try {
    finalResponse = await claudiaVoiceStep(analysis, userMessage, env.GROQ_API_KEY);
    if (!finalResponse) throw new Error("Empty voice response");
    steps.push({ name: "respond", model: "groq/llama-3.3-70b-versatile", output: finalResponse });
  } catch {
    // Voice step failed — return raw analysis as fallback
    finalResponse = analysis;
    steps.push({ name: "respond", model: "fallback-raw", output: "voice step failed, returning raw analysis" });
  }

  return { finalResponse, usedFallback, steps };
}

// ── Direct Groq fallback — used when entire pipeline fails ──

export async function directGroqFallback(
  userMessage: string,
  agent: { name: string; system_prompt: string },
  dataContext: AgentDataContext,
  groqApiKey: string
): Promise<string> {
  const formattedData = formatDataContextForPrompt(dataContext);

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${groqApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: 300,
      temperature: 0.7,
      messages: [
        { role: "system", content: `${agent.system_prompt}\n\n${CLAUDIA_VOICE_PROMPT}` },
        { role: "user", content: `${userMessage}\n\nLIVE DATA:\n${formattedData}` },
      ],
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) throw new Error(`Groq fallback failed: ${response.status}`);

  const data = (await response.json()) as any;
  return data.choices?.[0]?.message?.content?.trim() || "Something went wrong. Try again.";
}

import { NextRequest, NextResponse } from "next/server";
import { requireMarketplaceAuth, requireTier } from "@/lib/marketplace/middleware";
import { deductPlatformCredits, addCreditsAtomic } from "@/lib/marketplace/db";
import { getAI } from "@/lib/marketplace/db";
import { classify } from "@/lib/cloudflare-ai";
import { callGroq } from "@/lib/groq";
import { CLAUDIA_VOICE_PROMPT } from "@/lib/claudia-voice";
import { getFullAnalysisCost } from "@/lib/credits/agent-tiers";
import { type AgentDataContext } from "@/lib/data/agent-data";
import { formatDataContextForPrompt } from "@/lib/data/format-context";
import { getTaapiIndicators } from "@/lib/data/taapi";
import { getCurrentPrices, extractTickers } from "@/lib/data/market-data";
import { getFredEconomicContext } from "@/lib/data/fred";
import { getCoinPrice, getCoinMetadata, formatCoinPaprikaContext } from "@/lib/data/coinpaprika";
import { searchToken } from "@/lib/data/dexscreener";
import { getYields } from "@/lib/yields-cache";
import { AGENT_ID_TO_INFO } from "@/lib/marketplace/agent-routing";
import { writeFeedPost } from "@/lib/feed/post-writer";

// Dynamic cost — see getFullAnalysisCost() in lib/credits/agent-tiers.ts

// Agent catalog for routing
const AGENT_CATALOG = Object.entries(AGENT_ID_TO_INFO)
  .map(([id, info]) => `${id}: ${info.name} — ${info.description}`)
  .join("\n");

const ROUTING_PROMPT = `You are routing a crypto/DeFi question to specialist agents.
Available agents:
${AGENT_CATALOG}

Given the user's question, select the 3-5 most relevant agents.
Return ONLY a JSON array of agent IDs, nothing else.
Example: ["claudia-chart-reader","claudia-risk-check","claudia-token-analyst"]
Never select more than 5. Never select fewer than 3.`;

const SYNTHESIS_PROMPT_TEMPLATE = (agentCount: number, analyses: string) =>
  `You are synthesizing analysis from ${agentCount} specialist agents who each analyzed the same question from their domain.

Agent analyses:
${analyses}

CRITICAL RULES:
- Reference SPECIFIC numbers from the agent analyses (RSI values, price levels, ATR, etc.)
- Name which agents agree and which disagree BY NAME (e.g. "Chart Reader and Risk Manager both note...")
- If agents cite the same indicator but interpret it differently, explain the disagreement specifically
- The recommendation must include specific price levels (entry, stop-loss, targets) if available

Respond in this exact format:
CONSENSUS: [which agents agree on what, naming them specifically, with numbers. 2-3 sentences]
CONFLICTS: [which specific agents disagree, what they disagree on, and why. Name them. Or "None" if fully aligned. 2-3 sentences]
RECOMMENDATION: [unified actionable recommendation with specific price levels if available. 2-3 sentences]
RISK: [Low | Medium | High | Very High]`;

const VERDICT_PROMPT_TEMPLATE = (consensus: string, recommendation: string, risk: string) =>
  `You are CLAUDIA. You just had multiple specialists analyze a question.

Their consensus: ${consensus}
Their recommendation: ${recommendation}
Overall risk: ${risk}

Give your final verdict. Format exactly like this — no other text:
SCORE: [1-10]/10
VERDICT: [Buy | Hold | Avoid]
RISK: ${risk}
CLAUDIA: [your signature opinion in 2-3 punchy sentences, reference specific data if available]`;

function parseClaudiaVerdict(text: string): {
  score: number;
  verdict: string;
  risk: string;
  opinion: string;
} {
  const scoreMatch = text.match(/SCORE:\s*(\d+)\/10/);
  const verdictMatch = text.match(/VERDICT:\s*(Buy|Hold|Avoid)/i);
  const riskMatch = text.match(/RISK:\s*(Low|Medium|High|Very High)/i);
  const opinionMatch = text.match(/CLAUDIA:\s*(.+)/s);

  return {
    score: scoreMatch ? parseInt(scoreMatch[1]) : 5,
    verdict: verdictMatch?.[1] || "Hold",
    risk: riskMatch?.[1] || "Medium",
    opinion: opinionMatch?.[1]?.trim() || "Analysis complete.",
  };
}

function parseSynthesis(text: string): {
  consensus: string;
  conflicts: string;
  recommendation: string;
  risk: string;
} {
  const consensus = text.match(/CONSENSUS:\s*(.+?)(?=\nCONFLICTS:|$)/s)?.[1]?.trim() || "";
  const conflicts = text.match(/CONFLICTS:\s*(.+?)(?=\nRECOMMENDATION:|$)/s)?.[1]?.trim() || "None";
  const recommendation = text.match(/RECOMMENDATION:\s*(.+?)(?=\nRISK:|$)/s)?.[1]?.trim() || "";
  const risk = text.match(/RISK:\s*(Low|Medium|High|Very High)/i)?.[1] || "Medium";

  return { consensus, conflicts, recommendation, risk };
}

function generateId(): string {
  const chars = "0123456789abcdefghijklmnopqrstuvwxyz";
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export async function POST(req: NextRequest) {
  try {
    // Auth + rate limit
    const auth = await requireMarketplaceAuth(req, { ratePrefix: "full-analysis", rateMax: 5, rateWindowMs: 60_000 });
    if (auth instanceof NextResponse) return auth;

    const { session, user, db } = auth;

    // Tier check
    const tierError = await requireTier(db, user, "use");
    if (tierError) return tierError;

    // Parse body
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

    const message = String((body as any).message || "").trim();
    if (!message || message.length > 2000) {
      return NextResponse.json({ error: "Message required (max 2000 chars)" }, { status: 400 });
    }

    const chatHistory = (body as any).chatHistory as Array<{ role: string; content: string }> | undefined;
    const estimateOnly = !!(body as any).estimateOnly;

    const ai = getAI();
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });
    }

    // Step 1 — Route to agents via 8B (needed for both estimate and run)
    let selectedAgentIds: string[];
    try {
      const routingResult = await classify(ai, ROUTING_PROMPT, message, 200);
      const match = routingResult.match(/\[[\s\S]*?\]/);
      selectedAgentIds = match ? JSON.parse(match[0]) : [];
      selectedAgentIds = selectedAgentIds.filter((id) => AGENT_ID_TO_INFO[id]);
      if (selectedAgentIds.length < 3) {
        selectedAgentIds = ["claudia-chart-reader", "claudia-risk-check", "claudia-token-analyst"];
      }
      if (selectedAgentIds.length > 5) {
        selectedAgentIds = selectedAgentIds.slice(0, 5);
      }
    } catch {
      selectedAgentIds = ["claudia-chart-reader", "claudia-risk-check", "claudia-token-analyst"];
    }

    const creditCost = getFullAnalysisCost(selectedAgentIds.length);

    // Estimate only — return cost without running
    if (estimateOnly) {
      return NextResponse.json({
        agentCount: selectedAgentIds.length,
        agents: selectedAgentIds.map((id) => AGENT_ID_TO_INFO[id]?.name || id),
        creditCost,
        userCredits: user.credits,
      });
    }

    // Check credits
    if (user.credits < creditCost) {
      return NextResponse.json({
        error: "Insufficient credits for this analysis.",
        credits_required: creditCost,
      }, { status: 402 });
    }

    const analysisId = generateId();

    // Deduct dynamic cost upfront
    await deductPlatformCredits(db, session.address, creditCost, `Full Analysis — ${selectedAgentIds.length} agents (${creditCost} credits)`);

    try {

      // Step 2 — Fetch ALL data in ONE parallel batch (no duplicate TAAPI calls)
      // TAAPI once, FRED once, CoinGecko once, then lightweight agent-specific sources
      const tickers = extractTickers(message);
      const mainTicker = tickers[0] || "BTC/USD";
      const mainSymbol = mainTicker.split("/")[0];
      // Ensure BTC is always fetched for market regime context
      if (!tickers.includes("BTC/USD")) tickers.push("BTC/USD");

      const needsCoinPaprika = selectedAgentIds.some((id) =>
        id === "claudia-token-analyst" || id === "claudia-security-check"
      );
      const needsYields = selectedAgentIds.some((id) => id === "claudia-yield-scout");
      const needsDexScreener = selectedAgentIds.some((id) => id === "claudia-security-check");

      const [prices, taapiIndicators, fredEconomic, cpPrice, cpMeta, dexPairs, yields] =
        await Promise.all([
          getCurrentPrices(tickers).catch(() => ({})),
          getTaapiIndicators(mainTicker, "1h").catch(() => null),
          getFredEconomicContext().catch(() => null),
          needsCoinPaprika ? getCoinPrice(mainSymbol).catch(() => null) : Promise.resolve(null),
          needsCoinPaprika ? getCoinMetadata(mainSymbol).catch(() => null) : Promise.resolve(null),
          needsDexScreener ? searchToken(mainSymbol).catch(() => []) : Promise.resolve([]),
          needsYields ? getYields().catch(() => []) : Promise.resolve([]),
        ]);

      // Build merged context from all sources
      const mergedContext: AgentDataContext = {
        prices,
        ...(taapiIndicators && { taapiIndicators }),
        ...(fredEconomic && { fredEconomic }),
      };

      // CoinPaprika
      if (cpPrice || cpMeta) {
        const formatted = formatCoinPaprikaContext(cpPrice, cpMeta);
        if (formatted) mergedContext.coinPaprika = formatted;
      }

      // DexScreener security data
      if ((dexPairs as any[]).length > 0) {
        const pair = (dexPairs as any[])[0];
        mergedContext.dexScreenerSecurity = [
          "DEXSCREENER DATA:",
          `Liquidity: $${pair.liquidity?.usd?.toLocaleString() || "?"}`,
          `24h Volume: $${pair.volume?.h24?.toLocaleString() || "?"}`,
          `24h Buys: ${pair.txns?.h24?.buys || 0} / Sells: ${pair.txns?.h24?.sells || 0}`,
        ].join("\n");
      }

      // Yields
      if ((yields as any[]).length > 0) {
        mergedContext.yields = (yields as any[]).slice(0, 10);
      }

      const formattedData = formatDataContextForPrompt(mergedContext);

      // Step 3 — Contextualize with chat history if provided
      let contextualMessage = message;
      if (chatHistory && chatHistory.length > 0) {
        try {
          const historySummary = await classify(
            ai,
            "Summarize this conversation context in 2 sentences for other analysts:",
            chatHistory.slice(-6).map((m) => `${m.role}: ${m.content}`).join("\n"),
            100
          );
          contextualMessage = `Context from previous conversation: ${historySummary}\n\nCurrent question: ${message}`;
        } catch {
          // History summary failed — use raw message
        }
      }

      // Step 4 — Run agents via Groq (fast, reliable, avoids CF AI timeout)
      const agentResults = await Promise.all(
        selectedAgentIds.map(async (agentId) => {
          const info = AGENT_ID_TO_INFO[agentId];
          if (!info) return { agentId, agentName: agentId, agentIcon: "🤖", analysis: "Agent not found", success: false };

          try {
            const agentPrompt = `You are ${info.name}, a specialist in ${info.description}.

RULES:
- You MUST reference specific numbers from the data below (RSI value, MACD histogram, price levels, etc.)
- State your directional bias clearly: bullish, bearish, or neutral
- If you see conflicting signals, name them specifically
- Include at least one specific price level in your analysis
- Under 150 words

LIVE MARKET DATA:
${formattedData || "No live data available."}`;

            const analysis = await callGroq(
              `${agentPrompt}\n\nUser question: ${contextualMessage}`,
              groqKey,
              300,
              `You are ${info.name}. Be specific, reference real numbers. Under 150 words.`
            );

            return {
              agentId,
              agentName: info.name,
              agentIcon: info.icon,
              analysis: analysis || "No analysis generated.",
              success: !!analysis,
            };
          } catch (err) {
            console.error(`Agent ${agentId} failed:`, (err as Error).message);
            return {
              agentId,
              agentName: info.name,
              agentIcon: info.icon,
              analysis: "Analysis unavailable for this specialist.",
              success: false,
            };
          }
        })
      );

      const successfulResults = agentResults.filter((r) => r.success);
      if (successfulResults.length === 0) {
        throw new Error("All agents failed — Groq may be down");
      }

      // Step 5 — Synthesis via Groq (fast, avoids Nemotron timeout)
      const analysesText = successfulResults.map((r) => `${r.agentName}: ${r.analysis}`).join("\n\n");
      const synthesisPrompt = SYNTHESIS_PROMPT_TEMPLATE(successfulResults.length, analysesText);
      let synthesisRaw: string;
      try {
        synthesisRaw = await callGroq(
          `${synthesisPrompt}\n\nOriginal question: ${contextualMessage}`,
          groqKey,
          500,
          "You are a synthesis analyst. Combine multiple specialist analyses into a unified assessment. Format with CONSENSUS:, CONFLICTS:, RECOMMENDATION:, RISK: sections."
        );
      } catch {
        synthesisRaw = `CONSENSUS: ${successfulResults[0]?.analysis?.slice(0, 200) || "Analysis complete."}\nCONFLICTS: None\nRECOMMENDATION: Review individual agent analyses.\nRISK: Medium`;
      }
      const synthesis = parseSynthesis(synthesisRaw);

      // Step 6 — CLAUDIA verdict via Groq
      let claudiaVerdictRaw: string;
      try {
        const verdictRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${groqKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            max_tokens: 200,
            temperature: 0.7,
            messages: [
              { role: "system", content: CLAUDIA_VOICE_PROMPT + "\n\nFormat your response EXACTLY as instructed below." },
              { role: "user", content: VERDICT_PROMPT_TEMPLATE(synthesis.consensus, synthesis.recommendation, synthesis.risk) },
            ],
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (!verdictRes.ok) throw new Error("Groq failed");
        const verdictData = (await verdictRes.json()) as any;
        claudiaVerdictRaw = verdictData.choices?.[0]?.message?.content?.trim() || "";
      } catch {
        claudiaVerdictRaw = `SCORE: 5/10\nVERDICT: Hold\nRISK: ${synthesis.risk}\nCLAUDIA: Multiple angles analyzed but I couldn't form a strong conviction. Do your own research.`;
      }

      const claudiaVerdict = parseClaudiaVerdict(claudiaVerdictRaw);

      // Step 7 — Save to D1
      const nowMs = Date.now();
      await db.prepare(
        `INSERT INTO full_analyses (id, user_address, question, agent_results, synthesis, claudia_verdict, credits_charged, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        analysisId,
        session.address.toLowerCase(),
        message,
        JSON.stringify(agentResults),
        JSON.stringify(synthesis),
        JSON.stringify(claudiaVerdict),
        creditCost,
        nowMs
      ).run();

      // Step 8 — Record prediction for outcome tracking (only if we have a resolved price)
      const verdictPrice = (prices as Record<string, number>)[mainTicker];
      if (verdictPrice && mainSymbol) {
        const btcPrice = (prices as Record<string, number>)["BTC/USD"] || null;
        // Market regime: derived from TAAPI candle open/close if analyzing BTC,
        // otherwise defaults to "sideways" — the outcome checker will re-derive from BTC data at check time
        let marketRegime = "sideways";
        if (mainTicker === "BTC/USD" && taapiIndicators?.candle) {
          const dayChange = ((taapiIndicators.candle.close - taapiIndicators.candle.open) / taapiIndicators.candle.open) * 100;
          marketRegime = dayChange > 3 ? "bull" : dayChange < -3 ? "bear" : "sideways";
        }

        try {
          await db.prepare(
            `INSERT INTO verdict_outcomes
             (id, analysis_id, user_address, token_symbol, token_ca, verdict, score, risk,
              price_at_verdict, verdict_at, btc_price_at_verdict, market_regime)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            crypto.randomUUID(),
            analysisId,
            session.address.toLowerCase(),
            mainSymbol,
            null,
            claudiaVerdict.verdict,
            claudiaVerdict.score,
            claudiaVerdict.risk,
            verdictPrice,
            nowMs,
            btcPrice,
            marketRegime,
          ).run();
        } catch (err) {
          // Non-fatal — don't fail the analysis if outcome tracking fails
          console.error(JSON.stringify({ event: "verdict_outcome_save_error", analysisId, error: (err as Error).message }));
        }
      }

      // Fire-and-forget: post to CLAUDIA feed
      writeFeedPost(db as unknown as D1Database, {
        post_type: "agent_post",
        agent_job: "full_analysis",
        title: `${mainSymbol} Full Analysis`,
        content: claudiaVerdict.opinion,
        full_content: JSON.stringify({ analysisId, synthesis, claudiaVerdict }),
        verdict: claudiaVerdict.verdict as "Buy" | "Hold" | "Avoid",
        score: claudiaVerdict.score,
        risk: claudiaVerdict.risk,
        token_symbol: mainSymbol,
      }).catch(() => {});

      return NextResponse.json({
        analysisId,
        question: message,
        agents: agentResults,
        synthesis,
        claudiaVerdict,
        creditsCharged: creditCost,
      });
    } catch (err) {
      const errorMsg = (err as Error).message || "Unknown error";
      const errorStack = (err as Error).stack || "";
      console.error(JSON.stringify({
        event: "full_analysis_pipeline_failed",
        error: errorMsg,
        stack: errorStack.slice(0, 500),
        analysisId,
        agents: selectedAgentIds,
        creditCost,
      }));

      // Pipeline failed — refund
      try {
        await addCreditsAtomic(db, session.address, creditCost, "refund", `analysis-fail:${analysisId}`);
      } catch {}

      return NextResponse.json({
        error: "Analysis failed. Credits refunded.",
      }, { status: 503 });
    }
  } catch (err) {
    console.error(JSON.stringify({
      event: "full_analysis_outer_error",
      error: (err as Error).message,
      stack: ((err as Error).stack || "").slice(0, 500),
    }));
    return NextResponse.json({ error: "Failed to run analysis." }, { status: 500 });
  }
}

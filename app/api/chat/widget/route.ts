import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { rateLimit } from "@/lib/auth";
import { getDB, getAI, deductPlatformCredits, addCreditsAtomic } from "@/lib/marketplace/db";
import { getAgentById } from "@/lib/marketplace/db";
import { callGroq } from "@/lib/groq";
import { fetchAgentContext } from "@/lib/data/agent-data";
import { executeAgentPipeline, directGroqFallback } from "@/lib/agent-pipeline";
import { formatDataContextForPrompt } from "@/lib/data/format-context";
import { CLASSIFY_PROMPT, WIDGET_SYSTEM_PROMPT, WIDGET_AGENT_MAP } from "@/lib/chat/widget-prompt";

/**
 * POST /api/chat/widget
 * Floating chat widget — CLAUDIA platform assistant.
 * Free for app guide / general. Credits only for agent execution.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    if (session instanceof NextResponse) return session;

    const rl = await rateLimit(req, "widget-chat", 20, 3600_000);
    if (rl) return rl;

    const body = (await req.json().catch(() => null)) as any;
    if (!body?.message || typeof body.message !== "string") {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    const message = body.message.trim().slice(0, 1000);
    const history = (body.history || []).slice(-10) as Array<{ role: string; content: string }>;
    const groqKey = process.env.GROQ_API_KEY || "";

    // Step 1 — Classify intent via Groq (fast)
    let intent = "general";
    let agentType: string | null = null;
    let ticker: string | null = null;

    try {
      const classifyResponse = await callGroq(
        `User message: "${message}"\n\n${CLASSIFY_PROMPT}`,
        groqKey,
        100,
        "Respond with ONLY valid JSON. No other text."
      );

      const jsonMatch = classifyResponse.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        intent = parsed.intent || "general";
        agentType = parsed.agent || null;
        ticker = parsed.ticker || null;
      }
    } catch {
      intent = "general";
    }

    // Step 2 — Handle based on intent

    // SCAN — special case, read from D1, free
    if (intent === "agent_execute" && agentType === "scan") {
      const db = getDB();
      const scan = (await db
        .prepare("SELECT summary, market_mood, pair_count, top_picks FROM market_scans ORDER BY scanned_at DESC LIMIT 1")
        .first()) as any;

      if (!scan) {
        return NextResponse.json({ response: "no scan data yet. check back in a bit." });
      }

      const topPicks = JSON.parse(scan.top_picks || "[]");
      const picksText = topPicks.slice(0, 5).map((p: any) =>
        `${p.symbol} $${p.price?.toLocaleString() || "?"} — ${p.score}/10`
      ).join("\n");

      const response = [
        `scanned ${scan.pair_count} pairs. mood: ${scan.market_mood}.`,
        "",
        picksText || "nothing stood out.",
        "",
        scan.summary || "",
        "",
        "full breakdown at app.claudia.wtf/scanner",
      ].join("\n");

      return NextResponse.json({ response });
    }

    // AGENT EXECUTE — costs credits
    if (intent === "agent_execute" && agentType && WIDGET_AGENT_MAP[agentType]) {
      const agentInfo = WIDGET_AGENT_MAP[agentType];

      if (!ticker && ["chart", "risk", "token", "security", "meme"].includes(agentType)) {
        return NextResponse.json({
          response: `which token? tell me what to analyze and i'll run ${agentInfo.description.toLowerCase()} on it.`,
        });
      }

      // Check credits
      const db = getDB();
      const user = (await db
        .prepare("SELECT credits FROM users WHERE address = ?")
        .bind(session.address.toLowerCase())
        .first()) as any;

      const credits = user?.credits ?? 0;
      if (credits < agentInfo.cost) {
        return NextResponse.json({
          response: `that costs ${agentInfo.cost} credits. you have ${credits}. top up at app.claudia.wtf/credits`,
        });
      }

      // Execute agent directly — no self-fetch (CF Workers can't call themselves)
      const agentMessage = ticker
        ? `Full ${agentInfo.description.toLowerCase()} of ${ticker}`
        : message;

      try {
        // Deduct credits
        await deductPlatformCredits(db, session.address, agentInfo.cost, `widget:${agentInfo.agentId}:${Date.now()}`);

        // Fetch context and run pipeline
        const dataContext = await fetchAgentContext(agentInfo.agentId, agentMessage);
        const agent = await getAgentById(db, agentInfo.agentId);
        const systemPrompt = agent?.system_prompt || agentInfo.description;

        let reply: string;
        try {
          // Use Groq directly for speed (same as full analysis)
          reply = await callGroq(
            `You are ${agent?.name || agentInfo.description}.\n\n${formatDataContextForPrompt(dataContext) || "No live data."}\n\nUser: ${agentMessage}`,
            groqKey,
            300,
            systemPrompt
          );
        } catch {
          // Refund on failure
          await addCreditsAtomic(db, session.address, agentInfo.cost, "refund", `widget-fail:${agentInfo.agentId}:${Date.now()}`).catch(() => {});
          return NextResponse.json({
            response: "agent failed. credits refunded. try again.",
          });
        }

        const remaining = credits - agentInfo.cost;
        return NextResponse.json({
          response: reply || "got nothing back. weird.",
          agentTriggered: agentInfo.agentId,
          creditsUsed: agentInfo.cost,
          creditsRemaining: remaining,
        });
      } catch (err) {
        return NextResponse.json({
          response: "something broke. try again.",
        });
      }
    }

    // APP GUIDE or GENERAL — free, Groq response
    const conversationMessages = [
      { role: "system" as const, content: WIDGET_SYSTEM_PROMPT },
      ...history.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: message },
    ];

    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groqKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          max_tokens: 300,
          temperature: 0.7,
          messages: conversationMessages,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) throw new Error("Groq failed");
      const data = (await res.json()) as any;
      const response = data.choices?.[0]?.message?.content?.trim() || "something broke. try again.";

      return NextResponse.json({ response });
    } catch {
      return NextResponse.json({
        response: "i'm having a moment. try again.",
      });
    }
  } catch (err) {
    console.error("Widget chat error:", (err as Error).message);
    return NextResponse.json({ error: "Chat failed" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireMarketplaceAuth, requireTier } from "@/lib/marketplace/middleware";
import { listPublicAgents, createAgent } from "@/lib/marketplace/db";
import { validateCreateAgent, generateAgentId } from "@/lib/marketplace/validation";
import type { AgentPublic } from "@/lib/marketplace/types";

/**
 * GET /api/agents — List public agents
 * Query params: category, search, limit, offset
 * Auth: required (100K $CLAUDIA minimum)
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireMarketplaceAuth(req, { ratePrefix: "agents-list", rateMax: 60 });
    if (auth instanceof NextResponse) return auth;

    const { user, db } = auth;

    // Tier check: browse (100K)
    const tierError = await requireTier(db, user, "browse");
    if (tierError) return tierError;

    // Parse query params
    const url = new URL(req.url);
    const category = url.searchParams.get("category") || undefined;
    const search = url.searchParams.get("search") || undefined;
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 100);
    const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);

    const agents = await listPublicAgents(db, { category, search, limit, offset });

    // Strip system_prompt from public listing (don't expose creator's IP)
    const publicAgents: AgentPublic[] = agents.map((a) => {
      let example_prompts: string[] = [];
      try { example_prompts = JSON.parse((a as any).example_prompts || "[]"); } catch {}
      return {
        id: a.id,
        name: a.name,
        description: a.description,
        category: a.category,
        icon: a.icon,
        model: a.model,
        cost_per_chat: a.cost_per_chat,
        creator_address: a.creator_address,
        usage_count: a.usage_count,
        upvotes: a.upvotes,
        downvotes: a.downvotes,
        status: a.status,
        created_at: a.created_at,
        example_prompts,
      };
    });

    return NextResponse.json({
      agents: publicAgents,
      count: publicAgents.length,
      offset,
      limit,
    });
  } catch (err) {
    console.error("List agents error:", (err as Error).message);
    return NextResponse.json(
      { error: "Failed to list agents" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agents — Create a new agent
 * Body: CreateAgentInput
 * Auth: required (500K $CLAUDIA minimum — create tier)
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireMarketplaceAuth(req, { ratePrefix: "agents-create", rateMax: 10 });
    if (auth instanceof NextResponse) return auth;

    const { session, user, db } = auth;

    // Tier check: create (500K)
    const tierError = await requireTier(db, user, "create");
    if (tierError) return tierError;

    // Parse and validate body
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    let input;
    try {
      input = validateCreateAgent(body);
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }

    // Whale-only: premium model requires whale tier (1M)
    if (input.model === "premium") {
      const whaleError = await requireTier(db, user, "whale");
      if (whaleError) {
        return NextResponse.json(
          { error: "Premium model (70B) requires Whale tier (1M $CLAUDIA)" },
          { status: 403 }
        );
      }
    }

    // Limit agents per creator (max 20)
    const creatorAgents = await db.prepare(
      "SELECT COUNT(*) as count FROM agents WHERE creator_address = ? AND status != 'deleted'"
    ).bind(session.address.toLowerCase()).first<{ count: number }>();

    if (creatorAgents && creatorAgents.count >= 20) {
      return NextResponse.json(
        { error: "Maximum 20 agents per creator. Delete some before creating more." },
        { status: 400 }
      );
    }

    const id = generateAgentId();

    await createAgent(db, {
      id,
      creator_address: session.address,
      name: input.name,
      description: input.description,
      category: input.category,
      icon: input.icon,
      system_prompt: input.system_prompt,
      model: input.model,
      cost_per_chat: input.cost_per_chat,
      is_public: input.is_public ? 1 : 0,
    });

    return NextResponse.json({
      id,
      name: input.name,
      message: "Agent created successfully",
    }, { status: 201 });
  } catch (err) {
    console.error("Create agent error:", (err as Error).message);
    return NextResponse.json(
      { error: "Failed to create agent" },
      { status: 500 }
    );
  }
}

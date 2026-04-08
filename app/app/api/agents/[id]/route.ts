import { NextRequest, NextResponse } from "next/server";
import { requireMarketplaceAuth, requireTier } from "@/lib/marketplace/middleware";
import { getAgentById } from "@/lib/marketplace/db";
import type { AgentPublic } from "@/lib/marketplace/types";
import { getRelatedAgentInfo } from "@/lib/marketplace/agent-routing";

/**
 * GET /api/agents/:id — Get a single agent's public details
 * Auth: required (100K $CLAUDIA minimum)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const auth = await requireMarketplaceAuth(req, { ratePrefix: "agent-detail", rateMax: 60 });
    if (auth instanceof NextResponse) return auth;

    const { user, db } = auth;

    // Tier check: browse (100K)
    const tierError = await requireTier(db, user, "browse");
    if (tierError) return tierError;

    if (!id || typeof id !== "string" || id.length > 30) {
      return NextResponse.json({ error: "Invalid agent ID" }, { status: 400 });
    }

    const agent = await getAgentById(db, id);

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Don't expose system_prompt to non-creators
    const isCreator = user.address.toLowerCase() === agent.creator_address.toLowerCase();

    let example_prompts: string[] = [];
    try { example_prompts = JSON.parse((agent as any).example_prompts || "[]"); } catch {}

    let related_agents: Array<{ id: string; name: string; icon: string }> = [];
    try { related_agents = getRelatedAgentInfo(JSON.parse((agent as any).related_agents || "[]")); } catch {}

    const response: AgentPublic & { system_prompt?: string } = {
      id: agent.id,
      name: agent.name,
      description: agent.description,
      category: agent.category,
      icon: agent.icon,
      model: agent.model,
      cost_per_chat: agent.cost_per_chat,
      creator_address: agent.creator_address,
      usage_count: agent.usage_count,
      upvotes: agent.upvotes,
      downvotes: agent.downvotes,
      status: agent.status,
      created_at: agent.created_at,
      example_prompts,
      ...(related_agents.length > 0 && { related_agents }),
    };

    // Only the creator can see the system prompt
    if (isCreator) {
      response.system_prompt = agent.system_prompt;
    }

    return NextResponse.json(response);
  } catch (err) {
    console.error("Get agent error:", (err as Error).message);
    return NextResponse.json(
      { error: "Failed to get agent" },
      { status: 500 }
    );
  }
}

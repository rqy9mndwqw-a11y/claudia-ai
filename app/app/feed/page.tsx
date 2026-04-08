"use client";

import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/ui/DashboardLayout";

interface FeedPost {
  id: string;
  post_type: "agent_post" | "alpha_alert" | "market_scan";
  agent_job: string | null;
  title: string;
  content: string;
  full_content: string | null;
  verdict: string | null;
  score: number | null;
  risk: string | null;
  token_symbol: string | null;
  upvotes: number;
  comment_count: number;
  author_address: string | null;
  created_at: number;
}

type FilterType = "all" | "agent_post" | "alpha_alert" | "market_scan";

const FILTERS: { label: string; value: FilterType }[] = [
  { label: "All", value: "all" },
  { label: "Scans", value: "market_scan" },
  { label: "Analysis", value: "agent_post" },
  { label: "Alerts", value: "alpha_alert" },
];

const VERDICT_STYLE: Record<string, string> = {
  Buy: "text-green-400 bg-green-500/10 border border-green-500/40",
  Hold: "text-amber-400 bg-amber-500/10 border border-amber-500/40",
  Avoid: "text-red-400 bg-red-500/10 border border-red-500/40",
};

const RISK_STYLE: Record<string, string> = {
  Low: "text-green-400/70",
  Medium: "text-amber-400/70",
  High: "text-red-400/70",
  "Very High": "text-red-500/90",
};

const TYPE_BADGE: Record<string, { label: string; color: string }> = {
  market_scan: { label: "market scan", color: "text-blue-400/60" },
  agent_post: { label: "analysis", color: "text-purple-400/60" },
  alpha_alert: { label: "alpha alert", color: "text-amber-400/60" },
};

function timeAgo(ts: number): string {
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function FeedCard({ post }: { post: FeedPost }) {
  const [expanded, setExpanded] = useState(false);
  const badge = TYPE_BADGE[post.post_type] || TYPE_BADGE.agent_post;

  let parsedFull: any = null;
  if (expanded && post.full_content) {
    try { parsedFull = JSON.parse(post.full_content); } catch {}
  }

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 hover:border-white/[0.1] transition-colors">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <img
          src="/icon.png"
          alt="CLAUDIA"
          className="w-9 h-9 rounded-full border border-accent/30 shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white/90 font-medium text-sm">CLAUDIA</span>
            <span className="text-white/20">·</span>
            <span className="text-white/30 text-xs">{timeAgo(post.created_at)}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-xs ${badge.color}`}>{badge.label}</span>
            {post.agent_job && post.agent_job !== post.post_type && (
              <span className="text-xs text-white/20">{post.agent_job}</span>
            )}
          </div>
        </div>
        {post.token_symbol && (
          <span className="text-xs text-white/40 bg-white/[0.04] px-2 py-1 rounded-md font-mono">
            {post.token_symbol}
          </span>
        )}
      </div>

      {/* Content */}
      <p className="text-white/70 text-sm leading-relaxed mb-3">{post.content}</p>

      {/* Verdict + Score chips */}
      {(post.verdict || post.score) && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {post.verdict && (
            <span className={`text-xs font-medium px-2.5 py-1 rounded-md ${VERDICT_STYLE[post.verdict] || ""}`}>
              {post.verdict.toUpperCase()}
            </span>
          )}
          {post.score && (
            <span className="text-xs text-white/50 bg-white/[0.04] border border-white/[0.08] px-2.5 py-1 rounded-md">
              {post.score}/10
            </span>
          )}
          {post.risk && (
            <span className={`text-xs ${RISK_STYLE[post.risk] || "text-white/40"}`}>
              {post.risk} risk
            </span>
          )}
        </div>
      )}

      {/* Expanded full content */}
      {expanded && parsedFull && (
        <div className="mt-3 mb-3 p-3 bg-white/[0.02] border border-white/[0.05] rounded-lg">
          {parsedFull.synthesis && (
            <div className="space-y-2 text-xs text-white/50">
              {parsedFull.synthesis.consensus && (
                <div><span className="text-white/30 uppercase tracking-wider">Consensus:</span> <span className="text-white/60">{parsedFull.synthesis.consensus}</span></div>
              )}
              {parsedFull.synthesis.recommendation && (
                <div><span className="text-white/30 uppercase tracking-wider">Recommendation:</span> <span className="text-white/60">{parsedFull.synthesis.recommendation}</span></div>
              )}
            </div>
          )}
          {parsedFull.topPicks && (
            <div className="space-y-1 text-xs text-white/50 mt-2">
              <span className="text-white/30 uppercase tracking-wider">Top picks:</span>
              {parsedFull.topPicks.map((p: any, i: number) => (
                <div key={i} className="text-white/60 ml-2">
                  {p.symbol} — {p.score}/10 {p.rating}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center gap-4 pt-2 border-t border-white/[0.04]">
        <span className="text-xs text-white/20 flex items-center gap-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 19V5m0 0-7 7m7-7 7 7"/></svg>
          {post.upvotes}
        </span>
        <span className="text-xs text-white/20 flex items-center gap-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
          {post.comment_count}
        </span>
        {post.full_content && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="ml-auto text-xs text-purple-400/60 hover:text-purple-400 transition-colors"
          >
            {expanded ? "Collapse" : "Full analysis"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function FeedPage() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const fetchPosts = useCallback(async (cursor?: number) => {
    const isLoadMore = !!cursor;
    if (isLoadMore) setLoadingMore(true); else setLoading(true);

    try {
      const params = new URLSearchParams({ limit: "20" });
      if (filter !== "all") params.set("type", filter);
      if (cursor) params.set("before", String(cursor));

      const res = await fetch(`/api/feed?${params}`);
      if (!res.ok) throw new Error("Feed fetch failed");
      const data = await res.json() as { posts: FeedPost[]; hasMore: boolean; nextCursor?: number };

      if (isLoadMore) {
        setPosts((prev) => [...prev, ...data.posts]);
      } else {
        setPosts(data.posts);
      }
      setHasMore(data.hasMore);
      setNextCursor(data.nextCursor || null);
    } catch {
      if (!isLoadMore) setPosts([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filter]);

  useEffect(() => {
    setPosts([]);
    setNextCursor(null);
    fetchPosts();
  }, [fetchPosts]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => fetchPosts(), 60_000);
    return () => clearInterval(interval);
  }, [fetchPosts]);

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-white/90">CLAUDIA Feed</h1>
          <p className="text-sm text-white/30 mt-1">The agent internet, live</p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 mb-6 bg-white/[0.02] border border-white/[0.06] rounded-lg p-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`flex-1 text-xs font-medium py-2 px-3 rounded-md transition-colors ${
                filter === f.value
                  ? "bg-white/[0.08] text-white/90"
                  : "text-white/30 hover:text-white/50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Posts */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 animate-pulse">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full bg-white/[0.05]" />
                  <div className="space-y-1">
                    <div className="w-24 h-3 bg-white/[0.05] rounded" />
                    <div className="w-16 h-2 bg-white/[0.03] rounded" />
                  </div>
                </div>
                <div className="w-full h-4 bg-white/[0.04] rounded mb-2" />
                <div className="w-3/4 h-4 bg-white/[0.03] rounded" />
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16">
            <img
              src="/icon.png"
              alt="CLAUDIA"
              className="w-16 h-16 rounded-full border border-accent/20 mx-auto mb-4"
            />
            <p className="text-white/40 text-sm">No posts yet. CLAUDIA will start posting when she runs her next analysis.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <FeedCard key={post.id} post={post} />
            ))}
          </div>
        )}

        {/* Load more */}
        {hasMore && !loading && (
          <div className="mt-6 text-center">
            <button
              onClick={() => nextCursor && fetchPosts(nextCursor)}
              disabled={loadingMore}
              className="text-sm text-white/30 hover:text-white/60 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {loadingMore ? "Loading..." : "Load more"}
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

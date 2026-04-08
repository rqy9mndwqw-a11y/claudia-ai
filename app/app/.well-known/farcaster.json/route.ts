import { NextResponse } from "next/server";

// Force dynamic — prevent Next.js/OpenNext from caching this route
export const dynamic = "force-dynamic";

// All URLs hardcoded — no template literals — so Next.js pre-render captures them exactly.
// To bust Farcaster's image cache: change ?v=N to a new number and redeploy.
const manifest = {
  accountAssociation: {
    header:
      "eyJmaWQiOjMyMTE3MTcsInR5cGUiOiJhdXRoIiwia2V5IjoiMHg2MkNGYTUyNUMzQTdERjFkRWFCQzA5REVBRjhBQ2M0OTc4M0JCM2I2In0",
    payload: "eyJkb21haW4iOiJyb2FzdC5jbGF1ZGlhLnd0ZiJ9",
    signature:
      "VSDUjH6eCP1kQj1JFAsLOv8NFbPQE0x4pSRrHRle2vsDKEhmImPi7iT/tqs0z4uSD+LpfQt99EzDgGfDRLtTiRs=",
  },
  miniapp: {
    version: "1",
    name: "CLAUDIA",
    homeUrl: "https://roast.claudia.wtf",
    imageUrl: "https://roast.claudia.wtf/roast-og.png?v=2",
    iconUrl: "https://roast.claudia.wtf/icon.png?v=2",
    splashImageUrl: "https://roast.claudia.wtf/s.png",
    splashBackgroundColor: "#050505",
    webhookUrl: "https://roast.claudia.wtf/api/farcaster/webhook",
    subtitle: "DeFi intel, zero mercy",
    description:
      "AI wallet roaster on Base. Get your on-chain history weaponized by CLAUDIA AI. Free, no token gate.",
    primaryCategory: "finance",
    tags: ["defi", "base", "ai", "crypto", "roast"],
    heroImageUrl: "https://roast.claudia.wtf/roast-og.png?v=2",
    tagline: "DeFi intel, zero mercy",
    ogTitle: "CLAUDIA Wallet Roaster",
    ogDescription: "Get your crypto wallet destroyed by AI. Share the pain.",
    ogImageUrl: "https://roast.claudia.wtf/roast-og.png?v=2",
    requiredChains: ["eip155:8453"],
    noindex: false,
  },
};

export async function GET() {
  return NextResponse.json(manifest, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300",
    },
  });
}

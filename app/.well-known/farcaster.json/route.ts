import { NextResponse } from "next/server";

const APP_URL = "https://roast.claudia.wtf";

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
    homeUrl: APP_URL,
    iconUrl: `${APP_URL}/icon.png`,
    splashImageUrl: `${APP_URL}/s.png`,
    splashBackgroundColor: "#050505",
    webhookUrl: `${APP_URL}/api/farcaster/webhook`,
    subtitle: "DeFi intel, zero mercy",
    description:
      "AI wallet roaster on Base. Get your on-chain history weaponized by CLAUDIA AI. Free, no token gate.",
    primaryCategory: "finance",
    tags: ["defi", "base", "ai", "crypto", "roast"],
    heroImageUrl: `${APP_URL}/roast-og.png`,
    tagline: "DeFi intel, zero mercy",
    ogTitle: "CLAUDIA Wallet Roaster",
    ogDescription: "Get your crypto wallet destroyed by AI. Share the pain.",
    ogImageUrl: `${APP_URL}/roast-og.png`,
    requiredChains: ["eip155:8453"],
    noindex: false,
  },
};

export async function GET() {
  return NextResponse.json(manifest, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

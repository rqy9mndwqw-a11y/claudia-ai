import type { Metadata } from "next";

const APP_URL = "https://roast.claudia.wtf";

const frameEmbed = {
  version: "1",
  imageUrl: `${APP_URL}/roast-og.png`,
  button: {
    title: "Roast My Wallet",
    action: {
      type: "launch_frame",
      name: "CLAUDIA Wallet Roaster",
      url: APP_URL,
      splashImageUrl: `${APP_URL}/s.png`,
      splashBackgroundColor: "#050505",
    },
  },
};

export const metadata: Metadata = {
  title: "Roast My Wallet — CLAUDIA AI",
  description:
    "Get your crypto wallet roasted by CLAUDIA AI. She'll analyze your portfolio and destroy you with facts.",
  openGraph: {
    title: "CLAUDIA Wallet Roaster",
    description: "Get destroyed by AI. Share the pain.",
    siteName: "CLAUDIA",
    url: APP_URL,
    type: "website",
    images: [`${APP_URL}/roast-og.png`],
  },
  twitter: {
    card: "summary_large_image",
    title: "CLAUDIA Wallet Roaster",
    description: "Get destroyed by AI. Share the pain.",
  },
  other: {
    "fc:miniapp": JSON.stringify(frameEmbed),
    "fc:frame": JSON.stringify(frameEmbed),
  },
};

export default function RoastLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

import type { Metadata } from "next";

const miniAppEmbed = {
  version: "1",
  imageUrl: "https://roast.claudia.wtf/roast-og.png",
  button: {
    title: "Roast My Wallet",
    action: {
      type: "launch_frame",
      name: "CLAUDIA Wallet Roaster",
      url: "https://roast.claudia.wtf",
      splashImageUrl: "https://roast.claudia.wtf/roast-splash.png",
      splashBackgroundColor: "#000000",
    },
  },
};

export const metadata: Metadata = {
  title: "Roast My Wallet — CLAUDIA AI",
  description:
    "Get your crypto wallet roasted by CLAUDIA AI. She'll analyze your portfolio and destroy you with facts.",
  openGraph: {
    title: "Roast My Wallet — CLAUDIA AI",
    description: "Get destroyed by AI. Share the pain.",
    siteName: "CLAUDIA",
    url: "https://roast.claudia.wtf",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Roast My Wallet — CLAUDIA AI",
    description: "Get destroyed by AI. Share the pain.",
  },
  other: {
    "fc:miniapp": JSON.stringify(miniAppEmbed),
  },
};

export default function RoastLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

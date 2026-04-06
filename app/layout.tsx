import type { Metadata } from "next";
import Providers from "@/components/Providers";
import MiniAppReady from "@/components/farcaster/MiniAppReady";
import "./globals.css";

export const dynamic = "force-dynamic";

const APP_URL = "https://roast.claudia.wtf";

export const metadata: Metadata = {
  title: "CLAUDIA — AI Intelligence for Speculative Assets",
  description:
    "Token-gated AI agents covering crypto markets, on-chain data, and speculative assets. Every query burns $CLAUDIA supply. Built on Base.",
  icons: {
    icon: [
        { url: "/favicon32.jpg", sizes: "32x32", type: "image/jpeg" },
        { url: "/favicon16.jpg", sizes: "16x16", type: "image/jpeg" },
      ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "CLAUDIA",
    description: "AI agents for DeFi. Roast My Wallet free.",
    images: [`${APP_URL}/roast-og.png`],
  },
  other: {
    "fc:miniapp": JSON.stringify({
      version: "1",
      imageUrl: `${APP_URL}/roast-og.png`,
      button: {
        title: "Roast My Wallet",
        action: {
          type: "launch_frame",
          name: "CLAUDIA",
          url: APP_URL,
          splashImageUrl: `${APP_URL}/s.png`,
          splashBackgroundColor: "#050505",
        },
      },
    }),
    "fc:frame": JSON.stringify({
      version: "1",
      imageUrl: `${APP_URL}/roast-og.png`,
      button: {
        title: "Roast My Wallet",
        action: {
          type: "launch_frame",
          name: "CLAUDIA",
          url: APP_URL,
          splashImageUrl: `${APP_URL}/s.png`,
          splashBackgroundColor: "#050505",
        },
      },
    }),
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg font-body text-zinc-200 antialiased">
        <MiniAppReady />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

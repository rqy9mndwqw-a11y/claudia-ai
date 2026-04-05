import type { Metadata } from "next";

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
};

export default function RoastLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

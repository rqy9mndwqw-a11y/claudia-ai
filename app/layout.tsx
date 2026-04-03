import type { Metadata } from "next";
import Providers from "@/components/Providers";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CLAUDIA — AI Intelligence for Speculative Assets",
  description:
    "Token-gated AI agents covering crypto markets, on-chain data, and speculative assets. Every query burns $CLAUDIA supply. Built on Base.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg font-body text-zinc-200 antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}

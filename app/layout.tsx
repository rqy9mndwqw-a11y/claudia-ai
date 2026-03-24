import type { Metadata } from "next";
import Providers from "@/components/Providers";
import FloatingClaudia from "@/components/FloatingClaudia";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Claudia AI — DeFi Without the Drama",
  description:
    "AI-powered DeFi assistant that explains yield opportunities in plain English. When Claude won't, Claudia will.",
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
          <FloatingClaudia />
        </Providers>
      </body>
    </html>
  );
}

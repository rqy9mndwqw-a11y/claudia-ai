import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { base } from "wagmi/chains";

export const wagmiConfig = getDefaultConfig({
  appName: "Claudia AI",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "5a76f9ca1a33e6104b8068c1316a1d65",
  chains: [base],
  ssr: true,
});

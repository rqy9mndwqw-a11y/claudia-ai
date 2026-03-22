import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { base } from "wagmi/chains";

export const wagmiConfig = getDefaultConfig({
  appName: "Claudia AI",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "claudia-dev",
  chains: [base],
  ssr: true,
});

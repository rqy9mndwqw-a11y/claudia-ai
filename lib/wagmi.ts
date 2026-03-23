import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { base } from "wagmi/chains";
import { http, fallback } from "wagmi";

export const wagmiConfig = getDefaultConfig({
  appName: "Claudia AI",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "5a76f9ca1a33e6104b8068c1316a1d65",
  chains: [base],
  ssr: true,
  transports: {
    [base.id]: fallback([
      http(process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org"),
      http("https://base.meowrpc.com"),
      http("https://1rpc.io/base"),
      http("https://base.drpc.org"),
    ]),
  },
});

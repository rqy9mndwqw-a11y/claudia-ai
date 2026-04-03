import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  coinbaseWallet,
  walletConnectWallet,
  phantomWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { base } from "wagmi/chains";
import { http, fallback } from "wagmi";

export const wagmiConfig = getDefaultConfig({
  appName: "Claudia AI",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "",
  chains: [base],
  ssr: true,
  wallets: [
    {
      groupName: "Popular",
      wallets: [metaMaskWallet, coinbaseWallet, phantomWallet, walletConnectWallet],
    },
  ],
  transports: {
    [base.id]: fallback([
      http(process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org"),
      http("https://base.meowrpc.com"),
      http("https://1rpc.io/base"),
      http("https://base.drpc.org"),
    ]),
  },
});

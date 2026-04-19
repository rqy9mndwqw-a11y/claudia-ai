import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  coinbaseWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { customPhantomWallet } from "./wallets/custom-phantom";
import { base } from "wagmi/chains";
import { http, fallback } from "wagmi";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";

export const wagmiConfig = getDefaultConfig({
  appName: "Claudia AI",
  projectId,
  chains: [base],
  ssr: true,
  wallets: [
    {
      groupName: "Popular",
      wallets: [
        // injected() handled by metaMaskWallet for desktop extensions
        metaMaskWallet,
        // Coinbase: deep links on mobile, extension on desktop
        coinbaseWallet,
        // RainbowKit's built-in phantomWallet has no mobile path, so we
        // bake our own with a WalletConnect fallback (see lib/wallets/custom-phantom.ts).
        () => customPhantomWallet({ projectId }),
        // WalletConnect: catches all other mobile wallets
        walletConnectWallet,
      ],
    },
  ],
  transports: {
    [base.id]: fallback([
      // Coinbase Node — 10M free req/month, 50 req/sec
      ...(process.env.NEXT_PUBLIC_COINBASE_NODE_API_KEY
        ? [http(`https://api.developer.coinbase.com/rpc/v1/base/${process.env.NEXT_PUBLIC_COINBASE_NODE_API_KEY}`)]
        : []),
      // Fallbacks
      http(process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org"),
      http("https://base.meowrpc.com"),
      http("https://1rpc.io/base"),
      http("https://base.drpc.org"),
    ]),
  },
});

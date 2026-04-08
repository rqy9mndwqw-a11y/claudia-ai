import type { PrivyClientConfig } from "@privy-io/react-auth";
import { base } from "viem/chains";

export const privyConfig: PrivyClientConfig = {
  appearance: {
    theme: "dark",
    accentColor: "#39ff14",
    logo: "https://claudia.wtf/favicon.png",
  },
  loginMethods: ["email", "wallet"],
  embeddedWallets: {
    createOnLogin: "users-without-wallets",
  },
  defaultChain: base,
  supportedChains: [base],
};

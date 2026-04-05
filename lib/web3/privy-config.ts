import type { PrivyClientConfig } from "@privy-io/react-auth";
import { base } from "viem/chains";

export const privyConfig: PrivyClientConfig = {
  appearance: {
    theme: "dark",
    accentColor: "#E8295B",
    logo: "https://claudia.wtf/favicon.svg",
  },
  loginMethods: ["email", "wallet"],
  embeddedWallets: {
    createOnLogin: "users-without-wallets",
  },
  defaultChain: base,
  supportedChains: [base],
};

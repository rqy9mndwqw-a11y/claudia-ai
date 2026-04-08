export const GATE_MESSAGES = {
  NOT_CONNECTED: {
    title: "Connect to continue",
    body: "Connect your wallet or sign in with email to access CLAUDIA.",
    cta: "Connect Wallet",
    ctaSecondary: "Sign in with Email",
  },
  NO_CLAUDIA: {
    title: "Hold $CLAUDIA to unlock",
    body: "Buy $CLAUDIA on Aerodrome to access AI agents, scanner, and portfolio tools.",
    cta: "Buy on Aerodrome →",
    ctaSecondary: "Get USDC first →",
  },
  NO_NFT: {
    title: "Signal NFT required",
    body: "Enter your NFT in the arena. Mint a Signal Collection NFT to compete.",
    cta: "Mint NFT — from 1,000 $CLAUDIA",
    ctaSecondary: "Learn more →",
  },
  NO_LEGENDARY: {
    title: "Legendary access only",
    body: "Governance voting requires a Legendary or Oracle Signal NFT.",
    cta: "View Collection →",
    ctaSecondary: null,
  },
  TOXICITY_LOCKED: {
    title: "Hold 25,000 $CLAUDIA to unlock",
    body: "Maximum Toxicity is reserved for serious $CLAUDIA holders.",
    cta: "Buy $CLAUDIA →",
    ctaSecondary: null,
  },
  FREE_CREDITS: {
    title: "Credits remaining",
    body: "You have {n} credits remaining. Buy $CLAUDIA to keep access.",
    cta: "Continue",
    ctaSecondary: "Buy $CLAUDIA →",
  },
} as const;

export type GateReason = keyof typeof GATE_MESSAGES;

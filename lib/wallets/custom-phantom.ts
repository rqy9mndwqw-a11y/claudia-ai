import {
  type Wallet,
  type WalletDetailsParams,
  getWalletConnectConnector,
} from "@rainbow-me/rainbowkit";
import { createConnector } from "wagmi";
import { injected } from "wagmi/connectors";

// RainbowKit's built-in phantomWallet (2.1.3 → 2.2.10) is injection-only —
// no mobile WalletConnect path, so on mobile browsers `installed` is false
// and RainbowKit filters the entry out of the rendered modal.
//
// This custom wallet mirrors the Bybit / Binance pattern: use injection when
// `window.phantom.ethereum` is present (desktop extension, Phantom in-app
// browser), otherwise fall through to WalletConnect v2 with a Phantom
// universal-link deep link so the button still appears and deep-links
// directly into the Phantom iOS/Android app.
//
// Phantom's universal link scheme reference:
//   https://docs.phantom.com/phantom-deeplinks/provider-methods/connect

interface CustomPhantomOptions {
  projectId: string;
}

export const customPhantomWallet = ({
  projectId,
}: CustomPhantomOptions): Wallet => {
  const isInjected =
    typeof window !== "undefined" &&
    typeof (window as any).phantom?.ethereum !== "undefined";

  const shouldUseWalletConnect = !isInjected;

  return {
    id: "phantom",
    name: "Phantom",
    rdns: "app.phantom",
    iconUrl:
      "https://explorer-api.walletconnect.com/v3/logo/md/a7ab9180-b5ae-4fcf-fd0b-8bd6c0edb600?projectId=" +
      projectId,
    iconBackground: "#551BF9",
    installed: isInjected,
    downloadUrls: {
      android: "https://play.google.com/store/apps/details?id=app.phantom",
      ios: "https://apps.apple.com/app/phantom-solana-wallet/1598432977",
      mobile: "https://phantom.app/download",
      qrCode: "https://phantom.app/download",
      chrome:
        "https://chromewebstore.google.com/detail/phantom/bfnaelmomeimhlpmgjnjophhpkkoljpa",
      browserExtension: "https://phantom.app/download",
    },

    ...(shouldUseWalletConnect && {
      mobile: {
        getUri: (uri: string) =>
          `https://phantom.app/ul/v1/connect?app_url=${encodeURIComponent(uri)}`,
      },
      qrCode: {
        getUri: (uri: string) => uri,
        instructions: {
          learnMoreUrl: "https://phantom.app/help",
          steps: [
            {
              description: "Download Phantom from the App Store or Play Store.",
              step: "install",
              title: "Install Phantom",
            },
            {
              description: "Open Phantom and create or import a wallet.",
              step: "create",
              title: "Create or Import a Wallet",
            },
            {
              description: "Tap the scan icon in Phantom and scan the QR.",
              step: "scan",
              title: "Scan the QR",
            },
          ],
        },
      },
    }),

    extension: {
      instructions: {
        learnMoreUrl: "https://phantom.app/help",
        steps: [
          {
            description:
              "Install the Phantom extension from the Chrome Web Store.",
            step: "install",
            title: "Install Phantom Extension",
          },
          {
            description: "Create a new wallet or import an existing one.",
            step: "create",
            title: "Create or Import a Wallet",
          },
          {
            description: "Refresh the page to connect.",
            step: "refresh",
            title: "Refresh Page",
          },
        ],
      },
    },

    createConnector: (walletDetails: WalletDetailsParams) => {
      if (shouldUseWalletConnect) {
        // WC factory already returns `(walletDetails) => CreateConnectorFn`.
        return getWalletConnectConnector({ projectId })(walletDetails);
      }

      // Mirror RainbowKit's internal createInjectedConnector — wire wagmi's
      // `injected` to a Phantom-specific target so we pull `window.phantom.ethereum`
      // rather than the generic `window.ethereum`.
      return createConnector((config) => ({
        ...injected({
          target: () => ({
            id: walletDetails.rkDetails.id,
            name: walletDetails.rkDetails.name,
            provider:
              typeof window !== "undefined"
                ? (window as any).phantom?.ethereum
                : undefined,
          }),
        })(config),
        ...walletDetails,
      }));
    },
  };
};

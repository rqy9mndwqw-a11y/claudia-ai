"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export default function WalletConnect() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const connected = mounted && account && chain;

        return (
          <div
            {...(!mounted && {
              "aria-hidden": true,
              style: { opacity: 0, pointerEvents: "none", userSelect: "none" },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <button
                    onClick={openConnectModal}
                    className="bg-accent hover:bg-accent/80 text-white font-heading font-bold
                               px-6 py-3 rounded-xl transition-all duration-200 glow"
                  >
                    Connect Wallet
                  </button>
                );
              }

              if (chain.unsupported) {
                return (
                  <button
                    onClick={openChainModal}
                    className="bg-red-600 hover:bg-red-700 text-white font-body font-medium
                               px-4 py-2 rounded-lg transition-colors"
                  >
                    Switch to Base
                  </button>
                );
              }

              return (
                <button
                  onClick={openAccountModal}
                  className="bg-surface-light hover:bg-surface-light/80 text-white font-body
                             px-4 py-2 rounded-lg border border-white/10 transition-colors
                             flex items-center gap-2"
                >
                  <span className="w-2 h-2 rounded-full bg-green-400" />
                  {account.displayName}
                </button>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}

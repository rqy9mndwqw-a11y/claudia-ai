/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: "/.well-known/farcaster.json",
        headers: [
          { key: "Content-Type", value: "application/json" },
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://static.cloudflareinsights.com https://s3.tradingview.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",
              "connect-src 'self' https://*.walletconnect.com https://*.walletconnect.org wss://*.walletconnect.com wss://*.walletconnect.org https://api.web3modal.org https://pulse.walletconnect.org https://mainnet.base.org https://base.meowrpc.com https://1rpc.io https://base.drpc.org https://yields.llama.fi https://coins.llama.fi https://api.coingecko.com https://api.groq.com https://*.reown.com wss://*.reown.com https://*.farcaster.xyz https://*.warpcast.com",
              "frame-src https://*.walletconnect.com https://*.walletconnect.org https://*.reown.com https://*.tradingview.com https://*.farcaster.xyz",
              "frame-ancestors https://*.farcaster.xyz https://warpcast.com https://*.warpcast.com https://developers.farcaster.xyz",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

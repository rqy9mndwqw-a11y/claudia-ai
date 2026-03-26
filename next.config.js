/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://static.cloudflareinsights.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",
              "connect-src 'self' https://*.walletconnect.com https://*.walletconnect.org wss://*.walletconnect.com wss://*.walletconnect.org https://api.web3modal.org https://pulse.walletconnect.org https://mainnet.base.org https://base.meowrpc.com https://1rpc.io https://base.drpc.org https://yields.llama.fi https://coins.llama.fi https://api.coingecko.com https://api.groq.com https://*.reown.com wss://*.reown.com",
              "frame-src https://*.walletconnect.com https://*.walletconnect.org https://*.reown.com",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

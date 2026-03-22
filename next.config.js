/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cloudflare Pages compatibility
  output: "standalone",
  images: {
    unoptimized: true,
  },
  // Serve under /app subpath if needed
  // basePath: "/app",
};

module.exports = nextConfig;

import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // Pin the workspace root so Next stops resolving up to the home-dir
  // lockfile under ~/.
  outputFileTracingRoot: __dirname,
  typedRoutes: true,
  experimental: {
    viewTransition: true,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "imagedelivery.net" },
      { protocol: "https", hostname: "*.r2.cloudflarestorage.com" },
      { protocol: "https", hostname: "replicate.delivery" },
    ],
  },
  serverExternalPackages: ["sharp"],
};

export default config;

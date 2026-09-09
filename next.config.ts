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
    ],
  },
  serverExternalPackages: ["sharp"],
  webpack(config) {
    // konva's node entry pulls in `canvas` (a heavy native dep) which we
    // never use — react-konva is loaded only on the browser via dynamic({
    // ssr: false }). Stub out the resolution so the production build doesn't
    // fail trying to find a binary we don't ship.
    config.resolve = config.resolve ?? {};
    config.resolve.fallback = {
      ...(config.resolve.fallback ?? {}),
      canvas: false,
    };
    return config;
  },
};

export default config;

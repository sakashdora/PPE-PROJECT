import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.ARGUS_BUILD_DIR || ".next",
  outputFileTracingRoot: process.cwd(),
  devIndicators: false,
  output: "standalone",
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;

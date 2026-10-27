import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: false,
  // NOTE: intentionally NO `webpack` key here — Next 16 builds with Turbopack
  // by default (which handles Prisma's query_engine_bg.wasm natively). Adding
  // a webpack config forces the legacy bundler and its worker pool OOMs on
  // 2-CPU/4GB CI machines ("Call retries were exceeded").
};

export default nextConfig;

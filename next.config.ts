import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: false,
  // Prisma's queryCompiler engine ships a WASM binary (query_engine_bg.wasm)
  // — required when building with the webpack bundler (Turbopack handles it natively).
  webpack: (config) => {
    config.experiments.asyncWebAssembly = true;
    return config;
  },
};

export default nextConfig;

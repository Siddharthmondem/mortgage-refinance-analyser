import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // All calculations run client-side — no server data exposure
  reactStrictMode: true,
};

export default nextConfig;

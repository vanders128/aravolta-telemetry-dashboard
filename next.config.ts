import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep framework-generated AI guidance out of the public interview repository.
  agentRules: false,
};

export default nextConfig;

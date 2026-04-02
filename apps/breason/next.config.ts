import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@breason/ui", "@breason/shared", "@breason/types", "@breason/prompts"],
};

export default nextConfig;

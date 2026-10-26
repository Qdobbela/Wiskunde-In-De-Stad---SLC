import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // There's another package-lock.json higher up (in the home folder);
  // pin the project root so Next.js doesn't pick that one.
  outputFileTracingRoot: __dirname,
  turbopack: { root: __dirname },
};

export default nextConfig;

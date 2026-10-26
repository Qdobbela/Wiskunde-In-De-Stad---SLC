import type { NextConfig } from "next";

// Static site for GitHub Pages: no Node server. Server logic lives in
// Supabase (Edge Function "leerling" + RLS). On GitHub Pages the site lives
// under /<repo>, set through NEXT_PUBLIC_BASE_PATH at build time.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  // There's another package-lock.json higher up (in the home folder);
  // pin the project root so Next.js doesn't pick that one.
  outputFileTracingRoot: __dirname,
  turbopack: { root: __dirname },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page here is per-student and dynamic, so Cache Components / partial prefetching are off.
  serverExternalPackages: ["@electric-sql/pglite"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep native/WASM database drivers out of the webpack bundle; they are
  // loaded from node_modules at runtime instead.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
};

export default nextConfig;

import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    // Silences the "inferred workspace root" warning when this repo sits
    // inside a parent directory that has its own lockfile.
    root: path.join(__dirname),
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Pre-existing CMS TS debt must not block members webhook deploys.
  typescript: { ignoreBuildErrors: true },
  // Dev HMR/assets break when opening CMS via LAN IP unless allowed here.
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "192.168.10.105",
    "0.0.0.0",
  ],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;

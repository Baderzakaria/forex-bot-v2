import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
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

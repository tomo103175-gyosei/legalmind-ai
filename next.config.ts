import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "prisma"],
  allowedDevOrigins: ["192.168.0.3"],
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/renewal-discovery",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;

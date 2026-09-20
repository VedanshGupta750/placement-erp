import type { NextConfig } from "next";

const configuredDevOrigin = process.env.DEV_ALLOWED_ORIGIN?.trim();

const nextConfig: NextConfig = {
  devIndicators: false,
  allowedDevOrigins: [configuredDevOrigin, "10.104.90.102", "*.trycloudflare.com"].filter(
    (origin): origin is string => Boolean(origin),
  ),
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Cache-Control", value: "public, max-age=300, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;

import type { MetadataRoute } from "next";
import { PWA_CONFIG } from "@/lib/pwa/config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: PWA_CONFIG.name,
    short_name: PWA_CONFIG.shortName,
    description: PWA_CONFIG.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: PWA_CONFIG.backgroundColor,
    theme_color: PWA_CONFIG.themeColor,
    orientation: "portrait-primary",
    categories: ["education", "business", "productivity"],
    related_applications: [{ platform: "webapp", url: "/manifest.webmanifest" }],
    prefer_related_applications: false,
    icons: [
      {
        src: "/pwa/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: PWA_CONFIG.logoPath,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Dashboard", short_name: "Dashboard", url: "/dashboard", icons: [{ src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png" }] },
      { name: "Messages", short_name: "Messages", url: "/messages", icons: [{ src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png" }] },
    ],
  };
}

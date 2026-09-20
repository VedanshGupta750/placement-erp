function publicAssetPath(value: string | undefined, fallback: string) {
  const path = value?.trim().replaceAll("\\", "/");
  if (!path) return fallback;

  // Accept either a public URL (`/pwa/logo.png`) or a developer-friendly
  // filesystem path (`public/pwa/logo.png` or `project/public/pwa/logo.png`).
  const publicDirectory = path.toLowerCase().lastIndexOf("/public/");
  const browserPath = publicDirectory >= 0
    ? path.slice(publicDirectory + "/public".length)
    : path.toLowerCase().startsWith("public/")
      ? `/${path.slice("public/".length)}`
      : path.startsWith("/")
        ? path
        : `/${path}`;

  return browserPath.startsWith("/") && !browserPath.startsWith("//")
    ? browserPath
    : fallback;
}

export const PWA_CONFIG = {
  name: process.env.NEXT_PUBLIC_PWA_NAME?.trim() || "Placement ERP",
  shortName: process.env.NEXT_PUBLIC_PWA_SHORT_NAME?.trim() || "Placement ERP",
  description:
    process.env.NEXT_PUBLIC_PWA_DESCRIPTION?.trim() ||
    "Campus placement management for students, placement teams, and recruiters.",
  developerName: process.env.NEXT_PUBLIC_DEVELOPER_NAME?.trim() || "Placement ERP",
  logoPath: publicAssetPath(process.env.NEXT_PUBLIC_PWA_LOGO_PATH, "/pwa/icon-512.png"),
  themeColor: "#7c5cfc",
  backgroundColor: "#ffffff",
} as const;

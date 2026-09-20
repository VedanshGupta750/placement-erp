import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PwaRuntime } from "@/components/pwa/pwa-runtime";
import { PWA_CONFIG } from "@/lib/pwa/config";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  applicationName: PWA_CONFIG.name,
  title: {
    default: PWA_CONFIG.name,
    template: `%s · ${PWA_CONFIG.name}`,
  },
  description: PWA_CONFIG.description,
  authors: [{ name: PWA_CONFIG.developerName }],
  creator: PWA_CONFIG.developerName,
  publisher: PWA_CONFIG.developerName,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: PWA_CONFIG.logoPath }],
    // iOS ignores the manifest icons and masks this one itself, so it points at
    // the full-bleed 180x180 asset rather than the rounded manifest logo.
    apple: [{ url: "/pwa/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: PWA_CONFIG.shortName,
  },
  formatDetection: { telephone: false },
  other: {
    // Next emits the standard `mobile-web-app-capable`, which Safari honours
    // from iOS 15.4. The Apple-prefixed form is what older iPhones and iPads
    // read to launch the Home Screen icon full-screen instead of in Safari.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport = { themeColor: PWA_CONFIG.themeColor, viewportFit: "cover" as const };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider>
            <PwaRuntime>
              {children}
              <Toaster />
            </PwaRuntime>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Unbounded } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
const unbounded = Unbounded({ subsets: ["latin"], variable: "--font-unbounded", weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "EduForge — learn by building", template: "%s · EduForge" },
  description:
    "EduForge is a learning platform where instructors publish video courses and students learn with progress tracking, direct instructor chat and an AI tutor.",
  openGraph: { type: "website", siteName: "EduForge" },
};

export const viewport: Viewport = { themeColor: "#090d1f", colorScheme: "dark" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${unbounded.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
        >
          Skip to content
        </a>
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}

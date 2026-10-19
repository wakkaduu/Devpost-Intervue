import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import AuthProvider from "@/components/AuthProvider";
import AppHeader from "@/components/AppHeader";
import CategorySidebar from "@/components/CategorySidebar";
import { SessionProvider } from "@/context/SessionContext";
import { SidebarProvider } from "@/context/SidebarContext";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1C2E23" };

export const metadata: Metadata = {
  applicationName: "Intervue",
  appleWebApp: { capable: true, title: "Intervue", statusBarStyle: "black-translucent" },
  icons: { icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }], apple: "/apple-touch-icon.png" },
  title: { default: "Intervue: Mock Interview Practice", template: "%s · Intervue" },
  description: "Practise interviews by voice or in writing and get specific AI coaching on every answer.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased min-h-dvh flex flex-col text-darkslate-900 selection:bg-forest-600 selection:text-white`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-forest-700 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          Skip to main content
        </a>
        <AuthProvider>
          <SidebarProvider>
            <SessionProvider>
              <AppHeader />
              <main id="main-content" className="flex-1">
                {children}
              </main>
            </SessionProvider>
            <CategorySidebar />
          </SidebarProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

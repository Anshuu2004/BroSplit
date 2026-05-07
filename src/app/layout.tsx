import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastHostProvider } from "@/hooks/useToast";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Brosplit — split expenses, settle up",
  description:
    "Mobile-first expense splitter for friends, roommates, and trips. Free, fast, and friction-free.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Brosplit",
  },
};

export const viewport: Viewport = {
  themeColor: "#10b981",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen font-sans">
        <ToastHostProvider>{children}</ToastHostProvider>
      </body>
    </html>
  );
}

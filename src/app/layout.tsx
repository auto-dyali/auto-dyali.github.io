import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AUTO DYALI | Automotive Management",
  description:
    "AUTO DYALI — SaaS de gestion automobile complet pour garages : atelier, POS, stocks, caisse, employés et réservations. ACH GROUP.",
  applicationName: "AUTO DYALI",
  icons: {
    icon: ["/icons/auto-dyali-192.png", "/icons/auto-dyali-512.png"],
    apple: "/icons/auto-dyali-192.png",
  },
  appleWebApp: {
    capable: true,
    title: "AUTO DYALI",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#101F1A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col"><PwaRegister />{children}</body>
    </html>
  );
}

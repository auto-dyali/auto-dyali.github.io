import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AUTO+ | Automotive Management",
  description:
    "AUTO+ — SaaS de gestion automobile complet pour garages : atelier, POS, stocks, caisse, employés et réservations. ACH GROUP.",
  applicationName: "AUTO+",
};

export const viewport: Viewport = {
  themeColor: "#102B32",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

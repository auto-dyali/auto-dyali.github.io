import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  const basePath = process.env.NEXT_PUBLIC_SITE_BASE_PATH ?? "";
  return {
    name: "AUTO DYALI — Automotive Management",
    short_name: "AUTO DYALI",
    id: `${basePath}/`,
    description: "Gestion automobile premium pour garages, ateliers et magasins de pièces.",
    lang: "fr",
    start_url: `${basePath}/`,
    scope: `${basePath}/`,
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone"],
    orientation: "any",
    background_color: "#101F1A",
    theme_color: "#101F1A",
    icons: [
      { src: `${basePath}/icons/auto-dyali-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${basePath}/icons/auto-dyali-192.png`, sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: `${basePath}/icons/auto-dyali-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `${basePath}/icons/auto-dyali-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    categories: ["business", "productivity", "automotive"],
  };
}

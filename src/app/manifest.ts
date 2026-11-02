import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  const basePath = process.env.NEXT_PUBLIC_SITE_BASE_PATH ?? "";
  return {
    name: "AUTO+ — Automotive Management",
    short_name: "AUTO+",
    description: "Gestion automobile premium pour garages, ateliers et magasins de pièces.",
    lang: "fr",
    start_url: `${basePath}/`,
    scope: `${basePath}/`,
    display: "standalone",
    orientation: "any",
    background_color: "#102B32",
    theme_color: "#102B32",
    icons: [
      { src: `${basePath}/icons/auto-plus.svg`, sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    categories: ["business", "productivity", "automotive"],
  };
}

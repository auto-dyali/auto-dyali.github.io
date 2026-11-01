import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_SITE_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  // GitHub Pages sert des fichiers statiques : l'application reste
  // compatible avec Supabase côté navigateur et pourra évoluer vers un
  // hébergement serveur lorsque les Route Handlers seront activés.
  output: "export",
  basePath,
  assetPrefix: basePath ? `${basePath}/` : undefined,
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

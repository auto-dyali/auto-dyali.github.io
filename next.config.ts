import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // GitHub Pages sert des fichiers statiques : l'application reste
  // compatible avec Supabase côté navigateur et pourra évoluer vers un
  // hébergement serveur lorsque les Route Handlers seront activés.
  output: "export",
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

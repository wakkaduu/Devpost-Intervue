import type { MetadataRoute } from "next";

// Makes the app installable ("Add to Home screen") on phones and desktop browsers.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Intervue: Mock Interview Practice",
    short_name: "Intervue",
    description: "Practise interviews by voice or in writing and get specific AI coaching on every answer.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#23382B",
    theme_color: "#1C2E23",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

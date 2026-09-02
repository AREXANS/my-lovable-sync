import { createFileRoute } from "@tanstack/react-router";
import Index from "@/pages/Index";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Arexanstools OFFICIAL - Key System & XCoins" },
      {
        name: "description",
        content:
          "Arexanstools OFFICIAL - Beli dan perpanjang key script, sistem XCoins, dan manajemen durasi dengan mudah.",
      },
      { property: "og:title", content: "Arexanstools OFFICIAL" },
      {
        property: "og:description",
        content: "Arexanstools OFFICIAL - Key System & XCoins",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "https://files.catbox.moe/raona5.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://files.catbox.moe/raona5.jpg" },
    ],
  }),
  component: Index,
});

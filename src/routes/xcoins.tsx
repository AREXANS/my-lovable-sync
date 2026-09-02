import { createFileRoute } from "@tanstack/react-router";
import XCoins from "@/pages/XCoins";

export const Route = createFileRoute("/xcoins")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "XCoins - Arexanstools OFFICIAL" },
      {
        name: "description",
        content: "Dompet XCoins Arexanstools - top up, transfer, dan bayar key dengan saldo XCoins.",
      },
      { property: "og:title", content: "XCoins - Arexanstools OFFICIAL" },
      { property: "og:description", content: "Dompet XCoins Arexanstools." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: XCoins,
});

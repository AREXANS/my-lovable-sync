import { createFileRoute } from "@tanstack/react-router";
import KeySystem from "@/pages/KeySystem";

export const Route = createFileRoute("/key-system")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Key System - Arexanstools OFFICIAL" },
      {
        name: "description",
        content: "Aktivasi dan kelola key script Anda di Arexanstools OFFICIAL.",
      },
      { property: "og:title", content: "Key System - Arexanstools OFFICIAL" },
      { property: "og:description", content: "Aktivasi dan kelola key script Anda." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: KeySystem,
});

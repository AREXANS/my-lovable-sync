import { createFileRoute } from "@tanstack/react-router";
import History from "@/pages/History";

export const Route = createFileRoute("/history")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Riwayat - Arexanstools OFFICIAL" },
      {
        name: "description",
        content: "Lihat riwayat transaksi dan key Anda di Arexanstools OFFICIAL.",
      },
      { property: "og:title", content: "Riwayat - Arexanstools OFFICIAL" },
      { property: "og:description", content: "Riwayat transaksi Arexanstools." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: History,
});

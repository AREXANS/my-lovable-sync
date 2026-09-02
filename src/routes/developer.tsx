import { createFileRoute } from "@tanstack/react-router";
import Admin from "@/pages/Admin";

export const Route = createFileRoute("/developer")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Developer Dashboard - Arexanstools OFFICIAL" },
      {
        name: "description",
        content: "Dashboard developer Arexanstools untuk manajemen key, script, dan pembayaran.",
      },
      { property: "og:title", content: "Developer Dashboard - Arexanstools OFFICIAL" },
      { property: "og:description", content: "Dashboard developer Arexanstools." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Admin,
});

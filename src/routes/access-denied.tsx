import { createFileRoute } from "@tanstack/react-router";
import LoaderAccessDenied from "@/pages/LoaderAccessDenied";

export const Route = createFileRoute("/access-denied")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Access Denied - Arexanstools OFFICIAL" }],
  }),
  component: LoaderAccessDenied,
});

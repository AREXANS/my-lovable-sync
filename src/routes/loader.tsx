import { createFileRoute } from "@tanstack/react-router";
import LoaderAccessDenied from "@/pages/LoaderAccessDenied";

export const Route = createFileRoute("/loader")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Loader - Arexanstools OFFICIAL" }],
  }),
  component: LoaderAccessDenied,
});

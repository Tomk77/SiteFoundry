import { PageTreeScreen } from "@/features/page-tree";
import { parsePageTreeUrlSearch } from "@/lib/url-view-state";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  validateSearch: parsePageTreeUrlSearch,
  component: PageTreeRoute,
});

function PageTreeRoute() {
  return <PageTreeScreen urlSearch={Route.useSearch()} />;
}

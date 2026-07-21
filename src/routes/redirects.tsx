import { RedirectsScreen } from "@/features/redirects";
import { parseRedirectsUrlSearch } from "@/lib/url-view-state";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/redirects")({
  validateSearch: parseRedirectsUrlSearch,
  component: RedirectsRoute,
});

function RedirectsRoute() {
  return <RedirectsScreen urlSearch={Route.useSearch()} />;
}

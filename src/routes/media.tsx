import { MediaScreen } from "@/features/media";
import { parseMediaUrlSearch } from "@/lib/url-view-state";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/media")({
  validateSearch: parseMediaUrlSearch,
  component: MediaRoute,
});

function MediaRoute() {
  return <MediaScreen urlSearch={Route.useSearch()} />;
}

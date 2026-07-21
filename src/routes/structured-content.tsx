import { StructuredContentScreen, type StructuredSearch } from "@/features/structured-content";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/structured-content")({
  validateSearch: (search: Record<string, unknown>): StructuredSearch => ({
    q: typeof search.q === "string" && search.q.trim() ? search.q : undefined,
    status:
      search.status === "published" || search.status === "concept" ? search.status : undefined,
    type: typeof search.type === "string" && search.type.trim() ? search.type : undefined,
  }),
  component: StructuredContentRoute,
});

function StructuredContentRoute() {
  return <StructuredContentScreen search={Route.useSearch()} />;
}

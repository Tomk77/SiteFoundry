import { PageTemplatesScreen, type PageTemplatesSearch } from "@/features/page-templates";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/page-templates")({
  validateSearch: (search: Record<string, unknown>): PageTemplatesSearch => ({
    q: typeof search.q === "string" ? search.q : undefined,
    template: typeof search.template === "string" ? search.template : undefined,
  }),
  component: PageTemplatesRoute,
});

function PageTemplatesRoute() {
  return <PageTemplatesScreen search={Route.useSearch()} />;
}

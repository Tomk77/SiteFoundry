import { PageEditorScreen } from "@/features/page-editor";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/editor")({
  validateSearch: (search: Record<string, unknown>) => ({
    page: typeof search.page === "string" ? search.page : undefined,
  }),
  component: EditorRoute,
});

function EditorRoute() {
  const { page } = Route.useSearch();

  return <PageEditorScreen pageId={page} />;
}

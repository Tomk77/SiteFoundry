import { AuthScreen } from "@/features/auth";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { mode?: "reset" } =>
    search.mode === "reset" ? { mode: "reset" } : {},
  component: AuthRoute,
});

function AuthRoute() {
  const { mode } = Route.useSearch();

  return <AuthScreen resetRequested={mode === "reset"} />;
}

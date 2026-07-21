import { createFileRoute } from "@tanstack/react-router";
import { NavigationEditor } from "@/features/navigation";

export const Route = createFileRoute("/header-navigation")({
  component: HeaderNavigation,
});

function HeaderNavigation() {
  return <NavigationEditor location="header" />;
}

import { createFileRoute } from "@tanstack/react-router";
import { NavigationEditor } from "../components/navigation-editor";

export const Route = createFileRoute("/header-navigation")({
  component: HeaderNavigation,
});

function HeaderNavigation() {
  return <NavigationEditor location="header" />;
}

import { createFileRoute } from "@tanstack/react-router";
import { NavigationEditor } from "@/features/navigation";

export const Route = createFileRoute("/footer")({ component: Footer });

function Footer() {
  return <NavigationEditor location="footer" />;
}

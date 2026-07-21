import { AuthScreen } from "@/features/auth";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/auth")({ component: AuthScreen });

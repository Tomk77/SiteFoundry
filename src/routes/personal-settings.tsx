import { PersonalSettingsScreen } from "@/features/personal-settings";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/personal-settings")({
  component: PersonalSettingsScreen,
});

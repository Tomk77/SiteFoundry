import { createFileRoute, useNavigate } from "@tanstack/react-router";

import {
  SiteSettingsScreen,
  type PeopleTab,
  type SettingsDestination,
} from "@/features/site-settings";

const destinationValues: SettingsDestination[] = [
  "general",
  "people",
  "languages",
  "domains",
  "api",
  "advanced",
];
const peopleTabValues: PeopleTab[] = ["members", "invitations", "roles"];

export const Route = createFileRoute("/settings")({
  validateSearch: (search: Record<string, unknown>) => ({
    section: destinationValues.includes(search.section as SettingsDestination)
      ? (search.section as SettingsDestination)
      : "general",
    people: peopleTabValues.includes(search.people as PeopleTab)
      ? (search.people as PeopleTab)
      : "members",
  }),
  component: SiteSettingsRoute,
});

function SiteSettingsRoute() {
  const { section, people } = Route.useSearch();
  const navigate = useNavigate({ from: "/settings" });

  return (
    <SiteSettingsScreen
      destination={section}
      onDestinationChange={(destination) =>
        void navigate({ search: (current) => ({ ...current, section: destination }) })
      }
      onPeopleTabChange={(peopleTab) =>
        void navigate({ search: (current) => ({ ...current, people: peopleTab }) })
      }
      peopleTab={people}
    />
  );
}

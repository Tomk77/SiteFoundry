import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";

import { handleDeliveryGraphQLRequest } from "@/lib/delivery-graphql.server";

export const Route = createFileRoute("/api/v1/sites/$siteKey/graphql")({
  server: {
    handlers: {
      GET: ({ request, params }) => handleDeliveryGraphQLRequest(request, params.siteKey),
      OPTIONS: ({ request, params }) => handleDeliveryGraphQLRequest(request, params.siteKey),
      POST: ({ request, params }) => handleDeliveryGraphQLRequest(request, params.siteKey),
    },
  },
});

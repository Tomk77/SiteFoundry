import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";

import { handleDeliveryRestRequest } from "@/lib/delivery-rest.server";

export const Route = createFileRoute("/api/v1/sites/$siteKey/$")({
  server: {
    handlers: {
      GET: ({ request, params }) => handleDeliveryRestRequest(request, params.siteKey),
      OPTIONS: ({ request, params }) => handleDeliveryRestRequest(request, params.siteKey),
    },
  },
});

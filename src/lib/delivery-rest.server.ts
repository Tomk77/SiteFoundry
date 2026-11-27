import { connection as domainConnection, InvalidCursorError, resolvePage } from "@/domain/delivery";

import {
  DeliveryHttpError,
  jsonDeliveryResponse,
  loadDeliveryBundle,
  preflightResponse,
  problemResponse,
  publicSite,
} from "./delivery-api.server";

// Segments after /api/v1/sites/{siteKey}/, located by the site key instead of a fixed offset.
function routeSegments(url: URL, siteKey: string) {
  const segments = url.pathname.split("/").filter(Boolean);
  const start = segments.findIndex(
    (segment, index) => segments[index - 1] === "sites" && segment === encodeURIComponent(siteKey),
  );

  try {
    return segments.slice(start + 1).map(decodeURIComponent);
  } catch {
    throw new DeliveryHttpError("The request path is not valid.", 400, "invalid_url");
  }
}

function connection<T>(values: T[], first: number, after: string | null) {
  try {
    return domainConnection(values, first, after);
  } catch (reason) {
    if (reason instanceof InvalidCursorError)
      throw new DeliveryHttpError(reason.message, 400, "invalid_cursor");

    throw reason;
  }
}

function numberParameter(value: string | null, fallback: number) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function handleDeliveryRestRequest(request: Request, siteKey: string) {
  if (request.method === "OPTIONS") return preflightResponse(request);
  if (request.method !== "GET") {
    return problemResponse(
      request,
      new DeliveryHttpError(
        "The delivery API is read-only.",
        405,
        "method_not_allowed",
        "GET, OPTIONS",
      ),
    );
  }

  try {
    const bundle = await loadDeliveryBundle(request, siteKey);
    const url = new URL(request.url);
    const [resource, identifier, extra] = routeSegments(url, siteKey);
    let result: unknown;

    if (!resource || resource === "site") {
      result = publicSite(bundle);
    } else if (resource === "languages") {
      result = bundle.languages;
    } else if (resource === "pages" && identifier === "resolve") {
      const lookup = url.searchParams.get("url");
      if (!lookup)
        throw new DeliveryHttpError("The url query parameter is required.", 400, "invalid_url");
      result = resolvePage(bundle, lookup);
      if (!result) throw new DeliveryHttpError("Published page not found.", 404, "not_found");
    } else if (resource === "pages" && identifier) {
      result = bundle.pages.find((page) => page.id === identifier);
      if (!result) throw new DeliveryHttpError("Published page not found.", 404, "not_found");
    } else if (resource === "pages") {
      const locale = url.searchParams.get("locale");
      const pages = locale ? bundle.pages.filter((page) => page.locale === locale) : bundle.pages;
      result = connection(
        pages,
        numberParameter(url.searchParams.get("first"), 20),
        url.searchParams.get("after"),
      );
    } else if (resource === "content-types" && identifier && extra === "records") {
      const locale = url.searchParams.get("locale");
      const types = bundle.contentTypes.filter(
        (contentType) =>
          contentType.slug === identifier && (!locale || contentType.locale === locale),
      );
      if (!types.length) throw new DeliveryHttpError("Content type not found.", 404, "not_found");
      const records = types.flatMap((contentType) => contentType.records);
      result = connection(
        records,
        numberParameter(url.searchParams.get("first"), 20),
        url.searchParams.get("after"),
      );
    } else if (resource === "content-types" && identifier) {
      const matches = bundle.contentTypes.filter((contentType) => contentType.slug === identifier);
      if (!matches.length) throw new DeliveryHttpError("Content type not found.", 404, "not_found");
      result = matches;
    } else if (resource === "content-types") {
      result = bundle.contentTypes.map((contentType) => ({
        id: contentType.id,
        slug: contentType.slug,
        name: contentType.name,
        singularName: contentType.singularName,
        description: contentType.description,
        locale: contentType.locale,
        schemaVersion: contentType.schemaVersion,
        schemaPublishedAt: contentType.schemaPublishedAt,
        fields: contentType.fields,
      }));
    } else if (resource === "navigation") {
      const locale = url.searchParams.get("locale");
      const location = url.searchParams.get("location");
      result = bundle.navigation.filter(
        (menu) => (!locale || menu.locale === locale) && (!location || menu.location === location),
      );
    } else if (resource === "redirects") {
      const locale = url.searchParams.get("locale");
      result = locale
        ? bundle.redirects.filter((redirect) => redirect.locale === locale)
        : bundle.redirects;
    } else if (resource === "media") {
      result = bundle.media;
    } else {
      throw new DeliveryHttpError("Delivery resource not found.", 404, "not_found");
    }

    return await jsonDeliveryResponse(request, { data: result });
  } catch (reason) {
    return problemResponse(request, reason);
  }
}

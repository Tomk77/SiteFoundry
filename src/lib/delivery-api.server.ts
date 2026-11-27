import { parseDeliveryBundle, type DeliveryBundle } from "@/domain/delivery";

export class DeliveryHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly allow?: string,
  ) {
    super(message);
  }
}

function serverEnvironment() {
  const url = process.env.VITE_SUPABASE_URL;
  const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new DeliveryHttpError("The delivery API is not configured.", 503, "not_configured");
  }

  return { url, publishableKey };
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+([A-Za-z0-9_-]{20,})$/);
  const token = match?.[1];
  if (!token) {
    throw new DeliveryHttpError("A valid publishable read token is required.", 401, "unauthorized");
  }

  return token;
}

// Postgres SQLSTATE codes raised by get_delivery_bundle (finding 3.7).
const deliveryFailures: Record<string, DeliveryHttpError> = {
  "28000": new DeliveryHttpError("The site or delivery token is invalid.", 401, "unauthorized"),
  "42501": new DeliveryHttpError("This browser origin is not allowed.", 403, "origin_forbidden"),
  "54000": new DeliveryHttpError("The delivery rate limit was exceeded.", 429, "rate_limited"),
};

const upstreamFailure = () =>
  new DeliveryHttpError("The content database is unavailable.", 502, "upstream_error");

export async function loadDeliveryBundle(request: Request, siteKey: string) {
  const token = bearerToken(request);
  const { url, publishableKey } = serverEnvironment();
  // The raw token goes to the database, which hashes it; a leaked hash is useless (finding 3.5).
  const response = await fetch(`${url}/rest/v1/rpc/get_delivery_bundle`, {
    method: "POST",
    headers: {
      apikey: publishableKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      target_site_key: siteKey,
      target_token: token,
      target_origin: request.headers.get("origin"),
    }),
  }).catch(() => {
    throw upstreamFailure();
  });

  if (!response.ok) {
    const failure: unknown = await response.json().catch(() => null);
    const code =
      failure && typeof failure === "object" && "code" in failure ? String(failure.code) : "";

    throw deliveryFailures[code] ?? upstreamFailure();
  }

  return parseDeliveryBundle(await response.json());
}

// Responses depend on the token and the origin, so caches must key on both (finding 3.1).
function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");

  return {
    ...(origin
      ? {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Expose-Headers": "ETag, X-Request-Id",
        }
      : {}),
    Vary: "Authorization, Origin",
  };
}

export function preflightResponse(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return new Response(null, { status: 204 });

  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Max-Age": "600",
      Vary: "Origin",
    },
  });
}

export async function jsonDeliveryResponse(
  request: Request,
  value: unknown,
  init: { status?: number; cacheControl?: string } = {},
) {
  const body = JSON.stringify(value);
  const etag = `"${await sha256(body)}"`;
  const headers = {
    ...corsHeaders(request),
    // Token-gated: browsers may keep a copy but must revalidate with the ETag (ADR 0007).
    "Cache-Control": init.cacheControl ?? "private, no-cache",
    "Content-Type": "application/json; charset=utf-8",
    ETag: etag,
  };
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(body, { status: init.status ?? 200, headers });
}

export function problemResponse(request: Request, reason: unknown) {
  const error =
    reason instanceof DeliveryHttpError
      ? reason
      : new DeliveryHttpError("The delivery request failed.", 500, "internal_error");
  const body = JSON.stringify({
    type: `https://scaffold-cms.dev/problems/${error.code}`,
    title: error.message,
    status: error.status,
    code: error.code,
  });

  const headers = new Headers(corsHeaders(request));
  if (error.status === 405) headers.set("Allow", error.allow ?? "GET, OPTIONS");
  headers.set("Cache-Control", "no-store");
  headers.set("Content-Type", "application/problem+json; charset=utf-8");
  if (error.status === 401) headers.set("WWW-Authenticate", "Bearer");

  return new Response(body, {
    status: error.status,
    headers,
  });
}

export function publicSite(bundle: DeliveryBundle) {
  return { ...bundle.site, languages: bundle.languages };
}

import { parseDeliveryBundle, type DeliveryBundle } from "@/domain/delivery";

export class DeliveryHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
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

export async function loadDeliveryBundle(request: Request, siteKey: string) {
  const token = bearerToken(request);
  const tokenHash = await sha256(token);
  const { url, publishableKey } = serverEnvironment();
  const response = await fetch(`${url}/rest/v1/rpc/get_delivery_bundle`, {
    method: "POST",
    headers: {
      apikey: publishableKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      target_site_key: siteKey,
      target_token_hash: tokenHash,
      target_origin: request.headers.get("origin"),
    }),
  });

  if (!response.ok) {
    const failure: unknown = await response.json().catch(() => null);
    const message =
      failure && typeof failure === "object" && "message" in failure
        ? String(failure.message)
        : "The delivery request was rejected.";
    if (/origin/i.test(message)) {
      throw new DeliveryHttpError("This browser origin is not allowed.", 403, "origin_forbidden");
    }

    if (/rate|limit/i.test(message)) {
      throw new DeliveryHttpError("The delivery rate limit was exceeded.", 429, "rate_limited");
    }

    throw new DeliveryHttpError("The site or delivery token is invalid.", 401, "unauthorized");
  }

  return parseDeliveryBundle(await response.json());
}

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");

  return origin
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Expose-Headers": "ETag, X-Request-Id",
        Vary: "Origin",
      }
    : {};
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
    "Cache-Control":
      init.cacheControl ?? "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
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

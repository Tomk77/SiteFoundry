import { ApolloSandbox } from "@apollo/sandbox/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { SettingsCard } from "./settings-layout";

const sampleQuery = `query PlaygroundPages {
  site {
    key
    name
  }
  pages(first: 5) {
    nodes {
      id
      locale
      title
      path
    }
    totalCount
  }
}`;

function externalSandboxUrl(endpoint: string) {
  const url = new URL("https://studio.apollographql.com/sandbox/explorer");
  url.searchParams.set("endpoint", endpoint);
  url.searchParams.set("document", sampleQuery);

  return url.toString();
}

export function GraphQLPlayground({
  siteKey,
  initialToken,
}: {
  siteKey: string;
  initialToken?: string | null;
}) {
  const relativeEndpoint = `/api/v1/sites/${encodeURIComponent(siteKey)}/graphql`;
  const endpoint = useMemo(
    () =>
      typeof window === "undefined"
        ? relativeEndpoint
        : new URL(relativeEndpoint, window.location.origin).toString(),
    [relativeEndpoint],
  );
  const [token, setToken] = useState(initialToken ?? "");
  const [connectedToken, setConnectedToken] = useState(initialToken?.trim() ?? "");
  const [showToken, setShowToken] = useState(false);
  const handleRequest = useCallback(
    (url: string, options: RequestInit) =>
      fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${connectedToken}`,
        },
      }),
    [connectedToken],
  );

  useEffect(() => {
    if (!initialToken) return;
    const nextToken = initialToken.trim();
    setToken(nextToken);
    setConnectedToken(nextToken);
  }, [initialToken]);

  function connect() {
    const nextToken = token.trim();
    if (!nextToken) return;
    setConnectedToken(nextToken);
  }

  return (
    <SettingsCard
      description="Explore the schema and run authenticated published-read queries with Apollo Sandbox."
      icon="ph-graphql-logo"
      title="GraphQL playground"
    >
      <div className="flex flex-col gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <label
            className="text-[11px] font-semibold tracking-[0.04em] text-ink-muted uppercase"
            htmlFor="graphql-playground-endpoint"
          >
            Endpoint
          </label>
          <div className="flex gap-2 max-[700px]:flex-col">
            <Input
              className="font-mono"
              id="graphql-playground-endpoint"
              readOnly
              value={endpoint}
            />
            <Button
              onClick={() => {
                void navigator.clipboard.writeText(endpoint);
                toast.success("Endpoint copied");
              }}
              type="button"
              variant="outline"
            >
              <i aria-hidden className="ph ph-copy" /> Copy
            </Button>
            <Button
              onClick={() =>
                window.open(externalSandboxUrl(endpoint), "_blank", "noopener,noreferrer")
              }
              type="button"
              variant="outline"
            >
              <i aria-hidden className="ph ph-arrow-square-out" /> Open in Apollo
            </Button>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <label
            className="text-[11px] font-semibold tracking-[0.04em] text-ink-muted uppercase"
            htmlFor="graphql-playground-token"
          >
            Publishable token
          </label>
          <div className="flex gap-2 max-[620px]:flex-col">
            <div className="flex min-w-0 flex-1 gap-2">
              <Input
                aria-describedby="graphql-playground-token-hint"
                autoComplete="off"
                className="font-mono"
                id="graphql-playground-token"
                onChange={(event) => setToken(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") connect();
                }}
                placeholder="scaffold_pub_..."
                spellCheck={false}
                type={showToken ? "text" : "password"}
                value={token}
              />
              <Button
                aria-label={showToken ? "Hide token" : "Show token"}
                onClick={() => setShowToken((current) => !current)}
                size="icon"
                type="button"
                variant="outline"
              >
                <i aria-hidden className={showToken ? "ph ph-eye-slash" : "ph ph-eye"} />
              </Button>
            </div>
            <Button disabled={!token.trim()} onClick={connect} type="button">
              <i aria-hidden className="ph ph-plugs-connected" /> Connect
            </Button>
          </div>
          <small
            className="text-[11px] leading-4 text-ink-subtle"
            id="graphql-playground-token-hint"
          >
            Kept only in this page&apos;s memory. Reconnect after changing it. The external Apollo
            link never includes your token.
          </small>
        </div>

        {connectedToken ? (
          <div
            className="h-[720px] min-h-[520px] overflow-hidden rounded-xl border border-border bg-sunken"
            data-testid="apollo-sandbox"
          >
            <ApolloSandbox
              className="h-full w-full"
              endpointIsEditable={false}
              handleRequest={handleRequest}
              hideCookieToggle
              initialEndpoint={endpoint}
              initialState={{
                document: sampleQuery,
                includeCookies: false,
                pollForSchemaUpdates: false,
              }}
              runTelemetry={false}
            />
          </div>
        ) : (
          <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-border bg-sunken p-8 text-center">
            <div className="max-w-md">
              <i aria-hidden className="ph ph-graphql-logo text-brand text-4xl" />
              <h3 className="mt-3 text-sm font-semibold text-ink">Connect a publishable token</h3>
              <p className="mt-1 text-xs leading-5 text-ink-subtle">
                Apollo Sandbox will load the schema reference, autocomplete, query builder, and
                response inspector for this site.
              </p>
            </div>
          </div>
        )}
      </div>
    </SettingsCard>
  );
}
